from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from datetime import datetime
from database import Base


class Camera(Base):
    """Owned by GIS module. Matches the camera registry contract from the
    streaming/ingest team: organization_id, nested location, camera_type,
    properties (codec/resolution), and stream URLs (rtsp/webrtc/hls) —
    webrtc is the preferred protocol for live viewing.

    Stored flat in the DB for simplicity; the API layer (schemas.py +
    routers/cameras.py) nests it back into the exact contract shape on the
    way in and out.
    """
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, unique=True, index=True)        # e.g. "CAM-001"
    organization_id = Column(String, index=True)                # e.g. "ORG-POLICE"
    organization_name = Column(String, nullable=True)
    name = Column(String)
    status = Column(String, default="online")                   # online / offline / maintenance

    # location
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String, nullable=True)

    camera_type = Column(String, default="IP")                  # IP / analog / PTZ

    # properties
    codec = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    # stream — webrtc is the preferred/primary protocol per team decision
    rtsp_url = Column(String, nullable=True)
    webrtc_url = Column(String, nullable=True)
    hls_url = Column(String, nullable=True)

    # extra fields needed for the hackathon's registry deliverables
    # (gap-analysis by department/district, vendor/retention reporting)
    department = Column(String, index=True, nullable=True)
    district = Column(String, index=True, nullable=True)
    vms_vendor = Column(String, nullable=True)
    storage_type = Column(String, default="cloud")
    retention_days = Column(Integer, default=7)

    install_date = Column(DateTime, default=datetime.utcnow)
    last_health_check = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    department = Column(String, nullable=True)
    role = Column(String, default="viewer")   # admin / operator / viewer
    created_at = Column(DateTime, default=datetime.utcnow)


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    entry_type = Column(String, index=True)   # "vehicle" or "person"
    value = Column(String, index=True)        # plate number, or person label/id
    reason = Column(String)
    added_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class VehicleEvent(Base):
    """One row per plate detection from the vehicle/ANPR AI pipeline."""
    __tablename__ = "vehicle_events"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), index=True)
    organization_id = Column(String, nullable=True, index=True)
    plate_number = Column(String, index=True)
    confidence = Column(Float, default=0.0)
    speed_kmph = Column(Float, nullable=True)
    helmet_status = Column(String, nullable=True)   # "worn" / "not_worn" / None
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class PersonEvent(Base):
    """One row per detection from the face-recognition AI pipeline."""
    __tablename__ = "person_events"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), index=True)
    organization_id = Column(String, nullable=True, index=True)
    person_label = Column(String, index=True)
    confidence = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String)            # "vehicle" or "person"
    camera_id = Column(String, ForeignKey("cameras.camera_id"), index=True)
    organization_id = Column(String, nullable=True, index=True)
    matched_value = Column(String)
    reason = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    resolved = Column(Boolean, default=False)
