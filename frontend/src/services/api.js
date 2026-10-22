export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchSchedules() {
  const res = await fetch(`${API_BASE}/api/schedules/`);
  return res.json();
}

export async function fetchMedications() {
  const res = await fetch(`${API_BASE}/api/medications/`);
  return res.json();
}

export async function fetchLogs() {
  const res = await fetch(`${API_BASE}/api/logs/`);
  return res.json();
}

export async function respondSchedule(scheduleId, responseType, speechText = '') {
  const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: responseType, speech_text: speechText })
  });
  return res.json();
}

export async function triggerReminder(scheduleId) {
  const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/remind`, {
    method: 'POST'
  });
  return res.json();
}

export async function caregiverConfirm(scheduleId, caregiverId = 2, notes = '') {
  const res = await fetch(`${API_BASE}/api/logs/${scheduleId}/caregiver-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: caregiverId, notes })
  });
  return res.json();
}

export async function processVoiceSpeech(userSpeech, voice = null, rate = null) {
  const res = await fetch(`${API_BASE}/api/voice/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_speech: userSpeech, voice, rate })
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Server returned status ${res.status}: ${errorText}`);
  }
  return res.json();
}

export async function speakText(text, voice = null, rate = null) {
  const res = await fetch(`${API_BASE}/api/voice/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate })
  });
  return res.json();
}
