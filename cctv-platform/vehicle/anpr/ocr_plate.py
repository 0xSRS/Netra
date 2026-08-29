import re
import cv2
import easyocr

_reader = easyocr.Reader(['en'], gpu=False)  # set gpu=True if you have CUDA available

# Indian plate format: 2 letters, 2 digits, 1-2 letters, 4 digits (e.g. GJ01AB1234)
_PLATE_PATTERN = re.compile(r'^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$')

def _preprocess(crop):
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)

def read_plate(img, box):
    x1, y1, x2, y2 = box
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return None, 0.0

    processed = _preprocess(crop)
    results = _reader.readtext(processed)
    if not results:
        return None, 0.0

    text = "".join(r[1] for r in results).upper().replace(" ", "") #type:ignore
    confidence = sum(r[2] for r in results) / len(results) #type:ignore

    if _PLATE_PATTERN.match(text):
        return text, confidence
    return None, 0.0    