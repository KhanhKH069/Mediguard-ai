from pydantic import BaseModel
from typing import Optional, List

class VoiceProcessRequest(BaseModel):
    elder_id: int
    user_speech: str
    schedule_id: Optional[int] = None

class VoiceProcessResponse(BaseModel):
    is_safe: bool
    intent: str
    action_taken: str
    speech_reply: str
    audio_url: Optional[str] = None
    warning_reason: Optional[str] = None
