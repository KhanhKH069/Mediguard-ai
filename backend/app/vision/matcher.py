"""
MediGuard AI - Computer Vision & OCR Matcher (Mô-đun đối chiếu vỉ/hộp thuốc)
Kết hợp cả 2 cơ chế:
1. Nhận diện nhãn chữ OCR (EasyOCR - tiếng Việt & tiếng Anh)
2. So khớp đặc trưng thị giác (HSV Color Histogram + ORB Keypoints)

Phân loại 3 trạng thái an toàn:
- MATCHED: Phù hợp trong phạm vi kiểm tra
- MISMATCH: Không khớp
- LOW_CONFIDENCE: Chưa đủ độ tin cậy (chuyển người thân xác minh bằng mắt thường)
"""

import cv2
import logging
from pathlib import Path
from typing import Optional
from app.vision.preprocessor import evaluate_image_quality
from app.vision.ocr_service import extract_text_from_image, match_medication_text

logger = logging.getLogger(__name__)

def match_medication_images(
    captured_path: Path,
    reference_path: Optional[Path] = None,
    expected_name: Optional[str] = None
) -> dict:
    """
    So khớp ảnh vỉ/hộp thuốc chụp từ camera với ảnh mẫu và tên thuốc kỳ vọng.
    """
    # 1. Kiểm tra chất lượng ảnh chụp trước tiên
    quality = evaluate_image_quality(captured_path)
    if not quality["is_usable"]:
        return {
            "cv_status": "LOW_CONFIDENCE",
            "score": 0.25,
            "message": f"Chưa đủ độ tin cậy: {quality['reason']}. Đã gửi ảnh cho người thân xem trực tiếp.",
            "ocr_text": "",
            "ocr_matched": False
        }

    # 2. Thực hiện đọc nhãn chữ OCR trên ảnh chụp
    ocr_score = 0.0
    ocr_matched = False
    ocr_summary = ""
    matched_words = []

    try:
        extracted_texts = extract_text_from_image(captured_path)
        if extracted_texts:
            ocr_summary = ", ".join([t[0] for t in extracted_texts[:5]])
            if expected_name:
                ocr_eval = match_medication_text(extracted_texts, expected_name)
                ocr_score = ocr_eval.get("ocr_score", 0.0)
                ocr_matched = ocr_eval.get("has_match", False)
                matched_words = ocr_eval.get("matched_keywords", [])
    except Exception as e:
        logger.warning(f"Lỗi khi thực hiện OCR: {e}")

    # 3. Đọc dữ liệu ảnh để so khớp thị giác
    img_cap = cv2.imread(str(captured_path))
    if img_cap is None:
        return {
            "cv_status": "LOW_CONFIDENCE",
            "score": 0.0,
            "message": "Lỗi đọc file ảnh chụp. Cần xác minh thủ công.",
            "ocr_text": ocr_summary,
            "ocr_matched": False
        }

    has_valid_ref = reference_path and reference_path.exists()
    visual_score = 0.0
    color_score = 0.0
    orb_score = 0.0

    if has_valid_ref:
        img_ref = cv2.imread(str(reference_path))
        if img_ref is not None:
            # 3.1. Chuẩn hóa kích thước
            cap_resized = cv2.resize(img_cap, (250, 250))
            ref_resized = cv2.resize(img_ref, (250, 250))

            # 3.2. So khớp màu sắc HSV
            hsv_cap = cv2.cvtColor(cap_resized, cv2.COLOR_BGR2HSV)
            hsv_ref = cv2.cvtColor(ref_resized, cv2.COLOR_BGR2HSV)

            hist_cap = cv2.calcHist([hsv_cap], [0, 1], None, [30, 32], [0, 180, 0, 256])
            hist_ref = cv2.calcHist([hsv_ref], [0, 1], None, [30, 32], [0, 180, 0, 256])

            cv2.normalize(hist_cap, hist_cap, 0, 1, cv2.NORM_MINMAX)
            cv2.normalize(hist_ref, hist_ref, 0, 1, cv2.NORM_MINMAX)

            color_score = max(0.0, float(cv2.compareHist(hist_cap, hist_ref, cv2.HISTCMP_CORREL)))

            # 3.3. So khớp đặc trưng hình học ORB
            orb = cv2.ORB_create(nfeatures=400)
            kp1, des1 = orb.detectAndCompute(cap_resized, None)
            kp2, des2 = orb.detectAndCompute(ref_resized, None)

            if des1 is not None and des2 is not None and len(des1) > 0 and len(des2) > 0:
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
                matches = bf.match(des1, des2)
                matches = sorted(matches, key=lambda x: x.distance)
                good_matches = [m for m in matches if m.distance < 60]
                orb_score = min(1.0, len(good_matches) / max(len(kp2), 10))

            visual_score = round(0.65 * color_score + 0.35 * orb_score, 2)

    # 4. TỔNG HỢP ĐIỂM (FUSION SCORE)
    # Kết hợp độ tin cậy từ OCR (nhãn chữ) và Visual (màu sắc + ORB)
    if ocr_matched and matched_words:
        # Nếu đọc được chính xác nhãn chữ thuốc
        if has_valid_ref:
            # Có cả ảnh mẫu + nhãn chữ khớp -> Độ tin cậy rất cao
            total_score = round(max(0.85, 0.55 * ocr_score + 0.45 * visual_score), 2)
            cv_status = "MATCHED"
            message = (
                f"Phù hợp: Đã đọc được nhãn '{', '.join(matched_words)}' "
                f"và bao bì khớp mẫu đã lưu ({int(total_score * 100)}% tin cậy)."
            )
        else:
            # Chưa có ảnh mẫu nhưng nhãn chữ đọc được khớp với tên thuốc
            total_score = round(max(0.80, ocr_score), 2)
            cv_status = "MATCHED"
            message = f"Phù hợp nhãn thuốc: Đã nhận diện thấy chữ '{', '.join(matched_words)}' trên bao bì."

    elif has_valid_ref:
        # Không đọc được chữ (hoặc vỉ không in chữ), dựa vào thị giác
        total_score = visual_score
        if total_score >= 0.70:
            cv_status = "MATCHED"
            message = f"Phù hợp trong phạm vi kiểm tra: Hình ảnh vỉ thuốc khớp mẫu đã lưu ({int(total_score * 100)}%)."
        elif total_score < 0.35:
            cv_status = "MISMATCH"
            message = "Không khớp! Hình ảnh vỉ thuốc khác với mẫu đã lưu. Bác không nên uống vội và đợi người nhà kiểm tra."
        else:
            cv_status = "LOW_CONFIDENCE"
            message = "Chưa đủ độ tin cậy để đưa ra kết luận. Hệ thống đã lưu lại ảnh để người chăm sóc đối chiếu."

    else:
        # Không có ảnh mẫu và cũng không đọc được chữ
        total_score = 0.20
        cv_status = "LOW_CONFIDENCE"
        message = "Chưa nhận diện được nhãn thuốc và chưa có ảnh mẫu tham chiếu. Đã chuyển ảnh cho người nhà kiểm tra."

    return {
        "cv_status": cv_status,
        "score": total_score,
        "message": message,
        "ocr_text": ocr_summary,
        "ocr_matched": ocr_matched,
        "matched_keywords": matched_words,
        "visual_score": visual_score
    }
