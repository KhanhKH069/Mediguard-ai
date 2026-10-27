from pathlib import Path
from typing import Dict, Any, Optional
import cv2
import numpy as np
from app.vision.preprocessor import preprocess_pill_image
from app.config import REFERENCE_IMG_DIR


def compute_color_histogram_similarity(img1: np.ndarray, img2: np.ndarray) -> float:
    """Tính độ tương đồng màu sắc trong không gian HSV."""
    hsv1 = cv2.cvtColor(img1, cv2.COLOR_BGR2HSV)
    hsv2 = cv2.cvtColor(img2, cv2.COLOR_BGR2HSV)

    hist1 = cv2.calcHist([hsv1], [0, 1], None, [50, 60], [0, 180, 0, 256])
    hist2 = cv2.calcHist([hsv2], [0, 1], None, [50, 60], [0, 180, 0, 256])

    cv2.normalize(hist1, hist1, 0, 1, cv2.NORM_MINMAX)
    cv2.normalize(hist2, hist2, 0, 1, cv2.NORM_MINMAX)

    score = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    return float(max(0.0, min(1.0, (score + 1.0) / 2.0)))


def compute_shape_similarity(img1: np.ndarray, img2: np.ndarray) -> float:
    """Tính độ tương đồng hình dáng qua Hu Moments của đường bao viên thuốc."""
    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

    _, t1 = cv2.threshold(g1, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    _, t2 = cv2.threshold(g2, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    cnts1, _ = cv2.findContours(t1, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts2, _ = cv2.findContours(t2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if cnts1 and cnts2:
        c1 = max(cnts1, key=cv2.contourArea)
        c2 = max(cnts2, key=cv2.contourArea)
        # cv2.matchShapes trả về khoảng cách 0 cho hình đồng dạng, càng lớn càng khác biệt
        dist = cv2.matchShapes(c1, c2, cv2.CONTOURS_MATCH_I1, 0.0)
        sim = 1.0 / (1.0 + float(dist))
        return float(max(0.0, min(1.0, sim)))

    # Fallback diff nếu không tách được contour rõ rệt
    diff = cv2.absdiff(t1, t2)
    non_zero = np.count_nonzero(diff)
    similarity = 1.0 - (non_zero / float(diff.size))
    return float(max(0.0, min(1.0, similarity)))


def resolve_reference_image_Filename(med_name: Optional[str], reference_filename: Optional[str]) -> Optional[str]:
    """Giải quyết tên file ảnh mẫu từ thông tin thuốc hoặc tên thuốc."""
    if reference_filename:
        clean_name = Path(reference_filename).name
        if (REFERENCE_IMG_DIR / clean_name).exists():
            return clean_name
    if med_name:
        low = med_name.lower()
        if "amlodipine" in low or "huyết áp" in low:
            return "ref_amlodipine.jpg"
        if "panadol" in low or "paracetamol" in low or "efferalgan" in low:
            return "ref_panadol.jpg"
        if "metformin" in low or "glucophage" in low or "tiểu đường" in low:
            return "ref_metformin.jpg"
    return reference_filename


def verify_pill_image(uploaded_path: str, reference_filename: Optional[str]) -> Dict[str, Any]:
    """
    Đối chiếu ảnh viên thuốc chụp thực tế với ảnh mẫu tham chiếu.
    TUÂN THỦ NGUYÊN TẮC AN TOÀN:
    Phân loại đúng 3 trạng thái:
      - MATCHED: Phù hợp trong phạm vi kiểm tra (score >= 0.72)
      - LOW_CONFIDENCE: Chưa đủ độ tin cậy, cần người chăm sóc kiểm tra (0.45 <= score < 0.72)
      - MISMATCH: Không khớp với mẫu tham chiếu (score < 0.45)
    """
    img_uploaded = preprocess_pill_image(uploaded_path)
    if img_uploaded is None:
        return {
            "status": "LOW_CONFIDENCE",
            "confidence_score": 0.0,
            "label": "Chưa đủ độ tin cậy, cần người chăm sóc kiểm tra",
            "message": "Không thể đọc rõ ảnh vừa chụp. Vui lòng chụp lại nơi đủ ánh sáng hoặc nhờ người chăm sóc kiểm tra."
        }

    if not reference_filename:
        return {
            "status": "LOW_CONFIDENCE",
            "confidence_score": 0.5,
            "label": "Chưa đủ độ tin cậy, cần người chăm sóc kiểm tra",
            "message": "Thuốc này chưa có ảnh mẫu đối chiếu chuẩn. Bác vui lòng nhờ người chăm sóc kiểm tra trực tiếp trước khi uống."
        }

    clean_ref = Path(reference_filename).name
    ref_path = REFERENCE_IMG_DIR / clean_ref
    img_ref = preprocess_pill_image(str(ref_path))

    if img_ref is None:
        return {
            "status": "LOW_CONFIDENCE",
            "confidence_score": 0.5,
            "label": "Chưa đủ độ tin cậy, cần người chăm sóc kiểm tra",
            "message": "Chưa có ảnh mẫu đối chiếu trong kho dữ liệu. Cần người chăm sóc xác nhận trực tiếp."
        }

    color_sim = compute_color_histogram_similarity(img_uploaded, img_ref)
    shape_sim = compute_shape_similarity(img_uploaded, img_ref)
    combined_score = round(0.65 * color_sim + 0.35 * shape_sim, 2)

    if combined_score >= 0.72:
        return {
            "status": "MATCHED",
            "confidence_score": combined_score,
            "label": "Phù hợp trong phạm vi kiểm tra",
            "message": f"Màu sắc và hình dáng viên thuốc phù hợp trong phạm vi kiểm tra (Độ tương đồng: {int(combined_score * 100)}%). Bác vui lòng kiểm tra lại vỉ thuốc trước khi uống."
        }
    elif combined_score >= 0.45:
        return {
            "status": "LOW_CONFIDENCE",
            "confidence_score": combined_score,
            "label": "Chưa đủ độ tin cậy, cần người chăm sóc kiểm tra",
            "message": f"Hình ảnh chưa đủ độ tin cậy ({int(combined_score * 100)}%). Ánh sáng hoặc góc chụp chưa rõ, cần người chăm sóc kiểm tra trước khi uống."
        }
    else:
        return {
            "status": "MISMATCH",
            "confidence_score": combined_score,
            "label": "Không khớp với mẫu tham chiếu, vui lòng kiểm tra lại",
            "message": f"CẢNH BÁO: Viên thuốc chụp KHÔNG KHỚP với mẫu tham chiếu ({int(combined_score * 100)}%). Bác TẠM DỪNG uống viên này và chờ người nhà kiểm tra!"
        }


# Alias chuẩn hóa chữ thường
resolve_reference_image_filename = resolve_reference_image_Filename


def analyze_compartment_pills(
    image_path: str | Path,
    scheduled_meds: Optional[list[str]] = None
) -> Dict[str, Any]:
    """
    Phân tích ảnh chụp khay / ngăn chia thuốc:
    - Đếm số lượng viên thuốc thực tế trong ngăn
    - So sánh với danh sách thuốc được chỉ định trong đơn
    - Báo động đỏ nếu phát hiện viên thuốc lạ ngoài đơn (Off-prescription Pill)
    """
    path = Path(image_path)
    img = preprocess_pill_image(str(path))
    if img is None:
        return {
            "estimated_pill_count": 0,
            "has_off_prescription_pills": False,
            "cv_status": "LOW_CONFIDENCE",
            "safety_level": "CAN_KIEM_TRA",
            "message": "Không thể nhận diện ảnh chụp khay thuốc. Cần người chăm sóc kiểm tra trực tiếp."
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Đếm các vùng đối tượng viên thuốc (lọc nhiễu nhỏ < 150 pixel)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    pill_contours = [c for c in contours if cv2.contourArea(c) >= 150]
    estimated_count = len(pill_contours)

    expected_count = len(scheduled_meds) if scheduled_meds else 1

    if estimated_count > expected_count:
        return {
            "estimated_pill_count": estimated_count,
            "expected_count": expected_count,
            "has_off_prescription_pills": True,
            "cv_status": "MISMATCH",
            "safety_level": "NGUY_HIEM_THUOC_LA",
            "message": (
                f"🚨 CẢNH BÁO NGUY HIỂM: Phát hiện {estimated_count} viên thuốc trên khay, "
                f"trong khi đơn cữ này chỉ có {expected_count} viên ({', '.join(scheduled_meds or [])}). "
                f"Phát hiện VIÊN THUỐC LẠ NGOÀI ĐƠN! Bác tuyệt đối không uống và chờ người nhà kiểm tra ngay!"
            )
        }
    elif estimated_count == expected_count:
        return {
            "estimated_pill_count": estimated_count,
            "expected_count": expected_count,
            "has_off_prescription_pills": False,
            "cv_status": "MATCHED",
            "safety_level": "AN_TOAN",
            "message": f"Số lượng viên thuốc trên khay phù hợp với đơn ({estimated_count} viên)."
        }
    else:
        return {
            "estimated_pill_count": estimated_count,
            "expected_count": expected_count,
            "has_off_prescription_pills": False,
            "cv_status": "LOW_CONFIDENCE",
            "safety_level": "CAN_KIEM_TRA",
            "message": f"Số lượng viên thuốc trên khay ít hơn đơn ({estimated_count}/{expected_count} viên). Cần người chăm sóc kiểm tra."
        }

