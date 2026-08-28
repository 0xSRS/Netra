import base64
import cv2
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from workers.worker_pool import submit_frame, BatchTracker

app = FastAPI()

class Frame(BaseModel):
    camera_id: str
    organization_id: str
    pts_ms: int
    width: int
    height: int
    format: str
    frame: str  # base64-encoded raw YUV420p bytes

class Batch(BaseModel):
    frames: list[Frame]

@app.post("/vehicle/process-batch")
async def process_batch(batch: Batch):
    tracker = BatchTracker(total=len(batch.frames))
    for f in batch.frames:
        raw = base64.b64decode(f.frame)
        yuv = np.frombuffer(raw, np.uint8).reshape((f.height * 3 // 2, f.width))
        img = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR_I420)
        submit_frame(img, f.camera_id, f.organization_id, f.pts_ms, tracker)
    await tracker.wait_all_done()
    return {"status": "Completed"}