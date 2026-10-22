from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from app.database import get_db
from app.config import REF_IMAGES_DIR
from app.models.medication import Medication
from app.schemas.medication import MedicationCreate, MedicationResponse

router = APIRouter(prefix="/api/medications", tags=["Medications"])

@router.get("/", response_model=list[MedicationResponse])
def list_medications(elder_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Medication).filter(Medication.is_active == True)
    if elder_id:
        query = query.filter(Medication.elder_id == elder_id)
    return query.all()

@router.post("/", response_model=MedicationResponse)
def create_medication(med: MedicationCreate, db: Session = Depends(get_db)):
    db_med = Medication(**med.model_dump())
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
async def upload_reference_image(med_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Không tìm thấy thuốc")

    ext = Path(file.filename).suffix or ".jpg"
    filename = f"ref_med_{med_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = REF_IMAGES_DIR / filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    med.reference_image = str(dest_path)
    db.commit()

    return {"message": "Đã lưu ảnh mẫu tham chiếu thành công", "image_path": filename}

@router.delete("/{med_id}")
def delete_medication(med_id: int, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Không tìm thấy thuốc")
    
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

