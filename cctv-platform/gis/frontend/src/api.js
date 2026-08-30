const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "netra_token";

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
  return res.json();
}

export async function fetchGapAnalysis() {
  const res = await authFetch("/cameras/reports/gap-analysis");
  if (!res.ok) throw new Error("Failed to fetch gap analysis");
  return res.json();
}

export async function uploadCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch("/cameras/bulk-import", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Import failed");
  return res.json();
}

export async function uploadCamerasJson(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const res = await authFetch("/cameras/bulk-import-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Import failed");
  return res.json();
}

export async function resetCameras() {
  const res = await authFetch("/cameras", { method: "DELETE" });
  if (!res.ok) throw new Error("Reset failed");
  return res.json();
}

export async function createCamera(camera) {
  const res = await authFetch("/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(camera),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Create failed");
  }
  return res.json();
}

// ---------- Alerts / Dashboard ----------

export async function fetchAlertsFeed() {
  const res = await authFetch("/alerts/feed");
  if (!res.ok) throw new Error("Failed to fetch alerts");
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
  return res.json();
}