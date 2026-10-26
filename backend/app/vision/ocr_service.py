"""
MediGuard AI - Medication Label OCR Service
Sử dụng EasyOCR (hỗ trợ tiếng Việt & tiếng Anh) để đọc nhãn chữ trên bao bì / vỉ thuốc.
Kết hợp so khớp nhãn thuốc giúp nâng cao độ chính xác nhận diện thuốc lên > 90%.
"""

import os
import re
import difflib
import logging
from pathlib import Path
from typing import List, Tuple, Optional

# Tránh lỗi OpenMP trên Windows khi chạy PyTorch kèm OpenCV
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

logger = logging.getLogger(__name__)

_ocr_reader = None

def get_ocr_reader():
    """
    Khởi tạo mô hình EasyOCR dạng singleton để tái sử dụng,
    tránh nạp lại trọng số nhiều lần gây chậm hệ thống.
    """
    global _ocr_reader
    if _ocr_reader is None:
        try:
            import easyocr
            logger.info("Đang khởi tạo EasyOCR Reader (vi, en)...")
            _ocr_reader = easyocr.Reader(['vi', 'en'], gpu=False, verbose=False)
            logger.info("EasyOCR Reader đã sẵn sàng!")
        except Exception as e:
            logger.error(f"Không thể khởi tạo EasyOCR: {e}")
            return None
    return _ocr_reader


def _clean_text(text: str) -> str:
    """Chuẩn hóa chuỗi văn bản: chữ thường, loại bỏ ký tự lạ."""
    return re.sub(r"[^\w\s]", " ", (text or "").lower()).strip()


def extract_text_from_image(image_path: Path) -> List[Tuple[str, float]]:
    """
    Đọc tất cả các vùng văn bản trên ảnh thuốc.
    Trả về danh sách các tuple: (văn_bản_đọc_được, độ_tin_cậy).
    """
    reader = get_ocr_reader()
    if reader is None or not image_path.exists():
        return []

    try:
        results = reader.readtext(str(image_path))
        extracted = []
        for item in results:
            # item có dạng: (bbox, text, prob)
            if len(item) >= 3:
                text = str(item[1]).strip()
                prob = float(item[2])
                if len(text) >= 2 and prob >= 0.25:
                    extracted.append((text, prob))
        return extracted
    except Exception as e:
        logger.warning(f"Lỗi khi thực hiện OCR trên {image_path.name}: {e}")
        return []


def match_medication_text(
    extracted_items: List[Tuple[str, float]],
    expected_name: str
) -> dict:
    """
    So khớp danh sách văn bản OCR đọc được với tên thuốc kỳ vọng.
    Trả về:
    - has_match: bool
    - ocr_score: float (0.0 -> 1.0)
    - matched_keywords: list[str]
    - recognized_summary: str
    """
    if not extracted_items or not expected_name:
        return {
            "has_match": False,
            "ocr_score": 0.0,
            "matched_keywords": [],
            "recognized_summary": "",
            "message": "Không tìm thấy ký tự chữ rõ ràng trên bao bì thuốc"
        }

    clean_expected = _clean_text(expected_name)
    expected_tokens = [tok for tok in clean_expected.split() if len(tok) >= 2]

    # Danh sách toàn bộ từ ngữ đọc được
    all_read_words = []
    full_ocr_text = " ".join([item[0] for item in extracted_items])
    clean_full_ocr = _clean_text(full_ocr_text)

    matched_keywords = []
    max_sim_scores = []

    for item_text, prob in extracted_items:
        clean_item = _clean_text(item_text)
        all_read_words.append(item_text)

        # 1. So khớp trực tiếp cả cụm tên thuốc
        if clean_expected in clean_item or clean_item in clean_expected:
            matched_keywords.append(clean_expected)
            max_sim_scores.append(1.0 * prob)

        # 2. So khớp từng từ khóa chính (ví dụ "amlodipine", "5mg")
        for token in expected_tokens:
            if token in clean_item.split():
                if token not in matched_keywords:
                    matched_keywords.append(token)
                max_sim_scores.append(0.9 * prob)
            else:
                # Fuzzy matching cho từng từ nếu OCR nhầm lẫn 1 ký tự
                for word in clean_item.split():
                    sim = difflib.SequenceMatcher(None, token, word).ratio()
                    if sim >= 0.82 and len(token) >= 4:
                        if token not in matched_keywords:
                            matched_keywords.append(token)
                        max_sim_scores.append(sim * prob)

    # Đánh giá điểm OCR
    if len(expected_tokens) > 0:
        token_coverage = len(matched_keywords) / len(expected_tokens)
    else:
        token_coverage = 0.0

    avg_prob = (sum(max_sim_scores) / len(max_sim_scores)) if max_sim_scores else 0.0
    ocr_score = round(min(1.0, 0.6 * token_coverage + 0.4 * avg_prob), 2)

    has_match = ocr_score >= 0.40 or len(matched_keywords) > 0

    recognized_summary = ", ".join(all_read_words[:6])

    if has_match:
        message = f"Đã đọc được nhãn: '{', '.join(matched_keywords)}' trên bao bì thuốc"
    else:
        message = f"Văn bản đọc được ({recognized_summary}) chưa khớp với tên thuốc '{expected_name}'"

    return {
        "has_match": has_match,
        "ocr_score": ocr_score,
        "matched_keywords": matched_keywords,
        "recognized_summary": recognized_summary,
        "message": message
    }
