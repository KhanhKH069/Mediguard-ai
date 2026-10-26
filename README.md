# 🛡️ MEDIGUARD AI (v1.0 Pro)
> **Trợ Lý AI An Toàn Quản Lý Dùng Thuốc Tại Nhà Cho Người Cao Tuổi**  
> *Lĩnh vực: Healthcare AI • Voice Assistant • Multi-Modal Computer Vision & OCR • Real-Time IoT & Safety Audit*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20+%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python)](https://python.org)
[![EasyOCR](https://img.shields.io/badge/AI%20Vision-EasyOCR%20+%20OpenCV-FF6F00?style=flat-square)](https://github.com/JaidedAI/EasyOCR)
[![TTS](https://img.shields.io/badge/Voice%20AI-Microsoft%20Edge--TTS-0078D7?style=flat-square)](https://github.com/rany2/edge-tts)
[![Safety](https://img.shields.io/badge/Audit-Append--Only%20Event%20Log-4CAF50?style=flat-square)](#)
[![WCAG](https://img.shields.io/badge/Accessibility-WCAG%20AAA-blueviolet?style=flat-square)](#)

---

## 📖 1. Giới Thiệu & Bài Toán Giải Quyết

Tại Việt Nam, phần lớn người cao tuổi mắc từ 2–3 bệnh mạn tính cùng lúc (tăng huyết áp, đái tháo đường, tim mạch, thoái hóa khớp) và phải uống nhiều loại thuốc mỗi ngày (*đa thuốc - polypharmacy*). Các rủi ro thực tế thường gặp:
- **Hay quên giờ uống thuốc** hoặc uống quá trễ so với khung giờ ổn định huyết áp.
- **Nhầm lẫn giữa các vỉ thuốc** có hình dáng hoặc bao bì tương đồng.
- **Tự ý tăng liều hoặc uống bù liều gấp đôi** khi lỡ quên cữ trước, dẫn đến tụt huyết áp kịch phát hoặc ngộ độc thuốc.
- **Tương tác thuốc nguy hiểm** khi người nhà mua thêm thực phẩm chức năng hoặc thuốc giảm đau không theo đơn (ví dụ: dùng chung Ginkgo Biloba với Aspirin gây xuất huyết não/dạ dày).

**MediGuard AI** được thiết kế như một thiết bị Kiosk thông minh đặt tại gia đình kết hợp ứng dụng di động cho người thân, ứng dụng trí tuệ nhân tạo để bảo vệ toàn diện an toàn dùng thuốc cho người cao tuổi.

---

## 🏛️ 2. Kiến Trúc Hệ Thống (System Architecture)

```
                    ┌─────────────────────────────────────────────────────┐
                    │               MEDIGUARD AI PLATFORM                 │
                    └─────────────────────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌──────────────────────────────┐                       ┌──────────────────────────────┐
│     KIOSK NGƯỜI CAO TUỔI     │                       │     BẢNG ĐIỀU KHIỂN CON CHÁU │
│  (Màn hình cảm ứng + Loa)    │                       │   (Màn hình Caregiver Hub)   │
│                              │                       │                              │
│ • Đồng hồ to, WCAG AAA       │                       │ • Giám sát 3 trạng thái độc lập│
│ • Loa nhắc thuốc tự động     │                       │ • Quản lý & phê duyệt lịch   │
│ • Micro hỏi đáp AI tiếng Việt│                       │ • Rà soát tương tác thuốc AI │
│ • Camera soi vỉ thuốc (OCR)  │                       │ • Nhật ký kiểm toán y tế     │
└──────────────┬───────────────┘                       └──────────────┬───────────────┘
               │                                                      │
               │   WebSocket Đồng Bộ Tức Thời & REST API (Sub-ms)     │
               └──────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │              BACKEND FASTAPI CORE            │
               ├──────────────────────────────────────────────┤
               │ 1. Scheduler Engine: Quét lịch mỗi phút      │
               │ 2. Safety Rule Engine: Chặn uống bù, gấp đôi │
               │ 3. Multi-Modal Vision: EasyOCR + HSV + ORB   │
               │ 4. Drug-Drug Checker: Ma trận tương tác dược │
               │ 5. TTS Voice Engine: Edge-TTS tự nhiên       │
               │ 6. Telegram Notifier: Báo động khẩn cấp SOS  │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   APPEND-ONLY DATABASE       │
                       │ (users, meds, schedules,     │
                       │  interaction_logs bất biến)  │
                       └──────────────────────────────┘
```

---

## ✨ 3. Tính Năng Nổi Bật

### 👵 3.1. Kiosk Trực Quan Cho Người Cao Tuổi (WCAG AAA)
* **Đồng hồ số khổng lồ**: Hiển thị rõ ràng thời gian thực, buổi trong ngày (Sáng, Trưa, Chiều, Tối).
* **Tự động reo chuông & đọc to lời nhắc**: Scheduler chạy nền quét mỗi phút; khi đến giờ hẹn, loa Kiosk tự động phát chuông ding-dong êm ái và đọc to danh mục thuốc cần uống mà bác không cần chạm vào màn hình.
* **Giao diện 1 chạm siêu lớn**: Các nút bấm có độ tương phản cao, chữ to rõ ràng, hỗ trợ tối đa cho người mắt kém hoặc tay run.

### 👁️ 3.2. Thị Giác Máy Tính Kép (Multi-Modal Vision Fusion)
Hệ thống không chỉ dựa vào màu sắc đơn thuần mà kết hợp thuật toán đa thể thức:
* **EasyOCR (Nhận diện ký tự quang học)**: Quét và bóc tách trực tiếp tên thuốc in trên vỉ/hộp (hỗ trợ cả tiếng Việt và tiếng Anh) với thuật toán **Fuzzy Matching** (so khớp mờ).
* **Computer Vision cổ điển**: Trích xuất lược đồ màu sắc HSV Histogram (65%) kết hợp các điểm đặc trưng hình học ORB Keypoints (35%).
* **Phân loại chuẩn 3 trạng thái an toàn**:
  - `MATCHED`: Phù hợp tin cậy (khớp cả chữ in lẫn bao bì).
  - `MISMATCH`: Cảnh báo không khớp vỉ thuốc đã lưu, nhắc bác dừng lại.
  - `LOW_CONFIDENCE`: Ảnh mờ hoặc thiếu sáng, tự động chuyển về máy người thân để kiểm tra thủ công.

### 🎙️ 3.3. Trợ Lý Giọng Nói AI & Rule Engine An Toàn Y Tế
* **Hội thoại tự nhiên tiếng Việt**: Tích hợp Edge-TTS giọng đọc ấm áp, truyền cảm (`vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural`).
* **Hỏi đáp thông minh theo ngữ cảnh**: Bác chỉ cần hỏi *"Bác cần uống thuốc gì bây giờ?"*, AI sẽ tự động truy xuất đơn thuốc của đúng cữ hiện tại để trả lời.
* **Chặn đứng yêu cầu nguy hiểm**: Bộ quy tắc an toàn phát hiện và từ chối ngay các câu hỏi *"uống bù"*, *"uống gấp đôi"*, *"tăng liều"*.
* **Nhận diện triệu chứng cấp tính**: Bác nói *"Bác thấy chóng mặt, buồn nôn, tức ngực"*, hệ thống lập tức hướng dẫn bác ngồi nghỉ ngơi và kích hoạt chuông báo động gửi thông báo khẩn cấp cho gia đình.

### 💊 3.4. Hệ Thống Kiểm Tra Tương Tác Thuốc (Drug-Drug Interaction Checker)
* **Ma trận dược thư lâm sàng**: Tự động phát hiện các tương tác thuốc nguy hại phổ biến ở người cao tuổi (ví dụ: Ginkgo Biloba + Aspirin gây xuất huyết, Amlodipine + Atenolol gây nhịp tim chậm, PPI + Clopidogrel, NSAID + Thuốc hạ áp).
* **Phân cấp độ rủi ro**: Phân loại rõ `HIGH` (Nguy hiểm tính mạng), `MODERATE` (Cần chú ý), `SAFE` (Đơn thuốc an toàn).
* **Sandbox Thử Nghiệm Thuốc Mới**: Cho phép người chăm sóc gõ tên một loại thuốc mới dự định mua để hệ thống mô phỏng tương tác trước khi kê đơn thực tế.

### 🛡️ 3.5. Chuỗi 3 Trạng Thái & Nhật Ký Kiểm Toán Bất Biến (Append-Only)
* **Triết lý chống sai sót y tế**: Không dùng cờ nhị phân `is_taken: true/false`. Hệ thống ghi nhận 3 sự kiện độc lập trong chuỗi an toàn:
  1. `user_responded`: Người già xác nhận đã uống qua nút bấm hoặc giọng nói.
  2. `device_recorded`: Camera soi vỉ thuốc xác nhận đúng loại thuốc.
  3. `caregiver_confirmed`: Người thân kiểm tra và xác thực từ xa.
* **Quy tắc `verified_by`**: Mọi lịch thuốc trong hệ thống bắt buộc phải được người chăm sóc xác nhận thì Kiosk mới kích hoạt nhắc nhở.
* **Bảo vệ bằng mã PIN 4 số**: Chuyển đổi giữa chế độ Kiosk của Bác và Bảng điều khiển của Con cháu được bảo mật bằng mã PIN.

---

## 🚀 4. Hướng Dẫn Cài Đặt & Khởi Chạy

### 4.1. Yêu Cầu Môi Trường
* **Python**: 3.10 – 3.13 (Khuyến nghị dùng Anaconda hoặc Python Virtualenv).
* **Node.js**: v18.0+ và npm.
* **Hệ điều hành**: Windows 10/11, macOS, hoặc Linux.

---

### 4.2. Khởi Chạy Nhanh 1-Click (Dành cho Windows)
Trong thư mục gốc của dự án, chỉ cần nhấp đúp chuột vào file:
```cmd
run_app.bat
```
File script sẽ tự động khởi động đồng thời cả Backend FastAPI (Port 8000), Frontend React (Port 5173) và mở sẵn trình duyệt cho bạn.

---

### 4.3. Khởi Chạy Thủ Công Từng Bước

#### Bước 1: Chuẩn bị file môi trường
```bash
cp .env.example .env
```
*(File `.env` chứa cấu hình mã PIN Kiosk `1234`, SQLite database và cấu hình cổng).*

#### Bước 2: Cài đặt và chạy Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python main.py
```
> **Lưu ý trên Windows**: Nếu gặp xung đột thư viện OpenMP (`OMP: Error #15`), dự án đã tích hợp sẵn cơ chế xử lý tự động trong code. Bạn có thể chạy bằng Anaconda Python: `C:\Users\<User>\anaconda3\python.exe main.py`.

* **Backend Swagger API Docs**: `http://localhost:8000/docs`
* **Kiểm tra trạng thái Health**: `http://localhost:8000/api/health`

#### Bước 3: Cài đặt và chạy Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
* **Giao diện Kiosk & Dashboard**: `http://localhost:5173`

---

## 🔑 5. Tài Khoản Kiểm Thử Mặc Định

Cơ sở dữ liệu mẫu đã nạp sẵn 2 tài khoản để bạn trải nghiệm ngay lập tức:

| Vai trò | Tên đăng nhập | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Người chăm sóc (Con trai)** | `anh_nam` | `123456` | Quản lý lịch nhắc, xem tương tác thuốc, duyệt đơn, xem nhật ký kiểm toán. |
| **Người cao tuổi (Bác Ba)** | `ong_ba` | `123456` | Giao diện Kiosk, nghe lời nhắc tự động, soi camera vỉ thuốc, trò chuyện Voice AI. |
| **Mã PIN Kiosk bảo vệ** | `1234` | — | Dùng để chuyển nhanh vào Khu Vực Người Chăm Sóc từ màn hình Kiosk. |

---

## 🧪 6. Chạy Bộ Kiểm Thử An Toàn (Test Suite)

Dự án đi kèm bộ test toàn diện bao phủ toàn bộ các module rủi ro y tế:

```bash
cd backend
pytest tests/ -v
```

**Danh sách 14 Test Cases đã xác thực 100% Passed:**
* `test_detect_high_risk_interaction`: Phát hiện tương tác mức độ cao (Ginkgo Biloba + Aspirin).
* `test_detect_moderate_interaction`: Phát hiện tương tác hạ áp tư thế (Amlodipine + Losartan).
* `test_safe_medications`: Xác nhận đơn thuốc an toàn khi không có tương tác.
* `test_normalize_drug_name`: Chuẩn hóa tên hoạt chất và biệt dược.
* `test_ocr_text_matching_success`: Đọc và nhận diện chính xác nhãn chữ thuốc qua OCR.
* `test_ocr_text_matching_fuzzy`: Khả năng khớp mờ khi chữ bị mờ hoặc góc chụp nghiêng.
* `test_ocr_text_matching_mismatch`: Phát hiện lệch nhãn thuốc.
* `test_reject_dangerous_requests`: Chặn yêu cầu uống gấp đôi, uống bù liều.
* `test_detect_acute_symptoms`: Phát hiện triệu chứng cấp tính (chóng mặt, nôn mửa, đau ngực).
* `test_allow_normal_confirmation`: Tiếp nhận câu xác nhận uống thuốc bình thường.
* `test_detect_drug_interaction_inquiry`: Cảnh báo khi người già hỏi uống chung hai loại thuốc kỵ nhau.
* `test_caregiver_permissions_isolation`: Cách ly độc lập dữ liệu giữa các bệnh nhân.
* `test_schedule_requires_verified_by`: Ràng buộc bắt buộc người thân xác minh đơn thuốc.
* `test_three_independent_states_append_only`: Kiểm tra tính toàn vẹn của chuỗi 3 trạng thái bất biến.

Kiểm tra biên dịch đóng gói giao diện:
```bash
cd frontend
npm run build
```

---

## 📂 7. Cấu Trúc Thư Mục Dự Án

```
Mediguard-ai/
├── backend/                         # Backend FastAPI & AI Core
│   ├── app/
│   │   ├── api/                     # Các Router endpoints (Auth, Vision, Voice, Meds, Schedules, WS)
│   │   │   ├── medications.py       # API quản lý thuốc & kiểm tra tương tác
│   │   │   ├── vision.py            # API tiếp nhận ảnh chụp camera & OCR
│   │   │   ├── voice.py             # API xử lý hội thoại giọng nói & TTS
│   │   │   └── websocket.py         # WebSocket phát sự kiện thời gian thực
│   │   ├── core/                    # Bộ quy tắc cốt lõi
│   │   │   ├── drug_checker.py      # Dược thư tương tác thuốc lâm sàng
│   │   │   ├── rule_engine.py       # Bộ lọc an toàn giọng nói & chống đổi liều
│   │   │   ├── scheduler_service.py # APScheduler quét lịch hẹn mỗi phút
│   │   │   └── notifier.py          # Gửi tin nhắn khẩn cấp Telegram
│   │   ├── models/                  # SQLAlchemy ORM Models (User, Med, Schedule, Log)
│   │   ├── schemas/                 # Pydantic Schemas xác thực dữ liệu
│   │   ├── vision/                  # Xử lý ảnh & EasyOCR
│   │   │   ├── matcher.py           # Multi-Modal Fusion (OCR + HSV + ORB)
│   │   │   ├── ocr_service.py       # EasyOCR tiếng Việt / tiếng Anh
│   │   │   └── preprocessor.py      # Đánh giá chất lượng ảnh (độ sáng, độ mờ)
│   │   └── voice/                   # Dịch vụ âm thanh & Edge-TTS tiếng Việt
│   ├── storage/                     # Bộ nhớ lưu ảnh mẫu, ảnh chụp và cache audio
│   ├── tests/                       # 14 Test cases kiểm thử an toàn
│   ├── requirements.txt             # Danh sách dependencies Python
│   └── main.py                      # Điểm khởi chạy FastAPI Server
│
├── frontend/                        # Frontend React 18 + Vite (Kiosk & Caregiver App)
│   ├── src/
│   │   ├── components/              # Các components dùng chung (PinModal, AudioEqualizer, Badges)
│   │   ├── pages/
│   │   │   ├── auth/                # Đăng nhập & Đổi vai trò
│   │   │   ├── elder/               # Giao diện Kiosk dành cho người già
│   │   │   │   ├── ElderHome.jsx    # Màn hình chính Kiosk, đồng hồ lớn & chuông tự động
│   │   │   │   ├── PillScanner.jsx  # Soi vỉ thuốc bằng camera & nhãn chữ OCR
│   │   │   │   └── VoiceDialogue.jsx# Trò chuyện giọng nói tiếng Việt với AI
│   │   │   └── caregiver/           # Bảng điều khiển người chăm sóc
│   │   │       ├── Dashboard.jsx    # Giám sát 3 trạng thái & tỷ lệ tuân thủ
│   │   │       ├── MedicationList.jsx# Quản lý thuốc, ảnh mẫu & AI Drug Checker
│   │   │       ├── ScheduleManager.jsx# Thiết lập lịch cữ & xác thực an toàn
│   │   │       └── LogsView.jsx     # Nhật ký kiểm toán y tế Append-Only
│   │   ├── services/                # Kết nối REST API & WebSocket Real-time
│   │   └── utils/                   # Hiệu ứng âm thanh chuông báo (Chimes)
│   └── package.json
│
├── run_app.bat                      # File khởi động 1-click trên Windows
├── docker-compose.yml               # Cấu hình triển khai Docker container
└── README.md                        # Tài liệu hướng dẫn dự án
```

---

## ⚖️ 8. Tuyên Bố Miễn Trừ Trách Nhiệm Y Tế (Medical Disclaimer)

* MediGuard AI được xây dựng như một **công cụ công nghệ hỗ trợ giám sát và nhắc nhở tuân thủ dùng thuốc tại nhà**. 
* Hệ thống **không** đưa ra chẩn đoán y khoa, **không** kê đơn thuốc mới và **không** thay thế cho chỉ định chuyên môn từ bác sĩ hoặc dược sĩ có chứng chỉ hành nghề.
* Trong mọi tình huống khẩn cấp hoặc khi người bệnh xuất hiện triệu chứng bất thường, gia đình cần đưa người bệnh đến cơ sở y tế gần nhất hoặc gọi cấp cứu y tế (115).

---

## 📄 9. Bản Quyền & Giấy Phép
Dự án được phát triển với tinh thần cống hiến vì sức khỏe cộng đồng người cao tuổi Việt Nam.  
Phát hành theo giấy phép **MIT License**. Mọi đóng góp (Pull Request, Issue) đều được hoan nghênh!
