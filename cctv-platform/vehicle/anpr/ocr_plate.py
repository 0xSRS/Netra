import re
import cv2
import easyocr

# Initialize EasyOCR reader for English
_reader = easyocr.Reader(['en'], gpu=False)

# Indian License Plate Regex pattern: 2 letters, 1-2 digits, 1-3 letters, 4 digits
INDIAN_PLATE_PATTERN = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$")


def preprocess_crop(crop):
    """Enhance contrast and enlarge text for better OCR extraction."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(resized)


def read_plate(img, box):
    """
    Extracts and parses text from the bounding box region.
    Returns: (plate_text, confidence) or (None, 0.0)
    """
    x1, y1, x2, y2 = box
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return None, 0.0

    processed = preprocess_crop(crop)
    results = _reader.readtext(processed)

    best_plate = None
    best_conf = 0.0

    for _, text, conf in results:
        # Strip spaces and special characters
        cleaned = re.sub(r"[^A-Za-z0-9]", "", text).upper()

        if 8 <= len(cleaned) <= 11:
            if INDIAN_PLATE_PATTERN.match(cleaned) or conf > best_conf:
                best_plate = cleaned
                best_conf = float(conf)

    return best_plate, round(best_conf, 3)