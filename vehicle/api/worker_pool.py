import queue
import threading
import os
import asyncio

_frame_queue = queue.Queue()
_worker_count = max(2, (os.cpu_count() or 2) - 1)


class BatchTracker:
    def __init__(self, total: int):
        self.total = total
        self.done = 0
        self.lock = threading.Lock()
        self.event = threading.Event()

    def mark_done(self):
        with self.lock:
            self.done += 1
            if self.done >= self.total:
                self.event.set()

    async def wait_all_done(self):
        await asyncio.get_event_loop().run_in_executor(None, self.event.wait)


def submit_frame(img, camera_id, organization_id, pts_ms, tracker: BatchTracker):
    _frame_queue.put((img, camera_id, organization_id, pts_ms, tracker))


def _worker_loop():
    from anpr.detect_plate import detect_plates
    from anpr.ocr_plate import read_plate
    from helmet.detect_helmet import detect_helmet
    from storage.store_event import send_event

    while True:
        img, camera_id, organization_id, pts_ms, tracker = _frame_queue.get()
        try:
            for box in detect_plates(img):
                plate_text, conf = read_plate(img, box)
                if plate_text:
                    send_event(camera_id, organization_id, "anpr", plate_text, conf, pts_ms)
            helmet_result = detect_helmet(img)
            if helmet_result:
                send_event(camera_id, organization_id, "helmet", None, helmet_result["confidence"], pts_ms)
        finally:
            tracker.mark_done()
            _frame_queue.task_done()


for _ in range(_worker_count):
    threading.Thread(target=_worker_loop, daemon=True).start()