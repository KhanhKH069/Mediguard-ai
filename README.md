# MEDIGUARD AI
> **Trợ lý AI hỗ trợ quản lý lịch dùng thuốc tại nhà cho người cao tuổi**
> Lĩnh vực: Voice AI, Computer Vision, An toàn y tế & IoT.

---

## 1. Nguyên Tắc An Toàn Cốt Lõi (Core Safety Principles)
1. **AI không thay thế bác sĩ/dược sĩ**: Hệ thống không đưa ra chẩn đoán, không tự đổi liều, không tự khuyên uống bù khi quên.
2. **Lưu nhật ký theo Sự kiện bất biến (Append-Only Event Log)**:
   Không dùng cờ `is_taken: bool`. Tách biệt tuyệt đối 3 trạng thái:
   - `user_responded`: Người cao tuổi đã bấm nút hoặc phản hồi bằng giọng nói.
   - `device_recorded`: Camera hoặc cảm biến hộp thuốc đã ghi nhận thao tác.
   - `caregiver_confirmed`: Người thân/người chăm sóc đã kiểm tra và xác nhận.
3. **Lịch dùng thuốc bắt buộc có xác minh (`verified_by`)**: Không ai có thể tự tạo lịch mà không có sự kiểm tra từ người chăm sóc.
4. **Computer Vision phân loại 3 trạng thái**:
   - `Phù hợp trong phạm vi kiểm tra` (Độ tin cậy cao)
   - `Không khớp` (Khác mẫu thuốc đã lưu)
   - `Chưa đủ độ tin cậy` (Ảnh mờ, thiếu sáng -> chuyển người nhà xác minh)

---

## 2. Hướng Dẫn Cài Đặt & Chạy Nhanh

### Bước 1: Chuẩn bị biến môi trường
```bash
cp .env.example .env
```
Mở file `.env` và kiểm tra cấu hình mã PIN (mặc định: `1234`), Telegram token và database URL.

### Bước 2: Chạy Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python main.py
```
Backend API & Swagger Docs sẽ chạy tại: `http://localhost:8000/docs`

### Bước 3: Chạy Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Giao diện ứng dụng chạy tại: `http://localhost:5173`

### Bước 4: Chạy Kiểm Thử An Toàn (Safety Tests)
```bash
cd backend
pytest tests/
```

---

## 3. Bản quyền & Định hướng
Dự án được xây dựng với mục tiêu nhân văn, hỗ trợ người cao tuổi Việt Nam sống vui khỏe và an tâm dùng thuốc đúng giờ.
