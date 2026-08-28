import os
from ultralytics import YOLO

_model = YOLO(os.path.join(os.path.dirname(__file__), "helmet_detector.pt"))

# adjust class names/indices to match whatever dataset the weights were trained on
_NO_HELMET_CLASS = "without helmet"

def detect_helmet(img, conf_threshold=0.4):
    results = _model(img, verbose=False)[0] #type:ignore
    for box in results.boxes: #type:ignore
        cls_name = _model.names[int(box.cls[0])]
        if cls_name == _NO_HELMET_CLASS and box.conf[0] >= conf_threshold:
            return {"confidence": float(box.conf[0])}
    return None