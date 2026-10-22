"""
MediGuard AI - Vision Preprocessor (Tiền xử lý hình ảnh)
Kiểm tra chất lượng ảnh (độ nét, ánh sáng) trước khi đối chiếu để tránh kết luận sai.
"""

import cv2
import numpy as np
from pathlib import Path

def evaluate_image_quality(image_path: Path, blur_threshold: float = 60.0) -> dict:
    """
    Kiểm tra độ mờ và độ sáng của ảnh.
    Nếu ảnh quá mờ hoặc quá tối, trả về is_usable = False.
    """
    if not image_path.exists():
        return {"is_usable": False, "reason": "Không tìm thấy file hình ảnh"}

    img = cv2.imread(str(image_path))
    if img is None:
        return {"is_usable": False, "reason": "Dữ liệu hình ảnh không hợp lệ"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Đo độ nét bằng phương sai toán tử Laplacian
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    is_sharp = variance >= blur_threshold

    # 2. Đo độ sáng trung bình (0-255)
    mean_brightness = float(np.mean(gray))
    is_well_lit = 35.0 <= mean_brightness <= 235.0

    if not is_sharp:
        return {
            "is_usable": False,
            "blur_score": round(variance, 1),
            "brightness": round(mean_brightness, 1),
            "reason": f"Ảnh quá mờ (độ nét {variance:.1f} < ngưỡng {blur_threshold})"
        }

    if not is_well_lit:
        return {
            "is_usable": False,
            "blur_score": round(variance, 1),
            "brightness": round(mean_brightness, 1),
            "reason": f"Ánh sáng không đảm bảo (độ sáng trung bình: {mean_brightness:.1f})"
        }

    return {
        "is_usable": True,
        "blur_score": round(variance, 1),
        "brightness": round(mean_brightness, 1),
        "reason": "Chất lượng ảnh đạt yêu cầu để đối chiếu"
    }
