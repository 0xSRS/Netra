import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Float, Numeric, 
    Boolean, DateTime, Text, ForeignKey, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from .database import Base

# ============================================================
# CAMERA REGISTRY
# ============================================================
class Camera(Base):
    __tablename__ = "cameras"

    camera_id = Column(String(50), primary_key=True, index=True)
    organization_id = Column(String(50), nullable=False)
    name = Column(String(100))
    location_name = Column(String(255))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    codec = Column(String(20))
    live = Column(Boolean, default=True)
    stream_url = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    vehicle_events = relationship("VehicleEvent", back_populates="camera", cascade="all, delete-orphan")


# ============================================================
# VEHICLE SUBSYSTEM
# ============================================================
class VehicleEvent(Base):
    __tablename__ = "vehicle_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    camera_id = Column(String(50), ForeignKey("cameras.camera_id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(50), nullable=False)
    event_type = Column(String(20), nullable=False, default="anpr")
    plate_number = Column(String(20), index=True, nullable=True)
    confidence = Column(Numeric(4, 3), nullable=False)
    pts_ms = Column(Float, nullable=False)
    speed_kmph = Column(Numeric(5, 2), nullable=True)
    speed_limit_kmph = Column(Numeric(5, 2), nullable=True)
    snapshot_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    camera = relationship("Camera", back_populates="vehicle_events")
    alerts = relationship("Alert", back_populates="event", cascade="all, delete-orphan")


class WantedVehicle(Base):
    __tablename__ = "wanted_vehicles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate_number = Column(String(20), unique=True, nullable=False, index=True)
    fir_number = Column(String(100), nullable=True)
    crime_description = Column(Text, nullable=False)
    severity = Column(String(20), default="HIGH")
    issuing_authority = Column(String(100), default="Gujarat Police")
    registered_at = Column(DateTime, default=datetime.utcnow)


class MissingVehicle(Base):
    __tablename__ = "missing_vehicles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate_number = Column(String(20), unique=True, nullable=False, index=True)
    owner_name = Column(String(100))
    vehicle_model = Column(String(100))
    report_number = Column(String(100))
    contact_number = Column(String(20))
    reported_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_id = Column(BigInteger, ForeignKey("vehicle_events.id", ondelete="CASCADE"), nullable=False)
    plate_number = Column(String(20), nullable=False, index=True)
    camera_id = Column(String(50), nullable=False)
    alert_type = Column(String(20), nullable=False)
    severity = Column(String(20), nullable=False)
    details = Column(Text, nullable=False)
    status = Column(String(20), default="ACTIVE", index=True)
    triggered_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("VehicleEvent", back_populates="alerts")


# ============================================================
# PERSON SUBSYSTEM
# ============================================================
class PersonMissing(Base):
    __tablename__ = "person_missing"

    person_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    age = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    reference_embedding = Column(Vector(512), nullable=False)
    reference_image_path = Column(Text, nullable=True)
    reported_by = Column(Text, nullable=True)
    status = Column(Text, default="active")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    matched_events = relationship("PersonEvent", back_populates="missing_person", foreign_keys="PersonEvent.matched_missing_id")
    alerts = relationship("PersonAlert", back_populates="missing_person")


class PersonWanted(Base):
    __tablename__ = "person_wanted"

    person_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    age = Column(Integer, nullable=True)
    crime_description = Column(Text, nullable=True)
    reference_embedding = Column(Vector(512), nullable=False)
    reference_image_path = Column(Text, nullable=True)
    reported_by = Column(Text, nullable=True)
    status = Column(Text, default="active")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    matched_events = relationship("PersonEvent", back_populates="wanted_person", foreign_keys="PersonEvent.matched_wanted_id")
    alerts = relationship("PersonAlert", back_populates="wanted_person")


class PersonEvent(Base):
    __tablename__ = "person_events"

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id = Column(Text, nullable=False, index=True)
    organization_id = Column(Text, nullable=False)
    pts_ms = Column(Float, nullable=False)
    detected_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    bbox = Column(JSONB, nullable=False)
    embedding = Column(Vector(512), nullable=False)
    crop_image_path = Column(Text, nullable=True)

    matched_missing_id = Column(UUID(as_uuid=True), ForeignKey("person_missing.person_id"), nullable=True)
    matched_wanted_id = Column(UUID(as_uuid=True), ForeignKey("person_wanted.person_id"), nullable=True)

    missing_person = relationship("PersonMissing", back_populates="matched_events", foreign_keys=[matched_missing_id])
    wanted_person = relationship("PersonWanted", back_populates="matched_events", foreign_keys=[matched_wanted_id])
    alerts = relationship("PersonAlert", back_populates="event", cascade="all, delete-orphan")


class PersonAlert(Base):
    __tablename__ = "person_alerts"
    __table_args__ = (
        CheckConstraint("category IN ('missing', 'wanted')", name="check_person_alert_category"),
    )

    alert_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("person_events.event_id"), nullable=True)
    missing_id = Column(UUID(as_uuid=True), ForeignKey("person_missing.person_id"), nullable=True)
    wanted_id = Column(UUID(as_uuid=True), ForeignKey("person_wanted.person_id"), nullable=True)
    category = Column(Text, nullable=False)
    camera_id = Column(Text, nullable=False)
    similarity_score = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    status = Column(Text, default="pending", index=True)

    event = relationship("PersonEvent", back_populates="alerts")
    missing_person = relationship("PersonMissing", back_populates="alerts")
    wanted_person = relationship("PersonWanted", back_populates="alerts")