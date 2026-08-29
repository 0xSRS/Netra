from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert
from app.schemas import AlertResponse

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertResponse])
def get_active_alerts(db: Session = Depends(get_db)):
    """Fetch active alerts for GIS / frontend."""
    return db.query(Alert).filter(Alert.status == "ACTIVE").order_by(Alert.triggered_at.desc()).all()