from typing import List, Optional, Dict, Any
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ---------------- WebSocket Connection Manager ----------------
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active):
            try:
                await connection.send_text(json.dumps(message, default=str))
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


# ---------------- Helper used by vehicle_events.py ----------------
async def broadcast_vehicle_alert(alert: models.Alert):
    """Scheduled as a BackgroundTask right after a vehicle Alert row is
    committed in routers/vehicle_events.py, so it fires without slowing
    down the ingestion response."""
    await manager.broadcast({
        "source": "vehicle",
        "id": alert.id,
        "event_id": alert.event_id,
        "plate_number": alert.plate_number,
        "camera_id": alert.camera_id,
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "details": alert.details,
        "status": alert.status,
        "triggered_at": alert.triggered_at,
    })


# ---------------- Ingest endpoint used by the person service ----------------
@router.post("", status_code=201)
async def receive_person_alert(payload: schemas.PersonAlertPush):
    """
    The person service (person/alerts/send_to_core.py) already writes the
    person_alerts row itself via raw SQL (person/alerts/alert_store.py)
    BEFORE calling this endpoint — this endpoint's only job is to push that
    alert live to any connected frontend over the websocket. It must NOT
    insert into the DB again, or you'd get duplicate rows.
    """
    await manager.broadcast({"source": "person", **payload.model_dump()})
    return {"received": True}


# ---------------- WebSocket ----------------
@router.websocket("/ws")
async def alerts_ws(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We never expect the client to send anything; this just blocks
            # until the browser closes the tab/socket.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------- REST: history / initial load ----------------
@router.get("/vehicle", response_model=List[schemas.AlertResponse])
def list_vehicle_alerts(db: Session = Depends(get_db)):
    return db.query(models.Alert).order_by(desc(models.Alert.triggered_at)).limit(200).all()


@router.get("/person", response_model=List[schemas.PersonAlertResponse])
def list_person_alerts(db: Session = Depends(get_db)):
    return db.query(models.PersonAlert).order_by(desc(models.PersonAlert.created_at)).limit(200).all()


@router.get("/feed")
def list_alerts_feed(db: Session = Depends(get_db)):
    """Merged vehicle + person alerts, newest first — the dashboard's live
    alert panel loads this once on mount, then the websocket takes over for
    anything new."""
    vehicle_alerts = db.query(models.Alert).order_by(desc(models.Alert.triggered_at)).limit(100).all()
    person_alerts = db.query(models.PersonAlert).order_by(desc(models.PersonAlert.created_at)).limit(100).all()

    feed = [
        {
            "source": "vehicle",
            "id": a.id,
            "camera_id": a.camera_id,
            "headline": f"{a.alert_type} — {a.plate_number or 'unknown plate'}",
            "details": a.details,
            "severity": a.severity,
            "status": a.status,
            "timestamp": a.triggered_at,
        }
        for a in vehicle_alerts
    ] + [
        {
            "source": "person",
            "id": str(p.alert_id),
            "camera_id": p.camera_id,
            "headline": f"{p.category} person match ({p.similarity_score:.2f} similarity)",
            "details": None,
            "severity": "HIGH" if p.category == "wanted" else "MEDIUM",
            "status": p.status,
            "timestamp": p.created_at,
        }
        for p in person_alerts
    ]
    feed.sort(key=lambda x: x["timestamp"], reverse=True)
    return feed