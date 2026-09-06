import logging
import re
from typing import Optional, Tuple
import cv2
import easyocr
import numpy as np

logger = logging.getLogger("ocr_plate")

# Initialize EasyOCR reader once
_reader = easyocr.Reader(["en"], gpu=False)

# Indian Registration Number Formats:
# 1. Standard: 2 state letters + 1-2 district digits + 1-3 series letters + 4 digits (e.g., GJ01AB1234, DL3CAA1111)
# 2. BH Series: 2 year digits + BH + 4 digits + 1-2 letters (e.g., 22BH1234AA)
# 3. Military: Arrow/letters + 2 digits + letter + 5-6 digits
STANDARD_INDIAN_PLATE = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$")
BH_SERIES_PLATE = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")

# OCR character confusion mapping for positions where digits or letters are strictly expected
CHAR_TO_NUM = {"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1", "Z": "2", "B": "8", "S": "5", "G": "6"}
NUM_TO_CHAR = {"0": "O", "1": "I", "2": "Z", "8": "B", "5": "S", "6": "G"}


def clean_raw_string(text: str) -> str:
    """Strips spaces and non-alphanumeric characters, returning uppercase text."""
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def rectify_standard_plate(raw_text: str) -> Optional[str]:
    """
    Attempts to align and correct common OCR misreadings
    for the standard pattern: [AA][00][AAA][0000] (9-10 characters).
    """
    if len(raw_text) not in (9, 10):
        return None

    chars = list(raw_text)

    # First 2 positions MUST be state code letters (e.g., GJ, DL, MH)
    for i in (0, 1):
        if chars[i] in NUM_TO_CHAR:
            chars[i] = NUM_TO_CHAR[chars[i]]
        elif not chars[i].isalpha():
            return None

    # Last 4 positions MUST be digits
    for i in range(-4, 0):
        if chars[i] in CHAR_TO_NUM:
            chars[i] = CHAR_TO_NUM[chars[i]]
        elif not chars[i].isdigit():
            return None

    candidate = "".join(chars)
    if STANDARD_INDIAN_PLATE.match(candidate):
        return candidate

    return None


def validate_plate_number(raw_text: str) -> Optional[str]:
    """
    Validates if string matches Indian registration formats,
    applying rectification heuristics if necessary.
    """
    clean_text = clean_raw_string(raw_text)

    # 1. Direct regex match
    if STANDARD_INDIAN_PLATE.match(clean_text) or BH_SERIES_PLATE.match(clean_text):
        return clean_text

    # 2. Heuristic correction attempt
    rectified = rectify_standard_plate(clean_text)
    if rectified:
        return rectified

    return None


def read_plate(
    img: np.ndarray, 
    box: list[int], 
    min_confidence: float = 0.35
) -> Tuple[Optional[str], float]:
    """
    Extracts, preprocesses, and reads the plate crop using EasyOCR.
    Validates against Indian license plate regex before returning.

    Returns:
        (validated_plate_text, confidence) or (None, 0.0)
    """
    x1, y1, x2, y2 = box
    cropped = img[y1:y2, x1:x2]

    # Validate crop dimensions
    if cropped.size == 0 or cropped.shape[0] < 12 or cropped.shape[1] < 20:
        return None, 0.0

    # Image enhancement for OCR legibility
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    filtered = cv2.bilateralFilter(gray, d=11, sigmaColor=17, sigmaSpace=17)
    resized = cv2.resize(filtered, (0, 0), fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    # Run OCR inference
    results = _reader.readtext(resized)
    if not results:
        return None, 0.0

    raw_tokens = []
    confs = []

    for _, text, conf in results:
        cleaned = clean_raw_string(text)
        if cleaned:
            raw_tokens.append(cleaned)
            confs.append(float(conf))

    if not raw_tokens:
        return None, 0.0

    raw_combined = "".join(raw_tokens)
    avg_conf = sum(confs) / len(confs)

    # Filter out noisy or unreadable detections early
    if avg_conf < min_confidence:
        logger.debug("Discarded raw text '%s': conf %.2f < %.2f", raw_combined, avg_conf, min_confidence)
        return None, 0.0

    # Run Regex & Pattern Validation
    valid_plate = validate_plate_number(raw_combined)
    if not valid_plate:
        logger.debug("Regex validation failed for raw OCR text: '%s'", raw_combined)
        return None, 0.0

    print(f"[ANPR VALIDATED] Plate: {valid_plate} | Conf: {avg_conf:.2f} (Raw: {raw_combined})")
    return valid_plate, round(avg_conf, 3)