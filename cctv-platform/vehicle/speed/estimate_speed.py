import time

# camera_id -> last seen {plate: (pixel_x, pixel_y, pts_ms)}
_last_seen = {}

# calibrate this per camera: how many real-world meters one pixel represents
_METERS_PER_PIXEL = 0.05  # placeholder — needs real calibration per camera angle/height

def estimate_speed(camera_id, plate_number, box, pts_ms):
    x1, y1, x2, y2 = box
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

    key = (camera_id, plate_number)
    prev = _last_seen.get(key)
    _last_seen[key] = (cx, cy, pts_ms)

    if prev is None:
        return None

    px, py, prev_pts = prev
    dt_seconds = (pts_ms - prev_pts) / 1000.0
    if dt_seconds <= 0:
        return None

    pixel_dist = ((cx - px) ** 2 + (cy - py) ** 2) ** 0.5
    meters = pixel_dist * _METERS_PER_PIXEL
    speed_kmph = (meters / dt_seconds) * 3.6

    return speed_kmph