from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from routers.alerts import check_watchlist_and_create_alert

router = APIRouter(prefix="/person-events", tags=["person-events"])


@router.post("", response_model=schemas.PersonEventOut)
def create_person_event(event: schemas.PersonEventCreate, db: Session = Depends(get_db)):
    db_event = models.PersonEvent(**event.dict(exclude_unset=True))
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    check_watchlist_and_create_alert(
        source_type="person",
        camera_id=event.camera_id,
        value=event.person_label,
        organization_id=event.organization_id,
    )
    return db_event


@router.get("", response_model=List[schemas.PersonEventOut])
def list_person_events(
    camera_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.PersonEvent)
    if camera_id:
        query = query.filter(models.PersonEvent.camera_id == camera_id)
    if organization_id:
        query = query.filter(models.PersonEvent.organization_id == organization_id)
    return query.order_by(models.PersonEvent.timestamp.desc()).limit(500).all()
