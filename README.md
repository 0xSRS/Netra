# 🛰️ Netra
### Unified CCTV Intelligence Platform for Smart Policing

**Built for the Gujarat Police Hackathon**
*Problem Statement: Integration of Independent CCTV Networks of Various Government Departments*

---

## 📌 The Problem

Gujarat's 26+ government departments each run their **own isolated CCTV networks** — traffic police, municipal corporations, transport, and more — with no shared registry, no common viewing layer, and no way to correlate a single event (a stolen vehicle, a missing person) across camera silos. An officer investigating a case today has to manually call each department, one at a time, and hope someone remembers which cameras cover which road.

**Netra** ("नेत्र" — *eye*) is our answer: a **single pane of glass** that maps every camera in the state, ingests live feeds, and runs real-time AI analytics — vehicle recognition and person recognition — so that a suspicious vehicle or a missing person can be traced across the *entire* network instead of one department at a time.

---

## 🎯 What Netra Does

| Capability | Description |
|---|---|
| 🗺️ **Centralized Camera Registry & GIS Map** | Every camera — regardless of which department owns it — is registered once with its location, department, status, and stream URLs, and plotted live on an interactive map of Gujarat. |
| 📡 **Live Multi-Protocol Ingestion** | Pulls live video over RTSP (WebRTC/HLS supported per-camera), decodes it, and streams sampled frames into the analytics pipeline — coping with flaky feeds, mixed codecs, and stream drops without falling over. |
| 🚗 **Vehicle Intelligence (ANPR)** | Detects and reads number plates in real time, estimates vehicle speed, and flags helmetless riders — automatically. |
| 🔍 **Vehicle Tracking Across Cameras** | Search a plate number and see every camera it was spotted on, in order — reconstructing a vehicle's path across the city/state instead of scrubbing through footage manually. |
| 🙂 **Face Recognition & Watchlist Alerts** | Detects faces in live frames, embeds them, and checks them against **missing-person** and **wanted-person** watchlists — raising an instant, de-duplicated alert on a match. |
| 🖼️ **Photo-Based Person Search** | Upload a single photo of a person and retrieve every past sighting of them across the camera network, with camera + timestamp. |
| 🚨 **Live Alert Feed** | Vehicle and person alerts stream to the command dashboard in real time over WebSockets and drop a live pin on the map. |
| 🔐 **Role-Based Access** | Admin-provisioned accounts (no public sign-up), JWT-secured — so access mirrors real chain-of-command control. |

---

## 🏗️ Architecture

Netra is built as **independent microservices** that communicate over HTTP, so each AI capability (vehicle, face) can be developed, scaled, and deployed separately from the ingestion and the core backend.

```
                                   ┌─────────────────────────┐
                                   │   26 Dept. CCTV Feeds    │
                                   │  (RTSP / WebRTC / HLS)   │
                                   └────────────┬─────────────┘
                                                │
                                   ┌────────────▼─────────────┐
                                   │     INGESTION SERVICE     │
                                   │  decode → sample (~5fps)  │
                                   │  → per-camera buffer      │
                                   │  → batch (4 frames)       │
                                   │  → JPEG encode → dispatch │
                                   └──────┬─────────────┬──────┘
                                          │             │
                         same batch sent to both, in parallel
                                          │             │
                         ┌────────────────▼──┐     ┌────▼──────────────┐
                         │  VEHICLE AI (9001)  │     │  PERSON AI (8001)  │
                         │  • ANPR (YOLOv8)     │     │  • Face detection  │
                         │  • Plate OCR          │     │  • 512-d embedding │
                         │  • Speed estimation    │     │  • Watchlist match │
                         │  • Helmet detection     │     │  • Alert cooldown  │
                         └──────────┬──────────────┘     └──────────┬─────────┘
                                    │                                │
                                    └───────────────┬────────────────┘
                                                     │
                                        ┌────────────▼─────────────┐
                                        │     CORE BACKEND (8000)   │
                                        │  FastAPI + PostgreSQL /   │
                                        │  PostGIS + pgvector       │
                                        │  • Camera registry & auth │
                                        │  • Vehicle/person events  │
                                        │  • Watchlists & alerts    │
                                        │  • Live WebSocket push    │
                                        └────────────┬──────────────┘
                                                     │
                                        ┌────────────▼─────────────┐
                                        │   REACT + LEAFLET GIS UI  │
                                        │  Map · Live View · Alerts │
                                        │  Admin Panel · Search     │
                                        └───────────────────────────┘
```

**Why this shape works for a state-scale rollout:**
- The **Ingestion service** is deliberately dumb and fast — it never runs ML or touches a database, so it can be horizontally scaled per district/department without touching the AI services.
- **Vehicle AI** and **Person AI** are fully independent FastAPI services that receive the *same* frame batch and process it in parallel — a slowdown or crash in one never blocks the other (backpressure is handled with bounded per-destination queues, and a stalled AI service simply has its batches dropped, not queued indefinitely).
- The **Core backend** is the only service that talks to Postgres — it owns the camera registry (with PostGIS-ready location data), watchlists, alerts, and auth, and exposes a single REST + WebSocket surface to the frontend.
- **pgvector** lets face-embedding similarity search (watchlist matching, "find this person" search) run as a native SQL query instead of a separate vector database.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Core Backend** | FastAPI, SQLAlchemy, PostgreSQL + PostGIS + pgvector, PyJWT, Passlib/bcrypt, WebSockets |
| **Ingestion Pipeline** | Python, OpenCV/FFmpeg (RTSP over TCP), asyncio, httpx |
| **Vehicle AI** | YOLOv8 (Ultralytics) for plate & helmet detection, EasyOCR for plate reading, custom frame-delta speed estimation |
| **Person AI** | InsightFace (buffalo_l) for face detection & 512-d embeddings, PostgreSQL + pgvector for similarity search |
| **Frontend** | React 18, Vite, Leaflet / React-Leaflet for the GIS map |
| **Infra** | Docker & Docker Compose (Postgres/PostGIS/pgvector container), `.env`-driven config per service |
| **Data formats** | JSON over REST, base64-encoded JPEG batches between Ingestion and the AI services |

