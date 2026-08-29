from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from routers.alerts import check_watchlist_and_create_alert

router = APIRouter(prefix="/vehicle-events", tags=["vehicle-events"])


@router.post("", response_model=schemas.VehicleEventOut)
def create_vehicle_event(event: schemas.VehicleEventCreate, db: Session = Depends(get_db)):
    db_event = models.VehicleEvent(**event.dict(exclude_unset=True))
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    check_watchlist_and_create_alert(
        source_type="vehicle",
        camera_id=event.camera_id,
        value=event.plate_number,
        organization_id=event.organization_id,
    )
    return db_event


@router.get("", response_model=List[schemas.VehicleEventOut])
def list_vehicle_events(
    camera_id: Optional[str] = None,
    plate_number: Optional[str] = None,
    organization_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.VehicleEvent)
    if camera_id:
        query = query.filter(models.VehicleEvent.camera_id == camera_id)
    if plate_number:
        query = query.filter(models.VehicleEvent.plate_number == plate_number)
    if organization_id:
        query = query.filter(models.VehicleEvent.organization_id == organization_id)
    return query.order_by(models.VehicleEvent.timestamp.desc()).limit(500).all()


@router.get("/track/{plate_number}", response_model=List[schemas.VehicleEventOut])
def track_vehicle(plate_number: str, db: Session = Depends(get_db)):
    """Step-4 live test case: every camera this plate was seen at, in order."""
    return (
        db.query(models.VehicleEvent)
        .filter(models.VehicleEvent.plate_number == plate_number)
        .order_by(models.VehicleEvent.timestamp.asc())
        .all()
    )
