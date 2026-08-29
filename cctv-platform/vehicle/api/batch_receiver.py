import base64
from typing import List
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from workers.worker_pool import BatchTracker, submit_frame

app = FastAPI(title="Vehicle AI Processing Service")


class FrameItem(BaseModel):
    camera_id: str
    organization_id: str
    pts_ms: float
    width: int
    height: int
    format: str
    frame: str  # Base64-encoded JPEG bytes


class BatchRequest(BaseModel):
    frames: List[FrameItem]


@app.post("/process")
async def process_batch(payload: BatchRequest):
    if not payload.frames:
        return {"status": "Completed"}

    tracker = BatchTracker(total=len(payload.frames))

    for item in payload.frames:
        try:
            # Decode Base64 string to raw JPEG buffer
            raw_bytes = base64.b64decode(item.frame)
            np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if img is None:
                raise ValueError("cv2.imdecode returned None")
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to decode frame for camera {item.camera_id}: {str(e)}"
            )

        submit_frame(
            img=img,
            camera_id=item.camera_id,
            organization_id=item.organization_id,
            pts_ms=item.pts_ms,
            tracker=tracker
        )

    # Await worker pool processing across threads
    await tracker.wait_all_done()
    return {"status": "Completed"}