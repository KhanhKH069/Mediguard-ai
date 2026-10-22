"""
MediGuard AI - Computer Vision Matcher (Mô-đun đối chiếu vỉ/hộp thuốc)
Phân loại 3 trạng thái an toàn:
1. MATCHED: Phù hợp trong phạm vi kiểm tra
2. MISMATCH: Không khớp
3. LOW_CONFIDENCE: Chưa đủ độ tin cậy (chuyển người thân xác minh bằng mắt thường)
"""

import cv2
from pathlib import Path
from app.vision.preprocessor import evaluate_image_quality

def match_medication_images(captured_path: Path, reference_path: Path) -> dict:
    """
    So khớp ảnh vỉ/hộp thuốc chụp từ camera với ảnh tham chiếu đã xác minh.
    """
    # 1. Kiểm tra ảnh tham chiếu
    if not reference_path or not reference_path.exists():
        return {
            "cv_status": "LOW_CONFIDENCE",
            "score": 0.0,
            "message": "Chưa có ảnh mẫu tham chiếu được xác minh. Chuyển người chăm sóc kiểm tra thủ công."
        }

    # 2. Kiểm tra chất lượng ảnh chụp
    quality = evaluate_image_quality(captured_path)
    if not quality["is_usable"]:
        return {
            "cv_status": "LOW_CONFIDENCE",
            "score": 0.25,
            "message": f"Chưa đủ độ tin cậy: {quality['reason']}. Đã gửi ảnh cho người thân xem trực tiếp."
        }

    img_cap = cv2.imread(str(captured_path))
    img_ref = cv2.imread(str(reference_path))

    if img_cap is None or img_ref is None:
        return {
            "cv_status": "LOW_CONFIDENCE",
            "score": 0.0,
            "message": "Lỗi đọc file ảnh. Cần xác minh thủ công."
        }

    # 3. Chuẩn hóa và so khớp màu sắc (HSV Histogram Correlation)
    cap_resized = cv2.resize(img_cap, (250, 250))
    ref_resized = cv2.resize(img_ref, (250, 250))

    hsv_cap = cv2.cvtColor(cap_resized, cv2.COLOR_BGR2HSV)
    hsv_ref = cv2.cvtColor(ref_resized, cv2.COLOR_BGR2HSV)

    hist_cap = cv2.calcHist([hsv_cap], [0, 1], None, [30, 32], [0, 180, 0, 256])
    hist_ref = cv2.calcHist([hsv_ref], [0, 1], None, [30, 32], [0, 180, 0, 256])

    cv2.normalize(hist_cap, hist_cap, 0, 1, cv2.NORM_MINMAX)
    cv2.normalize(hist_ref, hist_ref, 0, 1, cv2.NORM_MINMAX)

    color_score = max(0.0, float(cv2.compareHist(hist_cap, hist_ref, cv2.HISTCMP_CORREL)))

    # 4. So khớp đặc trưng hình học ORB
    orb = cv2.ORB_create(nfeatures=400)
    kp1, des1 = orb.detectAndCompute(cap_resized, None)
    kp2, des2 = orb.detectAndCompute(ref_resized, None)

    orb_score = 0.0
    if des1 is not None and des2 is not None and len(des1) > 0 and len(des2) > 0:
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        matches = sorted(matches, key=lambda x: x.distance)
        good_matches = [m for m in matches if m.distance < 60]
        orb_score = min(1.0, len(good_matches) / max(len(kp2), 10))

    # Điểm kết hợp (65% màu sắc bao bì + 35% đặc trưng hình học)
    total_score = round(0.65 * color_score + 0.35 * orb_score, 2)

    # 5. Phân loại 3 trạng thái
    if total_score >= 0.70:
        return {
            "cv_status": "MATCHED",
            "score": total_score,
            "message": "Phù hợp trong phạm vi kiểm tra: Vỉ thuốc khớp với dữ liệu mẫu đã xác minh."
        }
    elif total_score < 0.35:
        return {
            "cv_status": "MISMATCH",
            "score": total_score,
            "message": "Không khớp! Hình ảnh vỉ thuốc khác với mẫu đã lưu. Bác không nên uống vội và đợi người nhà kiểm tra."
        }
    else:
        return {
            "cv_status": "LOW_CONFIDENCE",
            "score": total_score,
            "message": "Chưa đủ độ tin cậy để đưa ra kết luận. Hệ thống đã lưu lại ảnh để người chăm sóc đối chiếu."
        }
