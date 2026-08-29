from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal
import models
import auth as auth_utils
from routers import cameras, auth, admin, vehicle_events, person_events, alerts, vehicle_frames, person_frames

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CCTV Integrated Video Management & Analytics Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # fine for hackathon local dev; tighten before going further
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """There's no public registration endpoint (only an admin can create
    users), so the very first admin account has to come from somewhere.
    If the users table is empty, create a default admin here once."""
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
                "\n*** No users existed — created default admin account: "
                "username='admin', password='admin123'. Log in and create "
                "real accounts via the Admin panel, then consider changing "
                "or removing this one. ***\n"
            )
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "CCTV Platform API running", "docs": "/docs"}