---

## 📂 Repository Structure

```
cctv-platform/
├── core/            # FastAPI backend — auth, camera registry, events, watchlists, alerts, WebSocket
├── ingestion/        # RTSP ingestion pipeline — decode, sample, batch, dispatch to AI services
├── vehicle/           # Vehicle AI service — ANPR, OCR, speed estimation, helmet detection
├── person/             # Person AI service — face detection, embeddings, watchlist matching, search
├── gis/frontend/        # React + Leaflet command dashboard (map, live view, alerts, admin panel)
├── data/                 # Sample cameras, users, and watchlist CSVs for demo/testing
├── docker-compose.yml     # Spins up the PostGIS + pgvector database
└── Dockerfile              # Postgres image with PostGIS + pgvector extensions
```

---

## 🚀 How to Use It

### 1. Start the database
```bash
cd cctv-platform
docker compose up -d
```
This brings up PostgreSQL with PostGIS and pgvector on `localhost:5432` (`netra_cctv` / `netra_user` / `netra_password`).

### 2. Start the Core backend
```bash
cd core
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # set DATABASE_URL to point at the container above
uvicorn app.main:app --reload --port 8000
```
On first boot, a default admin (`admin` / `admin123`) is created automatically — **change this immediately** for anything beyond a demo. The Core service also exposes the camera catalogue at `GET /api/ingest`, which the ingestion service polls.

### 3. Start the Ingestion service
```bash
cd ingestion
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # point CATALOGUE_BASE_URL at Core, VEHICLE_AI_URL/FACE_AI_URL at the services below
python main.py
```

### 4. Start Vehicle AI
```bash
cd vehicle
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py    # serves on port 9001
```

### 5. Start Person AI
```bash
cd person
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # shares DATABASE_URL with Core (person_* tables), set CORE_ALERT_URL
uvicorn main:app --reload --port 8001
```
(`insightface` needs build tools — `python3-dev build-essential cmake` on Linux, Xcode command-line tools on macOS. Face model weights download automatically on first run.)

### 6. Start the dashboard
```bash
cd gis/frontend
npm install
npm run dev
```
Log in with the admin account, add cameras (or bulk-import from `data/sample_cameras.csv`), populate a watchlist, and watch live alerts land on the map.

> **Note:** Camera feeds, plate-detection weights, and helmet-detection weights are pulled from public sources on first run and require internet access once during setup.

---

## 📊 Scalability & Future Roadmap

Netra was built hackathon-fast, but the microservice split was chosen specifically so it can grow into a real state-wide deployment:

- **Horizontal scaling of ingestion** — each district or department's cameras can run on their own ingestion instance, all feeding the same Vehicle AI / Person AI pool, instead of one process handling all 26 departments.
- **GPU-backed AI workers** — Vehicle AI and Person AI are already stateless FastAPI services with internal worker pools; they can be containerized and scaled behind a load balancer or moved to a GPU inference cluster as camera count grows from tens to thousands.
- **Government database integration** — the problem statement calls for real-time cross-checks against **VAHAN, SARTHI, eGujCop, AFIS, and NAFIS**. The current watchlist model (missing/wanted persons & vehicles) is designed to be extended with connectors to these systems once API access is available, turning a plate/face match into an instant multi-database identity check.
- **Retention & storage policy** — face crops are stored (not full frames), and unmatched sightings auto-expire (48h retention job) — a pattern that can be tuned per state data-retention policy to control storage costs at scale.
- **Federated onboarding** — since departments keep owning their physical cameras, onboarding new departments is a registry entry, not a network migration — making a phased, department-by-department rollout realistic rather than a big-bang integration.

### Feasibility

- **Low integration friction**: departments don't need to change their existing camera hardware — only expose an RTSP/WebRTC/HLS stream and register it, which matches how most existing CCTV infrastructure already works.
- **Commodity components**: the entire stack runs on open-source software (FastAPI, PostgreSQL, YOLOv8, InsightFace, React) — no proprietary VMS licensing costs, and the DB layer (Postgres + PostGIS + pgvector) avoids needing a separate GIS database or vector database.
- **Incremental rollout**: the registry + map (Model 1) delivers value on day one, even before every department's AI pipeline is fully wired in, so adoption doesn't have to wait for the full analytics stack.
- **Known constraints**: real-time analytics at true state scale will need GPU inference infrastructure and careful bandwidth planning for RTSP backhaul from remote cameras — both solvable with cloud/edge GPU deployment and adaptive frame-sampling, but out of scope for this hackathon build.

---

## ⚠️ Hackathon Prototype Disclaimer

This project was built for a hackathon evaluation environment (~50 demo cameras) and prioritizes demonstrating the end-to-end pipeline — camera onboarding → live ingestion → AI analytics → GIS visualization → alerting — over production hardening. Default credentials, sample data, and simplified speed/plate calibration are meant to be replaced before any real deployment.

---

**Made with ⚡ for the Gujarat Police Hackathon Innovation Challenge**
