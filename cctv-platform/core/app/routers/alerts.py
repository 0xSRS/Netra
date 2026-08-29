from typing import List, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import json

from app.database import get_db, SessionLocal
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
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


# ---------------- Alert creation helper ----------------
def check_watchlist_and_create_alert(
    source_type: str, camera_id: str, value: str, organization_id: Optional[str] = None
) -> Optional[models.Alert]:
    """Called by vehicle_events.py / person_events.py whenever a new detection comes in.
    Checks the value (plate number or person label) against the watchlist; if it matches, creates an Alert row."""
    db = SessionLocal()
    try:
        entry_type = "vehicle" if source_type == "vehicle" else "person"
        match = (
            db.query(models.Watchlist)
            .filter(models.Watchlist.entry_type == entry_type, models.Watchlist.value == value)
            .first()
        )
        if not match:
            return None
        alert = models.Alert(
            source_type=source_type,
            camera_id=camera_id,
            organization_id=organization_id,
            matched_value=value,
            reason=match.reason,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert
    finally:
        db.close()


# ---------------- REST Endpoints ----------------
@router.get("", response_model=List[schemas.UserOut])
def list_alerts(db: Session = Depends(get_db)):
    """Fetch latest alerts (active + historical)."""
    return db.query(models.Alert).order_by(models.Alert.timestamp.desc()).all()