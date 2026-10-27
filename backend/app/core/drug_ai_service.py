import os
import json
import logging
import re
from typing import Optional, Dict
from pathlib import Path
import httpx

from app.config import ROOT_DIR, BASE_DIR, settings

logger = logging.getLogger(__name__)

# Lưu khóa trong memory để có hiệu lực tức thời nếu người dùng nhập qua giao diện
_runtime_gemini_key: Optional[str] = None


def _mask_api_key_in_string(text: str) -> str:
    """Xóa bỏ/mask API key khỏi chuỗi để không bao giờ ghi key vào log."""
    if not text:
        return ""
    masked = re.sub(r'AIza[a-zA-Z0-9_\-]{30,}', 'AIza***', str(text))
    masked = re.sub(r'(?:key=|api_key=)[a-zA-Z0-9_\-]+', 'key=***', masked)
    return masked


def get_active_gemini_key(provided_key: Optional[str] = None) -> str:
    """Lấy khóa Gemini API Key theo thứ tự ưu tiên: truyền trực tiếp -> runtime -> biến môi trường"""
    if provided_key and provided_key.strip():
        return provided_key.strip()
    global _runtime_gemini_key
    if _runtime_gemini_key:
        return _runtime_gemini_key
    return os.getenv("GEMINI_API_KEY", "").strip()


def set_active_gemini_key(key: str, persist_to_env: bool = True) -> bool:
    """Lưu API Key vào runtime và cập nhật file .env an toàn"""
    global _runtime_gemini_key
    clean_key = key.strip()
    _runtime_gemini_key = clean_key
    os.environ["GEMINI_API_KEY"] = clean_key

    if persist_to_env:
        try:
            env_file = ROOT_DIR / ".env"
            if not env_file.exists():
                env_file = BASE_DIR / ".env"

            lines = []
            if env_file.exists():
                with open(env_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()

            key_found = False
            new_lines = []
            for line in lines:
                if line.startswith("GEMINI_API_KEY="):
                    new_lines.append(f"GEMINI_API_KEY={clean_key}\n")
                    key_found = True
                else:
                    new_lines.append(line)

            if not key_found:
                new_lines.append(f"\n# GOOGLE GEMINI AI API KEY (Tra cứu thuốc)\nGEMINI_API_KEY={clean_key}\n")

            with open(env_file, "w", encoding="utf-8") as f:
                f.writelines(new_lines)

            logger.info("Đã lưu GEMINI_API_KEY vào .env thành công.")
            return True
        except Exception as e:
            logger.warning("Không thể ghi .env: %s", _mask_api_key_in_string(str(e)))
    return True


async def search_drug_via_gemini_api(drug_query: str, api_key: Optional[str] = None) -> Optional[Dict]:
    """
    Gọi trực tiếp Google Gemini API (gemini-2.5-flash / gemini-2.0-flash / gemini-1.5-flash)
    để tra cứu chuyên sâu mọi loại thuốc trên thế giới theo tên, hoạt chất hoặc bệnh lý.
    """
    key = get_active_gemini_key(api_key)
    if not key or key == "mock-gemini-key":
        logger.info("Chưa có GEMINI_API_KEY, bỏ qua gọi API online.")
        return None

    prompt = f"""Bạn là dược sĩ chuyên khoa Lão khoa hàng đầu tại Việt Nam.
Hãy phân tích và cung cấp thông tin y tế chính xác, chuẩn mực về loại thuốc sau: "{drug_query}".
Yêu cầu trả về đúng định dạng JSON thuần túy (không chứa markdown backticks ```json ... ```):
{{
  "id": "tên_slug_không_dấu",
  "name": "Tên thương mại / biệt dược chuẩn kèm hàm lượng (Ví dụ: Amlodipine 5mg)",
  "active_ingredient": "Hoạt chất chính và nồng độ (Ví dụ: Amlodipine besylate 5mg)",
  "category": "Nhóm dược lý điều trị (Ví dụ: Thuốc Tim Mạch - Hạ Huyết Áp)",
  "indication": "Chỉ định & Công dụng điều trị chính",
  "dosage_elderly": "Liều dùng chuẩn và thời điểm uống (sáng/trưa/tối, trước hay sau ăn) dành cho người cao tuổi",
  "contraindications": "Chống chỉ định tuyệt đối và đối tượng không được dùng",
  "side_effects": "Tác dụng phụ thường gặp nhất và cách xử lý",
  "interactions": "Các thuốc hoặc thức uống kỵ tuyệt đối không dùng chung (Ví dụ: nước ép bưởi, rượu bia...)",
  "elder_notes": "Lời khuyên quan trọng nhất dành riêng cho người cao tuổi khi dùng thuốc này",
  "source": "Google Gemini AI API (Trực tuyến)"
}}"""

    model_name = settings.GEMINI_FAST_MODEL or "gemini-3.5-flash-lite"

    # 1. Thử gọi qua thư viện google-genai
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=key)

        def _call_drug_sdk():
            if hasattr(client, "interactions") and hasattr(client.interactions, "create") and callable(client.interactions.create):
                try:
                    return client.interactions.create(
                        model=model_name,
                        input=prompt,
                        response_mime_type="application/json",
                        timeout=10.0
                    )
                except AttributeError:
                    pass
            return client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )

        response = _call_drug_sdk()
        if response:
            raw_text = getattr(response, "output_text", None) or getattr(response, "text", None) or ""
            cleaned = raw_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            data["source"] = "Google Gemini Flash API (Trực tuyến)"
            return data
    except Exception as e:
        logger.warning("Lỗi gọi qua google-genai SDK: %s. Thử fallback REST HTTP...", _mask_api_key_in_string(str(e)))

    # 2. Thử gọi qua REST HTTP trực tiếp với model đã xác minh
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"}
        }
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            res = await http_client.post(url, json=payload)
            if res.status_code == 200:
                body = res.json()
                text = body["candidates"][0]["content"]["parts"][0]["text"]
                cleaned = text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                data = json.loads(cleaned.strip())
                data["source"] = "Google Gemini REST API (Trực tuyến)"
                return data
            else:
                logger.warning("Gemini REST API trả về lỗi: %s", res.status_code)
    except Exception as e:
        logger.error("Ngoại lệ khi gọi Gemini REST API: %s", _mask_api_key_in_string(str(e)))

    return None
