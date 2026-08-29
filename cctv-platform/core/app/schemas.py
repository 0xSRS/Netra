from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel

# ============================================================
# VEHICLE SCHEMAS
# ============================================================
class VehicleEventCreate(BaseModel):
    camera_id: str
    organization_id: str
    event_type: str
    plate_number: Optional[str] = None
    confidence: float
    pts_ms: float
    speed_kmph: Optional[float] = None
    speed_limit_kmph: Optional[float] = None
    snapshot_url: Optional[str] = None

class VehicleEventResponse(VehicleEventCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class WantedVehicleCreate(BaseModel):
    plate_number: str
    fir_number: Optional[str] = None
    crime_description: str
    severity: Optional[str] = "HIGH"
    issuing_authority: Optional[str] = "Gujarat Police"

class WantedVehicleResponse(WantedVehicleCreate):
    id: int
    registered_at: datetime

    class Config:
        from_attributes = True

class MissingVehicleCreate(BaseModel):
    plate_number: str
    owner_name: Optional[str] = None
    vehicle_model: Optional[str] = None
    report_number: Optional[str] = None
    contact_number: Optional[str] = None

class MissingVehicleResponse(MissingVehicleCreate):
    id: int
    reported_at: datetime

    class Config:
        from_attributes = True

class AlertResponse(BaseModel):
    id: int
    event_id: int
    plate_number: str
    camera_id: str
    alert_type: str
    severity: str
    details: str
    status: str
    triggered_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# PERSON SCHEMAS
# ============================================================
class PersonMissingCreate(BaseModel):
    name: str
    age: Optional[int] = None
    description: Optional[str] = None
    reference_embedding: List[float]
    reference_image_path: Optional[str] = None
    reported_by: Optional[str] = None
    status: Optional[str] = "active"

class PersonMissingResponse(PersonMissingCreate):
    person_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class PersonWantedCreate(BaseModel):
    name: str
    age: Optional[int] = None
    crime_description: Optional[str] = None
    reference_embedding: List[float]
    reference_image_path: Optional[str] = None
    reported_by: Optional[str] = None
    status: Optional[str] = "active"

class PersonWantedResponse(PersonWantedCreate):
    person_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class PersonEventCreate(BaseModel):
    camera_id: str
    organization_id: str
    pts_ms: float
    bbox: Dict[str, Any]
    embedding: List[float]
    crop_image_path: Optional[str] = None
    matched_missing_id: Optional[UUID] = None
    matched_wanted_id: Optional[UUID] = None

class PersonEventResponse(PersonEventCreate):
    event_id: UUID
    detected_at: datetime

    class Config:
        from_attributes = True

class PersonAlertResponse(BaseModel):
    alert_id: UUID
    event_id: Optional[UUID] = None
    missing_id: Optional[UUID] = None
    wanted_id: Optional[UUID] = None
    category: str
    camera_id: str
    similarity_score: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True