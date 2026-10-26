export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ==========================================
// Quản lý Phiên Đăng Nhập (Auth & Session)
// ==========================================
export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Tên đăng nhập hoặc mật khẩu không chính xác');
  }
  return await res.json();
}

export async function registerUser(payload) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Đăng ký tài khoản không thành công');
  }
  return await res.json();
}

export async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/users`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

export function getStoredUser() {
  try {
    // Ưu tiên session hiện tại
    const sessionData = sessionStorage.getItem('mediguard_user');
    if (sessionData) return JSON.parse(sessionData);

    const localData = localStorage.getItem('mediguard_user');
    if (localData) return JSON.parse(localData);
  } catch (e) {
    console.warn('Lỗi đọc phiên người dùng:', e);
  }
  return null;
}

export function setStoredUser(user, remember = false) {
  try {
    sessionStorage.setItem('mediguard_user', JSON.stringify(user));
    if (remember) {
      localStorage.setItem('mediguard_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mediguard_user');
    }
  } catch (e) {
    console.warn('Lỗi lưu phiên người dùng:', e);
  }
}

export function clearStoredUser() {
  try {
    sessionStorage.removeItem('mediguard_user');
    localStorage.removeItem('mediguard_user');
  } catch (e) {}
}

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    return { status: 'offline', ping_ms: 999, database: 'disconnected' };
  }
}

export async function fetchSchedules(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/schedules/${query}`);
  return res.json();
}

export async function fetchMedications(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/medications/${query}`);
  return res.json();
}

export async function fetchLogs(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/logs/${query}`);
  return res.json();
}

export function getMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return `${API_BASE || ''}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function createMedication(payload) {
  const res = await fetch(`${API_BASE}/api/medications/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tạo thuốc mới');
  }
  return await res.json();
}

export async function checkDrugInteractions(elderId = null, medicationNames = null) {
  const payload = {};
  if (elderId) payload.elder_id = elderId;
  if (medicationNames && medicationNames.length > 0) payload.medication_names = medicationNames;

  const res = await fetch(`${API_BASE}/api/medications/check-interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể kiểm tra tương tác thuốc');
  }
  return await res.json();
}

export async function uploadMedicationImage(medId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/medications/${medId}/upload-reference-image`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải ảnh mẫu tham chiếu');
  }
  return await res.json();
}

export async function createSchedule(payload) {
  const res = await fetch(`${API_BASE}/api/schedules/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tạo lịch nhắc thuốc');
  }
  return await res.json();
}

export async function verifyPillImage(formData) {
  const res = await fetch(`${API_BASE}/api/vision/verify`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi đối chiếu vỉ thuốc');
  }
  return await res.json();
}

export async function deleteMedication(medId) {
  const res = await fetch(`${API_BASE}/api/medications/${medId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xóa thuốc khỏi danh mục');
  }
  return await res.json();
}

export async function fetchElders() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/elders`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
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

export async function processVoiceSpeech(userSpeech, voice = null, rate = null, elderId = null) {
  const res = await fetch(`${API_BASE}/api/voice/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_speech: userSpeech, voice, rate, elder_id: elderId })
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

// Quản lý ping thời gian thực toàn cục (Live Ping Store)
let _currentLivePing = 5;
let _livePingListeners = new Set();

export function getLivePing() {
  return _currentLivePing;
}

export function setLivePing(pingMs) {
  _currentLivePing = pingMs;
  _livePingListeners.forEach((fn) => {
    try {
      fn(_currentLivePing);
    } catch (e) {}
  });
}

export function subscribeLivePing(listener) {
  _livePingListeners.add(listener);
  listener(_currentLivePing);
  return () => _livePingListeners.delete(listener);
}

/**
 * Đo độ trễ HTTP tức thời (RTT Ping qua REST API /api/ping)
 */
export async function measurePing() {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/ping`);
    if (!res.ok) throw new Error('Ping request failed');
    const rtt = Math.max(1, Math.round(performance.now() - start));
    setLivePing(rtt);
    return { ping_ms: rtt, status: 'healthy' };
  } catch (err) {
    try {
      const h = await fetchHealth();
      const fallbackPing = h.ping_ms || 10;
      setLivePing(fallbackPing);
      return { ping_ms: fallbackPing, status: h.status };
    } catch {
      setLivePing(999);
      return { ping_ms: 999, status: 'offline' };
    }
  }
}

/**
 * Quản lý kết nối WebSocket thời gian thực tự động phục hồi & đo Ping RTT sub-millisecond (Max Ping)
 */
export function connectRealtimeUpdates(onMessage, onStatusChange = null, onPingUpdate = null) {
  let wsUrl = '';
  if (API_BASE && API_BASE.startsWith('http')) {
    const parsed = new URL(API_BASE);
    const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${wsProto}//${parsed.host}/api/ws/updates`;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    wsUrl = `${protocol}//${host}/api/ws/updates`;
  }

  let ws = null;
  let isClosedManually = false;
  let reconnectTimer = null;
  let pingInterval = null;

  function sendHeartbeatPing() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
        client_time: performance.now()
      }));
    }
  }

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (onStatusChange) onStatusChange('connected');
        // Gửi ping ngay lập tức để đo RTT khởi đầu
        sendHeartbeatPing();

        // Gửi ping định kỳ mỗi 4s để cập nhật chỉ số Ping cực nhạy ("Max Ping")
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(sendHeartbeatPing, 4000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Khi nhận pong từ server: tính toán Round-Trip-Time (RTT) tức thì
          if (data.type === 'pong' && data.client_time !== undefined) {
            const rtt = Math.max(1, Math.round(performance.now() - data.client_time));
            setLivePing(rtt);
            if (onPingUpdate) onPingUpdate(rtt);
          }
          if (onMessage) onMessage(data);
        } catch (e) {
          console.warn('Lỗi đọc dữ liệu WebSocket:', e);
        }
      };

      ws.onerror = (err) => {
        if (onStatusChange) onStatusChange('error');
      };

      ws.onclose = () => {
        if (onStatusChange) onStatusChange('disconnected');
        if (pingInterval) clearInterval(pingInterval);
        if (!isClosedManually) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    } catch (e) {
      if (onStatusChange) onStatusChange('error');
      if (!isClosedManually) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    isClosedManually = true;
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
  };
}
