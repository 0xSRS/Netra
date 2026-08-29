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