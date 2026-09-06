import os
import cv2
import easyocr
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

HF_TOKEN = os.getenv("HF_TOKEN")

# Download YOLO weights
_model_path = hf_hub_download(
    repo_id="Koushim/yolov8-license-plate-detection",
    filename="best.pt",
    token=HF_TOKEN
)

_plate_model = YOLO(_model_path)
_reader = easyocr.Reader(['en'])


def detect_plates(img, conf_thresh: float = 0.4, device: str = "cpu"):
    """Detect license plates in an image and return bounding boxes."""
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
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            if x2 > x1 and y2 > y1:
                boxes.append([x1, y1, x2, y2])

    return boxes


def read_plate(img, conf_thresh: float = 0.4, device: str = "cpu"):
    """
    Detect plates and run OCR on them.
    Returns: List of recognized plate texts.
    """
    boxes = detect_plates(img, conf_thresh, device)
    plate_texts = []

    for (x1, y1, x2, y2) in boxes:
        cropped = img[y1:y2, x1:x2]
        if cropped.size > 0:
            results = _reader.readtext(cropped)
            texts = [res[1] for res in results]
            if texts:  # <-- must indent the next line
                plate_texts.append(" ".join(texts).strip())

    return plate_texts
