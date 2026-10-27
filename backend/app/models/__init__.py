# ==============================================================================
# MEDIGUARD MODELS PACKAGE
# Unified models for Patient Care, Triage, Medication, and Audit Logging
# ==============================================================================

from .patient import Patient, Base
from .call_session import CallSession
from .symptom_log import SymptomLog
from .triage_ticket import TriageTicket
from .user import User
from .medication import Medication
from .schedule import Schedule
from .interaction_log import InteractionLog
from .call_report import AICallReport, CallStatus, MedicationAdherence, FollowupPriority
try:
    from .device_event import DeviceEvent
except ImportError:
    DeviceEvent = None

__all__ = [
    "Patient",
    "Base",
    "CallSession",
    "SymptomLog",
    "TriageTicket",
    "User",
    "Medication",
    "Schedule",
    "InteractionLog",
    "AICallReport",
    "CallStatus",
    "MedicationAdherence",
    "FollowupPriority",
    "DeviceEvent"
]
