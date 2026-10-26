from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from datetime import datetime
from app.database import get_db
from app.config import CAPTURED_IMAGES_DIR, REF_IMAGES_DIR
from app.models.medication import Medication
from app.models.interaction_log import InteractionLog
from app.vision.matcher import match_medication_images
from app.api.websocket import broadcast_sync

router = APIRouter(prefix="/api/vision", tags=["Vision"])

@router.post("/verify")
async def verify_pill_image(
    medication_id: int = Form(...),
    schedule_id: int = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Tiếp nhận ảnh chụp vỉ/ngăn thuốc từ camera và đối chiếu với ảnh tham chiếu mẫu.
    Trả về 1 trong 3 trạng thái:
    - MATCHED: Phù hợp trong phạm vi kiểm tra
    - MISMATCH: Không khớp
    - LOW_CONFIDENCE: Chưa đủ độ tin cậy
    """
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Không tìm thấy thuốc")

    # Lưu ảnh chụp vào storage
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"cap_med_{medication_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = CAPTURED_IMAGES_DIR / filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ref_path = None
    if med.reference_image:
        candidate = Path(med.reference_image)
        if candidate.is_absolute() and candidate.exists():
            ref_path = candidate
        elif (REF_IMAGES_DIR / med.reference_image).exists():
            ref_path = REF_IMAGES_DIR / med.reference_image
        elif (REF_IMAGES_DIR / candidate.name).exists():
            ref_path = REF_IMAGES_DIR / candidate.name

    # Tiến hành đối chiếu hình ảnh kết hợp nhận diện nhãn chữ OCR
    result = match_medication_images(dest_path, ref_path, expected_name=med.name)

    # Ghi nhận sự kiện device_recorded vào nhật ký kiểm toán
    log = InteractionLog(
        schedule_id=schedule_id,
        elder_id=med.elder_id or 1,
        event_type="device_recorded",
        device_action="CAMERA_SCAN",
        cv_status=result["cv_status"],
        notes=f"CV & OCR Check ({med.name}): {result['message']} (Điểm: {result['score']})",
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()

    broadcast_sync("device_recorded", {
        "schedule_id": schedule_id,
        "medication_id": medication_id,
        "medication_name": med.name,
        "cv_status": result["cv_status"],
        "confidence_score": result["score"],
        "ocr_matched": result.get("ocr_matched", False),
        "ocr_text": result.get("ocr_text", ""),
        "timestamp": log.timestamp.isoformat()
    })

    return {
        "success": True,
        "cv_status": result["cv_status"],
        "confidence_score": result["score"],
        "message": result["message"],
        "ocr_text": result.get("ocr_text", ""),
        "ocr_matched": result.get("ocr_matched", False),
        "matched_keywords": result.get("matched_keywords", []),
        "captured_image_url": f"/storage/captured_images/{filename}"
    }
