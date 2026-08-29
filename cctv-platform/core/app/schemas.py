from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ---------- Camera (matches the registry contract exactly) ----------

class LocationIn(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None


class PropertiesIn(BaseModel):
    codec: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class StreamIn(BaseModel):
    rtsp: Optional[str] = None
    webrtc: Optional[str] = None   # preferred protocol — use this for live viewing
    hls: Optional[str] = None


class CameraCreate(BaseModel):
    camera_id: str
    organization_id: str
    organization_name: Optional[str] = None
    name: str
    status: str = "online"
    location: LocationIn
    camera_type: str = "IP"
    properties: Optional[PropertiesIn] = None
    stream: Optional[StreamIn] = None

    # extra fields for the hackathon's own registry deliverables — not part
    # of the org's contract, but needed for department/district gap-analysis
    department: Optional[str] = None
    district: Optional[str] = None
    vms_vendor: Optional[str] = None
    storage_type: str = "cloud"
    retention_days: int = 7


class CameraOut(BaseModel):
    camera_id: str
    organization_id: str
    organization_name: Optional[str] = None
    name: str
    status: str
    location: LocationIn
    camera_type: str
    properties: PropertiesIn
    stream: StreamIn
    department: Optional[str] = None
    district: Optional[str] = None
    vms_vendor: Optional[str] = None
    storage_type: str
    retention_days: int
    install_date: datetime
    last_health_check: datetime


class CamerasBulkImport(BaseModel):
    """Matches the exact { "cameras": [...] } shape from the contract."""
    cameras: List[CameraCreate]


# ---------- Auth ----------

class UserCreate(BaseModel):
    username: str
    password: str
    department: Optional[str] = None
    role: str = "viewer"


class UserOut(BaseModel):
    id: int
    username: str
    department: Optional[str]
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Watchlist ----------

class WatchlistCreate(BaseModel):
    entry_type: str   # "vehicle" or "person"
    value: str
    reason: str
    added_by: Optional[str] = None


class WatchlistOut(WatchlistCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Vehicle events ----------

class VehicleEventCreate(BaseModel):
    camera_id: str
    organization_id: Optional[str] = None
    plate_number: str
    confidence: float = 0.0
    speed_kmph: Optional[float] = None
    helmet_status: Optional[str] = None
    timestamp: Optional[datetime] = None


class VehicleEventOut(VehicleEventCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


# ---------- Person events ----------

class PersonEventCreate(BaseModel):
    camera_id: str
    organization_id: Optional[str] = None
    person_label: str
    confidence: float = 0.0
    timestamp: Optional[datetime] = None


class PersonEventOut(PersonEventCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


# ---------- Alerts ----------

class AlertOut(BaseModel):
    id: int
    source_type: str
    camera_id: str
    organization_id: Optional[str] = None
    matched_value: str
    reason: str
    timestamp: datetime
    resolved: bool

    class Config:
        from_attributes = True


# ---------- Frame batches (Vehicle AI / Face AI input contract) ----------

class FrameIn(BaseModel):
    camera_id: str
    organization_id: str
    pts_ms: int
    width: int
    height: int
    format: str = "jpeg"
    frame: str   # base64-encoded JPEG bytes (JSON can't carry raw binary)


class FrameBatchIn(BaseModel):
    frames: List[FrameIn]


class FrameBatchStatus(BaseModel):
    status: str = "Completed"
