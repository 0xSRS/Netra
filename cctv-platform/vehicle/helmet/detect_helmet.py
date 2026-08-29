from huggingface_hub import hf_hub_download
from ultralytics import YOLO

# Download weights from Hugging Face Hub
_helmet_model_path = hf_hub_download(
    repo_id="iam-tsr/yolov8n-helmet-detection",
    filename="best.pt"
)
_helmet_model = YOLO(_helmet_model_path)


def detect_helmet(img, conf_thresh: float = 0.4):
    """
    Detects riders without helmets in a BGR frame.
    Returns: {"confidence": float, "box": [x1, y1, x2, y2]} or None
    """
    results = _helmet_model.predict(
        source=img,
        conf=conf_thresh,
        verbose=False,
        device="cpu"
    )

    h, w, _ = img.shape
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            label = r.names.get(cls_id, "").lower()
            
            # Check for no-helmet violation class
            if "no_helmet" in label or "without_helmet" in label or label == "no-helmet":
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                
                return {
                    "confidence": round(float(box.conf[0]), 3),
                    "box": [x1, y1, x2, y2]
                }

    return None