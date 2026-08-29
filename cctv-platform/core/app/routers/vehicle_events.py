<<<<<<< HEAD
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import VehicleEvent, WantedVehicle, MissingVehicle, Alert
from app.schemas import VehicleEventCreate

router = APIRouter(prefix="/vehicle_events", tags=["Vehicle Events"])

SERVICE_KEY = "shared-secret-agree-with-teammate"

@router.post("", status_code=status.HTTP_201_CREATED)
def receive_vehicle_event(
    event_data: VehicleEventCreate,
    x_service_key: str = Header(None, alias="X-Service-Key"),
    db: Session = Depends(get_db)
):
    if x_service_key != SERVICE_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Service Key")

    # 1. Insert into vehicle_events
    new_event = VehicleEvent(**event_data.model_dump())
    db.add(new_event)
    db.flush()

    plate = event_data.plate_number

    if plate:
        # 2. Check Wanted Vehicles
        wanted = db.query(WantedVehicle).filter(WantedVehicle.plate_number == plate).first()
        if wanted:
            alert = Alert(
                event_id=new_event.id,
                plate_number=plate,
                camera_id=event_data.camera_id,
                alert_type="WANTED",
                severity=wanted.severity,
                details=f"Wanted FIR: {wanted.fir_number} - {wanted.crime_description}"
            )
            db.add(alert)

        # 3. Check Missing Vehicles
        missing = db.query(MissingVehicle).filter(MissingVehicle.plate_number == plate).first()
        if missing:
            alert = Alert(
                event_id=new_event.id,
                plate_number=plate,
                camera_id=event_data.camera_id,
                alert_type="MISSING",
                severity="HIGH",
                details=f"Missing Report: {missing.report_number} | Owner: {missing.owner_name} ({missing.vehicle_model})"
            )
            db.add(alert)

    # 4. Check Overspeed Violation
    if event_data.event_type == "speed":
        alert = Alert(
            event_id=new_event.id,
            plate_number=plate or "UNKNOWN",
            camera_id=event_data.camera_id,
            alert_type="SPEED",
            severity="MEDIUM",
            details=f"Overspeeding: {event_data.speed_kmph} km/h (Limit: {event_data.speed_limit_kmph} km/h)"
        )
        db.add(alert)

    db.commit()
    db.refresh(new_event)

    return {"status": "Logged", "event_id": new_event.id}
=======
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
>>>>>>> aec4f34988174d693cc4b54d0f31c0dfd31b66f7
