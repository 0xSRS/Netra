import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()   # reads core/.env if present; harmless no-op if it doesn't exist

# PostgreSQL connection. Reads from the DATABASE_URL environment variable so
# each teammate/environment (local dev, a teammate's machine, a deployment
# server) can point at their own Postgres instance without editing code.
#
# Format: postgresql://<user>:<password>@<host>:<port>/<database>
#
# If DATABASE_URL isn't set, falls back to a standard local default that
# matches the docker-compose.yml in this repo (postgres/postgres on
# localhost:5432, database "cctv_platform").
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/cctv_platform",
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
