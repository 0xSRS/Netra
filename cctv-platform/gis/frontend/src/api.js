const API_BASE = "http://localhost:8000";
// The person service is its own FastAPI app (person/main.py), run
// separately on port 8001 — it is NOT part of core. See person/readme.md:
// "uvicorn main:app --reload --port 8001".
const PERSON_API_BASE = "http://localhost:8001";
const TOKEN_KEY = "netra_token";

// ---------- "Random for now" coordinates ----------
// Real cameras from ingestion only carry a text address, no lat/long yet.
// Until real GPS/geocoding exists, any camera without coordinates gets a
// stable, repeatable position within Gujarat's bounding box — stable so
// the SAME camera always lands in the SAME spot (derived from a hash of
// its camera_id), not a fresh random jump on every reload.
const GUJARAT_BOUNDS = { latMin: 20.1, latMax: 24.7, lngMin: 68.1, lngMax: 74.4 };

function fnv1aHash(str, seed) {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function fallbackCoords(camera_id) {
  const id = camera_id || "unknown";
  // Different seeds for lat vs lng so nearby-looking IDs (CAM-001, CAM-002)
  // spread across the map instead of clustering on top of each other.
  const latHash = fnv1aHash(id, 0x811c9dc5);
  const lngHash = fnv1aHash(id + "#lng", 0x01000193);
  return {
    latitude: GUJARAT_BOUNDS.latMin + (latHash % 100000) / 100000 * (GUJARAT_BOUNDS.latMax - GUJARAT_BOUNDS.latMin),
    longitude: GUJARAT_BOUNDS.lngMin + (lngHash % 100000) / 100000 * (GUJARAT_BOUNDS.lngMax - GUJARAT_BOUNDS.lngMin),
  };
}

function withFallbackCoords(camera) {
  if (camera.location?.latitude != null && camera.location?.longitude != null) return camera;
  const fb = fallbackCoords(camera.camera_id);
  return { ...camera, location: { ...camera.location, ...fb, isFallback: true } };
}

// ---------- Auth ----------

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  return { username: payload.sub, role: payload.role, department: payload.department };
}

export async function login(username, password) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Invalid username or password");
  const data = await res.json();
  saveToken(data.access_token);
  return getCurrentUser();
}

export function logout() {
  clearToken();
}

async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired — please log in again.");
  }
  return res;
}

// ---------- Admin: user management ----------

export async function fetchUsers() {
  const res = await authFetch("/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function createUser(user) {
  const res = await authFetch("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create user");
  }
  return res.json();
}

export async function deleteUser(username) {
  const res = await authFetch(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete user");
  return res.json();
}

// ---------- Cameras (registry) ----------

export async function fetchCameras(filters = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const res = await authFetch(`/cameras?${params}`);
  if (!res.ok) throw new Error("Failed to fetch cameras");
  const cameras = await res.json();
  return cameras.map(withFallbackCoords);
}

export async function fetchGapAnalysis() {
  const res = await authFetch("/cameras/reports/gap-analysis");
  if (!res.ok) throw new Error("Failed to fetch gap analysis");
  return res.json();
}

// ---------- Alerts / Dashboard ----------

export async function fetchAlertsFeed() {
  const res = await authFetch("/alerts/feed");
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

export async function fetchVehicleAlerts() {
  const res = await authFetch("/alerts/vehicle");
  if (!res.ok) throw new Error("Failed to fetch vehicle alerts");
  return res.json();
}

export async function fetchPersonAlerts() {
  const res = await authFetch("/alerts/person");
  if (!res.ok) throw new Error("Failed to fetch person alerts");
  return res.json();
}

export function connectAlertsSocket(onMessage) {
  const ws = new WebSocket(`ws://localhost:8000/alerts/ws`);
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  return ws;
}

// ---------- Vehicle tracking ----------

export async function trackVehicle(plateNumber) {
  const res = await authFetch(`/vehicle_events/track/${encodeURIComponent(plateNumber)}`);
  if (!res.ok) throw new Error("Track failed");
  const data = await res.json();

  data.points = (data.points || []).map((p) => {
    if (p.latitude != null && p.longitude != null) return p;
    const fb = fallbackCoords(p.camera_id);
    return { ...p, ...fb, isFallback: true };
  });
  if ((data.last_latitude == null || data.last_longitude == null) && data.last_camera_id) {
    const fb = fallbackCoords(data.last_camera_id);
    data.last_latitude = fb.latitude;
    data.last_longitude = fb.longitude;
  }
  return data;
}

// ---------- Vehicle watchlist (wanted / missing) ----------
// These hit core's existing /watchlist/* router (core/app/routers/watchlist.py)
// — nothing in the frontend called these before now.

export async function fetchWantedVehicles() {
  const res = await authFetch("/watchlist/wanted");
  if (!res.ok) throw new Error("Failed to fetch wanted vehicles");
  return res.json();
}

export async function addWantedVehicle(entry) {
  const res = await authFetch("/watchlist/wanted", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to add wanted vehicle");
  }
  return res.json();
}

export async function removeWantedVehicle(plateNumber) {
  const res = await authFetch(`/watchlist/wanted/${encodeURIComponent(plateNumber)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove wanted vehicle");
  return res.json();
}

export async function fetchMissingVehicles() {
  const res = await authFetch("/watchlist/missing");
  if (!res.ok) throw new Error("Failed to fetch missing vehicles");
  return res.json();
}

export async function addMissingVehicle(entry) {
  const res = await authFetch("/watchlist/missing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to add missing vehicle");
  }
  return res.json();
}

export async function removeMissingVehicle(plateNumber) {
  const res = await authFetch(`/watchlist/missing/${encodeURIComponent(plateNumber)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove missing vehicle");
  return res.json();
}

// ---------- Person search (photo upload) ----------
// This calls the PERSON MICROSERVICE directly (person/events/search_person.py),
// not core — it lives on its own port and is not proxied through core:8000.
// No auth token is sent because that service doesn't run core's auth.py at all.

export async function searchPersonByPhoto(file, topK = 10) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${PERSON_API_BASE}/person/search?top_k=${topK}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Person search failed — check the person service is running on port 8001.");
  return res.json(); // { matches: [{ event_id, camera_id, detected_at, similarity_score, crop_image_path }] }
}