from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text 

from app.database import engine, SessionLocal, Base
import app.models as models
import app.auth as auth_utils
from app.routers import (
    cameras,
    auth,
    admin,
    vehicle_events,
    person_events,
    alerts,
    vehicle_frames,
    person_frames,
)

# 1. Enable pgvector extension inside the database first
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

# 2. Auto-create all tables in Postgres/PostGIS/pgvector
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Netra CCTV Core Backend", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router)
app.include_router(cameras.router)
app.include_router(admin.router)
app.include_router(vehicle_events.router)
app.include_router(person_events.router)
app.include_router(alerts.router)
app.include_router(vehicle_frames.router)
app.include_router(person_frames.router)


@app.on_event("startup")
def bootstrap_default_admin():
    """Bootstrap a default admin if no users exist."""
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            default_admin = models.User(
                username="admin",
                hashed_password=auth_utils.hash_password("admin123"),
                department=None,
                role="admin",
            )
            db.add(default_admin)
            db.commit()
            print(
                "\n*** Created default admin account: "
                "username='admin', password='admin123'. "
                "Change/remove this after initial setup. ***\n"
            )
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "core_backend"}


@app.get("/")
def root():
    return {"status": "CCTV Platform API running", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)