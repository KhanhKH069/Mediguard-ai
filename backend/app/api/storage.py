import re
import os
import mimetypes
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import STORAGE_DIR
from app.models.user import User, Role
from app.models.medication import Medication
from app.models.schedule import Schedule
from app.models.interaction_log import InteractionLog
from app.core.security import get_current_user_flexible, security_scheme
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter(tags=["Storage"])

ALLOWED_CATEGORIES = {
    "reference_images",
    "captured_images",
    "uploaded_checks",
    "audio_cache"
}


def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Lấy người dùng hiện tại nếu có token, không ném lỗi 401 nếu thiếu (dành cho tệp âm thanh public)."""
    try:
        return get_current_user_flexible(auth=auth, token_query=token_query, db=db)
    except Exception:
        return None


def _serve_file_secure(category: str, filename: str, current_user: Optional[User], db: Session):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thư mục lưu trữ không tồn tại hoặc không được phép truy cập"
        )

    # 1. Chống Path Traversal
    if not filename or ".." in filename or "/" in filename or "\\" in filename or "\x00" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên tệp không hợp lệ (phát hiện ký tự path traversal)"
        )

    category_dir = (STORAGE_DIR / category).resolve()
    target_path = (category_dir / filename).resolve()

    if category_dir not in target_path.parents and target_path != category_dir:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đường dẫn tệp nằm ngoài thư mục cho phép"
        )

    if not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp không tồn tại"
        )

    # Tệp âm thanh TTS phục vụ đọc câu thoại cho người già -> Cho phép phát ngay lập tức
    if category == "audio_cache":
        mime_type, _ = mimetypes.guess_type(str(target_path))
        return FileResponse(path=str(target_path), media_type=mime_type or "audio/mpeg")

    # Đối với dữ liệu hình ảnh nhạy cảm của người bệnh: bắt buộc phải có tài khoản xác thực
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu xác thực tài khoản để truy cập tài nguyên hình ảnh y tế"
        )

    # 2. Phân quyền và kiểm tra IDOR tài nguyên hình ảnh
    if current_user.role == Role.ADMIN:
        # Admin có toàn quyền xem các tệp lưu trữ
        pass
    elif category == "reference_images":
        # Kiểm tra xem ảnh mẫu này thuộc thuốc hay cữ thuốc của người cao tuổi nào
        med = db.query(Medication).filter(Medication.reference_image == filename).first()
        sch = db.query(Schedule).filter(Schedule.reference_image == filename).first()

        if med:
            if not current_user.can_access_elder(med.elder_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Không có quyền truy cập tệp hình ảnh của người cao tuổi này"
                )
        elif sch:
            if not current_user.can_access_elder(sch.elder_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Không có quyền truy cập tệp hình ảnh của người cao tuổi này"
                )
        else:
            # Ảnh thuốc mẫu chung trong danh mục chuẩn (e.g. ref_amlodipine.jpg)
            # Người dùng đã đăng nhập hợp lệ được phép xem
            pass

    elif category in ["captured_images", "uploaded_checks"]:
        # Kiểm tra liên kết elder qua tên tệp hoặc nhật ký
        elder_id_match = re.search(r"elder_(\d+)", filename)
        if elder_id_match:
            elder_id = int(elder_id_match.group(1))
            if not current_user.can_access_elder(elder_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Không có quyền truy cập ảnh chụp của người cao tuổi này"
                )
        else:
            log_entry = db.query(InteractionLog).filter(InteractionLog.notes.like(f"%{filename}%")).first()
            if log_entry and log_entry.elder_id:
                if not current_user.can_access_elder(log_entry.elder_id):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Không có quyền truy cập ảnh chụp của người cao tuổi này"
                    )

    mime_type, _ = mimetypes.guess_type(str(target_path))
    return FileResponse(path=str(target_path), media_type=mime_type or "application/octet-stream")


@router.get("/storage/{category}/{filename}")
def get_storage_file(
    category: str,
    filename: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint tải/stream file an toàn từ /storage (thay thế mount StaticFiles công khai).
    Tự động hỗ trợ stream audio_cache cho audio element và phân quyền chặt chẽ các file ảnh y tế.
    """
    return _serve_file_secure(category, filename, current_user, db)


@router.get("/api/storage/{category}/{filename}")
def get_api_storage_file(
    category: str,
    filename: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Bí danh cho endpoint tải tệp qua tiền tố /api/storage/.
    """
    return _serve_file_secure(category, filename, current_user, db)
