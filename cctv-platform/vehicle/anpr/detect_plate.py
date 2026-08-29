from huggingface_hub import hf_hub_download
from ultralytics import YOLO

# Download weights from Hugging Face Hub (avoids Git LFS pointer issues)
_model_path = hf_hub_download(
    repo_id="Koushim/yolov8-license-plate-detection",
    filename="best.pt"
)
_plate_model = YOLO(_model_path)


def detect_plates(img, conf_thresh: float = 0.4):
    """
    Runs YOLOv8 plate detection on a BGR image.
    Returns: List of bounding boxes [[x1, y1, x2, y2], ...]
    """
    results = _plate_model.predict(
        source=img,
        conf=conf_thresh,
        verbose=False,
        device="cpu"
    )

    boxes = []
    h, w, _ = img.shape

    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            # Clamp coordinates to frame boundaries
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            if x2 > x1 and y2 > y1:
                boxes.append([x1, y1, x2, y2])

    return boxes