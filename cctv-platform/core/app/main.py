from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
import app.models  # Ensures all SQLAlchemy models are registered
from app.routers import vehicle_events, alerts

# Auto-create all tables in Postgres/PostGIS if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Netra CCTV Core Backend", version="1.0.0")

# Enable CORS for GIS Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Subsystem Routers
app.include_router(vehicle_events.router)
app.include_router(alerts.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "core_backend"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)