import os
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

# Load Hugging Face token from environment
HF_TOKEN = os.getenv("HF_TOKEN")

# Download YOLO weights from Hugging Face Hub
_model_path = hf_hub_download(
    repo_id="Koushim/yolov8-license-plate-detection",
    filename="best.pt",
    token=HF_TOKEN
)

# Initialize YOLO model
_plate_model = YOLO(_model_path)


def detect_plates(img, conf_thresh: float = 0.4, device: str = "cpu"):
    """
    Runs YOLOv8 plate detection on a BGR image.
    Returns: List of bounding boxes [[x1, y1, x2, y2], ...]
    """
    results = _plate_model.predict(
        source=img,
        conf=conf_thresh,
        verbose=False,
        device=device
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
