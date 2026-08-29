from typing import List, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import json

import models
import schemas
from database import get_db, SessionLocal

router = APIRouter(prefix="/alerts", tags=["alerts"])


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


def check_watchlist_and_create_alert(
    source_type: str, camera_id: str, value: str, organization_id: Optional[str] = None
) -> Optional[models.Alert]:
    """Called by vehicle_events.py / person_events.py whenever a new
    detection comes in. Checks the value (plate number or person label)
    against the watchlist; if it matches, creates an Alert row."""
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


@router.get("", response_model=List[schemas.AlertOut])
def list_alerts(db: Session = Depends(get_db)):
    return db.query(models.Alert).order_by(models.Alert.timestamp.desc()).limit(200).all()


@router.post("/watchlist", response_model=schemas.WatchlistOut)
def add_watchlist_entry(entry: schemas.WatchlistCreate, db: Session = Depends(get_db)):
    db_entry = models.Watchlist(**entry.dict())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.get("/watchlist", response_model=List[schemas.WatchlistOut])
def list_watchlist(db: Session = Depends(get_db)):
    return db.query(models.Watchlist).all()


@router.websocket("/ws")
async def alerts_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
