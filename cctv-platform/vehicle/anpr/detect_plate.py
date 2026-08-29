from ultralytics import YOLO

_model = YOLO("license_plate_detector.pt")  # download a pretrained LP model, or your own trained weights

def detect_plates(img, conf_threshold=0.4):
    results = _model(img, verbose=False)[0] #type:ignore
    boxes = []
    for box in results.boxes: #type:ignore
        if box.conf[0] >= conf_threshold:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            boxes.append((x1, y1, x2, y2))
    return boxes
