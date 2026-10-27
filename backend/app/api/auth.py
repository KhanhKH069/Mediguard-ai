from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Role
from app.core.security import verify_password, get_password_hash, create_access_token, verify_kiosk_pin

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "ELDER"
    phone_number: Optional[str] = None

class PinVerifyRequest(BaseModel):
    pin: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    full_name: str
    role: str
    username: str

class UserProfileResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    phone_number: Optional[str] = None

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username.strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác"
        )
    token = create_access_token(data={"sub": user.username, "role": user.role, "user_id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "username": user.username
    }

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    cleaned_username = req.username.strip()
    if not cleaned_username or not req.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu")
    
    existing = db.query(User).filter(User.username == cleaned_username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên đăng nhập này đã được sử dụng")

    role = (req.role or "ELDER").strip().upper()
    if role not in Role.ALL:
        role = Role.ELDER

    new_user = User(
        username=cleaned_username,
        full_name=req.full_name.strip() or cleaned_username,
        hashed_password=get_password_hash(req.password),
        role=role,
        phone_number=req.phone_number
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.username, "role": new_user.role, "user_id": new_user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "full_name": new_user.full_name,
        "role": new_user.role,
        "username": new_user.username
    }

@router.get("/elders", response_model=List[UserProfileResponse])
def get_elders(db: Session = Depends(get_db)):
    """Trả về danh sách riêng người cao tuổi để người thân chọn hồ sơ quản lý."""
    elders = db.query(User).filter(User.role == Role.ELDER, User.is_active == True).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "phone_number": u.phone_number
        }
        for u in elders
    ]

@router.get("/users", response_model=List[UserProfileResponse])
def get_users(db: Session = Depends(get_db)):
    """Trả về danh sách tài khoản đã có để tiện chọn nhanh khi đăng nhập."""
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "phone_number": u.phone_number
        }
        for u in users
    ]

@router.post("/verify-pin")
def verify_pin(req: PinVerifyRequest):
    """
    Xác thực mã PIN 4 số trên màn hình Kiosk để người nhà truy cập
    chế độ cấu hình mà không cần đăng nhập lại tài khoản.
    """
    is_valid = verify_kiosk_pin(req.pin)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mã PIN không đúng")
    return {"success": True, "message": "Xác thực mã PIN thành công"}

