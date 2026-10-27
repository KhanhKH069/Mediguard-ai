from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from app.database import get_db
from app.config import REF_IMAGES_DIR
from app.models.medication import Medication
from app.models.user import User, Role
from app.schemas.medication import MedicationCreate, MedicationResponse
from app.core.security import get_current_user, require_elder_access

router = APIRouter(prefix="/api/medications", tags=["Medications"])

@router.get("/", response_model=List[MedicationResponse])
def list_medications(
    elder_id: Optional[int] = Query(None, description="ID người cao tuổi cần xem danh mục thuốc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách các loại thuốc theo người cao tuổi.
    Bảo vệ RBAC/IDOR:
    - ELDER chỉ xem thuốc của chính mình.
    - CAREGIVER chỉ xem thuốc của người cao tuổi đã liên kết.
    - ADMIN xem được toàn bộ hoặc lọc theo elder_id.
    """
    if current_user.role == Role.ELDER:
        if elder_id is not None and elder_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không có quyền truy cập dữ liệu của người cao tuổi này"
            )
        target_elder_id = current_user.id
        return db.query(Medication).filter(
            Medication.elder_id == target_elder_id,
            Medication.is_active == True
        ).all()

    if current_user.role == Role.CAREGIVER:
        if elder_id is not None:
            require_elder_access(elder_id, current_user)
            return db.query(Medication).filter(
                Medication.elder_id == elder_id,
                Medication.is_active == True
            ).all()
        assigned_ids = [e.id for e in current_user.assigned_elders]
        return db.query(Medication).filter(
            Medication.elder_id.in_(assigned_ids),
            Medication.is_active == True
        ).all()

    if current_user.role == Role.ADMIN:
        query = db.query(Medication).filter(Medication.is_active == True)
        if elder_id is not None:
            query = query.filter(Medication.elder_id == elder_id)
        return query.all()

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Vai trò người dùng không hợp lệ"
    )

@router.post("/", response_model=MedicationResponse)
def create_medication(
    med: MedicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Tạo thông tin thuốc mới cho người cao tuổi.
    Kiểm tra IDOR và quan hệ liên kết người chăm sóc - người cao tuổi.
    """
    data = med.model_dump()
    target_elder_id = data.get("elder_id")

    if current_user.role == Role.ELDER:
        if target_elder_id is not None and target_elder_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Người cao tuổi chỉ có thể quản lý thuốc của chính mình"
            )
        data["elder_id"] = current_user.id
        target_elder_id = current_user.id
    elif current_user.role in [Role.CAREGIVER, Role.ADMIN]:
        if not target_elder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thiếu ID người cao tuổi (elder_id)"
            )
        require_elder_access(target_elder_id, current_user)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vai trò không được phép tạo thuốc"
        )

    # Đảm bảo elder tồn tại trong DB
    elder = db.query(User).filter(User.id == target_elder_id).first()
    if not elder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người cao tuổi")

    db_med = Medication(**data)
    db.add(db_med)
    db.commit()
    db.refresh(db_med)
    
    # Phát sự kiện cập nhật tức thời qua WebSocket
    try:
        from app.api.websocket import broadcast_sync
        broadcast_sync("schedule_updated", {
            "action": "medication_created",
            "med_id": db_med.id,
            "elder_id": db_med.elder_id
        })
    except Exception:
        pass

    return db_med

@router.post("/{med_id}/upload-reference-image")
async def upload_reference_image(
    med_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Tải ảnh mẫu tham chiếu cho thuốc. Yêu cầu quyền sở hữu hoặc liên kết chăm sóc.
    """
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Không tìm thấy thuốc")

    require_elder_access(med.elder_id, current_user)

    ext = (Path(file.filename or "").suffix or ".jpg").lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Định dạng tệp hình ảnh không được hỗ trợ")

    filename = f"ref_med_{med_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = (REF_IMAGES_DIR / filename).resolve()

    # Đảm bảo không path traversal
    if REF_IMAGES_DIR.resolve() not in dest_path.parents:
        raise HTTPException(status_code=400, detail="Đường dẫn lưu tệp không hợp lệ")

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    med.reference_image = filename
    db.commit()

    return {"message": "Đã lưu ảnh mẫu tham chiếu thành công", "image_path": filename}

@router.delete("/{med_id}")
def delete_medication(
    med_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xóa/vô hiệu hóa thuốc khỏi danh mục. Yêu cầu quyền sở hữu hoặc liên kết chăm sóc.
    """
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Không tìm thấy thuốc")
    
    require_elder_access(med.elder_id, current_user)

    elder_id = med.elder_id
    med.is_active = False
    db.commit()

    # Phát sự kiện đồng bộ thời gian thực để các màn hình tự động làm mới
    try:
        from app.api.websocket import broadcast_sync
        broadcast_sync("schedule_updated", {
            "action": "medication_deleted",
            "med_id": med_id,
            "elder_id": elder_id
        })
    except Exception:
        pass

    return {"message": "Đã xóa thuốc khỏi danh mục thành công", "id": med_id}
