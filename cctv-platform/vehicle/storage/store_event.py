import logging
from typing import Optional
import requests

logger = logging.getLogger("store_event")

# Update with confirmed Core settings from Teammate A
CORE_URL = "http://localhost:8000"
SERVICE_KEY = "shared-secret-agree-with-teammate"


def send_event(
    camera_id: str,
    organization_id: str,
    event_type: str,
    plate_number: Optional[str],
    confidence: float,
    pts_ms: float,
    speed_kmph: Optional[float] = None,
    speed_limit_kmph: Optional[float] = None,
    snapshot_url: Optional[str] = None
):
    """
    Synchronously posts a detection event to Core's /vehicle_events endpoint.
    Handles network errors gracefully so persistent workers never crash.
    """
    payload = {
        "camera_id": camera_id,
        "organization_id": organization_id,
        "event_type": event_type,
        "plate_number": plate_number,
        "confidence": round(float(confidence), 3) if confidence is not None else 0.0,
        "pts_ms": float(pts_ms),
        "speed_kmph": round(float(speed_kmph), 1) if speed_kmph is not None else None,
        "speed_limit_kmph": round(float(speed_limit_kmph), 1) if speed_limit_kmph is not None else None,
        "snapshot_url": snapshot_url
    }

    headers = {
        "X-Service-Key": SERVICE_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            f"{CORE_URL}/vehicle_events",
            json=payload,
            headers=headers,
            timeout=2.0
        )
        if response.status_code in (200, 201):
            logger.info(f"[{event_type.upper()}] Event dispatched for {plate_number or 'Violation'} on {camera_id}")
        else:
            logger.warning(f"Core returned HTTP {response.status_code}: {response.text}")
    except requests.RequestException as e:
        # Hackathon-grade resilience: Log the failure without crashing worker threads
        logger.error(f"Failed to post vehicle event to Core: {e}")