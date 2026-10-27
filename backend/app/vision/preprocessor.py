from pathlib import Path
from typing import Optional
import uuid
import cv2
import numpy as np

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def validate_image_extension(filename: Optional[str]) -> str:
    """Validate and return a safe lowercase image extension."""
    ext = Path(filename or "upload.jpg").suffix.lower()
    if not ext:
        ext = ".jpg"
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Định dạng file '{ext}' không được hỗ trợ. Chỉ chấp nhận: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}"
        )
    return ext


def preprocess_pill_image(image_path: str, target_size=(256, 256)) -> Optional[np.ndarray]:
    """
    Tiền xử lý ảnh viên thuốc:
    - Đọc ảnh từ đường dẫn
    - Chuyển về kích thước chuẩn
    - Khử nhiễu Gaussian Blur nhẹ
    """
    path = Path(image_path)
    if not path.exists():
        return None

    try:
        data = np.frombuffer(path.read_bytes(), dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception:
        img = cv2.imread(str(path))
    if img is None:
        return None

    resized = cv2.resize(img, target_size, interpolation=cv2.INTER_AREA)
    blurred = cv2.GaussianBlur(resized, (5, 5), 0)
    return blurred


def save_upload_temp(file_bytes: bytes, upload_dir: Path, filename: str = "upload.jpg") -> Path:
    """Lưu file upload vào thư mục chỉ định với tên file an toàn."""
    ext = validate_image_extension(filename)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"scan_{uuid.uuid4().hex[:10]}{ext}"
    out_path = upload_dir / safe_name
    out_path.write_bytes(file_bytes)
    return out_path
