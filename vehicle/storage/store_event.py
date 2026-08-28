import requests

CORE_URL = "http://localhost:8000"  # Core's address — update once you know the real host/port
SERVICE_KEY = "shared-secret-agree-with-teammate"

def send_event(camera_id, organization_id, event_type, plate_number, confidence, pts_ms, speed_kmph=None, speed_limit_kmph=None):
    payload = {
        "camera_id": camera_id,
        "organization_id": organization_id,
        "event_type": event_type,
        "plate_number": plate_number,
        "confidence": confidence,
        "pts_ms": pts_ms,
        "speed_kmph": speed_kmph,
        "speed_limit_kmph": speed_limit_kmph,
    }
    headers = {"X-Service-Key": SERVICE_KEY}
    try:
        requests.post(f"{CORE_URL}/vehicle_events", json=payload, headers=headers, timeout=2)
    except requests.RequestException:
        pass  # hackathon-grade: don't crash a worker over a network hiccup; consider logging this