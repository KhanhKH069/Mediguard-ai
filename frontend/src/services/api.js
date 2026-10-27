export const API_BASE = import.meta.env?.VITE_API_BASE_URL || '';

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

export function getStoredToken() {
  const user = getStoredUser();
  return user?.access_token || '';
}

export function getAuthHeaders(extra = {}) {
  const token = getStoredToken();
  const headers = { ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
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
  const res = await fetch(`${API_BASE}/api/schedules/${query}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải danh sách lịch nhắc thuốc');
  }
  return res.json();
}

export async function fetchMedications(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/medications/${query}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải danh mục thuốc');
  }
  return res.json();
}

export async function fetchLogs(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/logs/${query}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải nhật ký theo dõi');
  }
  return res.json();
}

export function getMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const token = getStoredToken();
  const base = `${API_BASE || ''}${path.startsWith('/') ? '' : '/'}${path}`;
  if (token && !base.includes('token=')) {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}token=${encodeURIComponent(token)}`;
  }
  return base;
}

export async function createMedication(payload) {
  const res = await fetch(`${API_BASE}/api/medications/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tạo thuốc mới');
  }
  return await res.json();
}

export async function uploadMedicationImage(medId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/medications/${medId}/upload-reference-image`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
    method: 'DELETE',
    headers: getAuthHeaders()
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
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ response_type: responseType, speech_text: speechText })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể ghi nhận phản hồi cữ thuốc');
  }
  return await res.json();
}

export async function triggerReminder(scheduleId) {
  const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/remind`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể phát lời nhắc uống thuốc');
  }
  return await res.json();
}

export async function caregiverConfirm(scheduleId, caregiverId, notes = '') {
  if (!caregiverId) {
    throw new Error('Thiếu thông tin người chăm sóc đang đăng nhập');
  }
  const res = await fetch(`${API_BASE}/api/logs/${scheduleId}/caregiver-confirm`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ caregiver_id: caregiverId, notes })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xác nhận nhật ký an toàn');
  }
  return await res.json();
}

export function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem('mediguard_voice_session');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('mediguard_voice_session', sid);
    }
    return sid;
  } catch (e) {
    return 'session_default_' + Date.now();
  }
}

export async function processVoiceSpeech(userSpeech, voice = null, rate = null, elderId = null, sessionId = null) {
  const payload = {
    user_speech: userSpeech,
    voice,
    rate,
    elder_id: elderId != null ? Number(elderId) : null,
    session_id: sessionId || getOrCreateSessionId()
  };
  const res = await fetch(`${API_BASE}/api/voice/process`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
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

// ==========================================
// Tích hợp Zalo OA & Zalo Mini App & Khay Thuốc
// ==========================================
export async function fetchZaloMessages(elderId = null) {
  try {
    const query = elderId ? `?elder_id=${elderId}` : '';
    const res = await fetch(`${API_BASE}/api/zalo/messages${query}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Lỗi tải tin nhắn Zalo OA:', err);
    return [];
  }
}

export async function sendZaloPillReport(payload) {
  const res = await fetch(`${API_BASE}/api/zalo/send-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi gửi báo cáo qua Zalo OA');
  }
  return await res.json();
}

export async function confirmZaloMessage(messageId, caregiverName = 'Người nhà') {
  const res = await fetch(`${API_BASE}/api/zalo/confirm-message/${messageId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_name: caregiverName })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xác nhận tin nhắn Zalo');
  }
  return await res.json();
}

export async function fetchZaloConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/zalo/config`);
    return await res.json();
  } catch {
    return { status: 'mock', oa_name: 'MediGuard AI - Chăm Sóc Cha Mẹ' };
  }
}

export async function uploadScheduleReferenceImage(scheduleId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/upload-reference-image`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải ảnh mẫu ngăn thuốc');
  }
  return await res.json();
}

export async function verifyCompartmentImage(formData) {
  const res = await fetch(`${API_BASE}/api/vision/verify-compartment`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi đối chiếu ngăn thuốc từ giá đỡ');
  }
  return await res.json();
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

// ==========================================
// API Triệu Chứng Y Tế Theo Ngày & Cảnh Báo Người Nhà
// ==========================================
export async function fetchSymptoms(elderId = null, targetDate = null) {
  const params = new URLSearchParams();
  if (elderId) params.append('elder_id', elderId);
  if (targetDate) params.append('date', targetDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/symptoms/${query}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Không thể tải nhật ký triệu chứng');
  return await res.json();
}

export async function reportSymptom(elderId, symptomName, severity = 'Trung bình', description = '', actionTaken = '', source = null) {
  const res = await fetch(`${API_BASE}/api/symptoms/report`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      elder_id: elderId,
      symptom_name: symptomName,
      severity,
      description,
      action_taken: actionTaken,
      source
    })
  });
  if (!res.ok) throw new Error('Lỗi khi ghi nhận triệu chứng');
  return await res.json();
}

export async function confirmSymptom(symptomId, caregiverId, notes = '') {
  const res = await fetch(`${API_BASE}/api/symptoms/${symptomId}/confirm`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ caregiver_id: caregiverId, notes })
  });
  if (!res.ok) throw new Error('Lỗi khi xác nhận xử lý triệu chứng');
  return await res.json();
}

// ==========================================
// API Tra Cứu Thông Tin Thuốc (Hình Ảnh & Văn Bản)
// ==========================================
export async function fetchDrugCatalog(category = null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${API_BASE}/api/drugs/catalog${query}`);
  if (!res.ok) throw new Error('Không thể tải cẩm nang thuốc');
  return await res.json();
}

export async function searchDrugs(q) {
  const res = await fetch(`${API_BASE}/api/drugs/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Không thể tìm kiếm thuốc');
  return await res.json();
}

export async function lookupDrugByImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/drugs/lookup-image`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Không thể nhận diện hình ảnh thuốc');
  return await res.json();
}

export async function addDrugToElderMedications(payload) {
  const res = await fetch(`${API_BASE}/api/drugs/add-to-medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Không thể thêm thuốc vào đơn của Bác');
  return await res.json();
}

export async function scanPrescription(fileOrText) {
  const formData = new FormData();
  if (typeof fileOrText === 'string') {
    formData.append('text_content', fileOrText);
  } else if (fileOrText instanceof File || fileOrText instanceof Blob) {
    formData.append('file', fileOrText);
  }
  const res = await fetch(`${API_BASE}/api/drugs/scan-prescription`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Không thể quét đơn thuốc');
  return await res.json();
}

export async function batchAddPrescription(payload) {
  const res = await fetch(`${API_BASE}/api/drugs/batch-add-prescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi khi lưu đơn thuốc vào lịch uống');
  return await res.json();
}

// ==========================================
// API AI Phản Hồi Siêu Tốc (< 100ms)
// ==========================================
export async function fastAIReply(elderIdOrMessage, messageOrElderId, voice = null, rate = null, sessionId = null) {
  let elderId = null;
  let message = '';
  if (typeof elderIdOrMessage === 'string' && (typeof messageOrElderId === 'number' || messageOrElderId === null || messageOrElderId === undefined)) {
    message = elderIdOrMessage;
    elderId = messageOrElderId != null ? Number(messageOrElderId) : null;
  } else {
    elderId = elderIdOrMessage != null ? Number(elderIdOrMessage) : null;
    message = messageOrElderId || '';
  }
  const payload = {
    elder_id: elderId,
    message,
    voice,
    rate,
    session_id: sessionId || getOrCreateSessionId()
  };
  console.log('>>> [fastAIReply] Gửi yêu cầu tới AI:', payload);
  const res = await fetch(`${API_BASE}/api/ai/fast-reply`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error('<<< [fastAIReply] Lỗi HTTP:', res.status, errorText);
    throw new Error(`Server returned status ${res.status}: ${errorText || 'Lỗi khi kết nối với AI'}`);
  }
  return await res.json();
}



export async function fetchCompanionPreferences(elderId, token = null) {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_BASE}/api/voice/companion/preferences?elder_id=${elderId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải sở thích đồng hành');
  }
  return res.json();
}

export async function updateCompanionPreferences(payload, token = null) {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_BASE}/api/voice/companion/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể cập nhật sở thích đồng hành');
  }
  return res.json();
}

export async function deleteCompanionPreferences(elderId, token = null) {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_BASE}/api/voice/companion/preferences?elder_id=${elderId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xóa sở thích đồng hành');
  }
  return res.json();
}

export async function clearCompanionSession(elderId, token = null) {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_BASE}/api/voice/companion/session/${elderId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xóa phiên đồng hành');
  }
  return res.json();
}

export async function fetchLLMConfig() {
  const res = await fetch(`${API_BASE}/api/ai/llm-config`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Không thể tải cấu hình LLM');
  return await res.json();
}

export async function saveLLMConfig(payload) {
  const res = await fetch(`${API_BASE}/api/ai/llm-config`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Không thể cập nhật cấu hình LLM');
  return await res.json();
}

// ==========================================
// API Tổng Đài AI Gọi Hỏi Thăm & Báo Cáo Tự Động
// ==========================================
export async function triggerAICall(elderId, scheduleId = null, callType = 'TỰ ĐỘNG THEO LỊCH') {
  const res = await fetch(`${API_BASE}/api/calls/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      elder_id: elderId,
      schedule_id: scheduleId,
      call_type: callType
    })
  });
  if (!res.ok) throw new Error('Không thể kích hoạt cuộc gọi AI');
  return await res.json();
}

export async function submitCallResult(payload) {
  const res = await fetch(`${API_BASE}/api/calls/submit-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Lỗi gửi kết quả cuộc gọi');
  return await res.json();
}

export async function fetchCallReports({ elderId = null, requiresFollowup = null, handled = null, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (elderId) params.append('elder_id', elderId);
  if (requiresFollowup !== null) params.append('requires_followup', requiresFollowup);
  if (handled !== null) params.append('handled', handled);
  params.append('limit', limit);

  const res = await fetch(`${API_BASE}/api/calls/reports?${params.toString()}`);
  if (!res.ok) throw new Error('Lỗi tải danh sách báo cáo cuộc gọi');
  return await res.json();
}

export async function fetchPendingCallbacks(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/calls/callbacks${query}`);
  if (!res.ok) throw new Error('Lỗi tải danh sách cần liên hệ lại');
  return await res.json();
}

export async function resolveCallback(reportId, staffNotes, handledByName = 'Nhân viên y tế trực', handledByUserId = null) {
  const res = await fetch(`${API_BASE}/api/calls/resolve-callback/${reportId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_notes: staffNotes,
      handled_by_name: handledByName,
      handled_by_user_id: handledByUserId
    })
  });
  if (!res.ok) throw new Error('Lỗi lưu ghi nhận liên hệ lại');
  return await res.json();
}

export async function fetchApprovedQuestions() {
  const res = await fetch(`${API_BASE}/api/calls/questions`);
  if (!res.ok) throw new Error('Lỗi tải bộ câu hỏi đã duyệt');
  return await res.json();
}

export async function updateApprovedQuestions(questions) {
  const res = await fetch(`${API_BASE}/api/calls/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions })
  });
  if (!res.ok) throw new Error('Lỗi cập nhật bộ câu hỏi');
  return await res.json();
}

export async function fetchCallStats(elderId = null) {
  const query = elderId ? `?elder_id=${elderId}` : '';
  const res = await fetch(`${API_BASE}/api/calls/stats${query}`);
  if (!res.ok) throw new Error('Lỗi tải thống kê cuộc gọi');
  return await res.json();
}

// ==========================================
// API Bảng Phân Loại Lâm Sàng (Triage Queue)
// ==========================================
export async function fetchTriageTickets(priority = null) {
  const query = priority && priority !== 'ALL' ? `?priority=${priority}` : '';
  const res = await fetch(`${API_BASE}/api/v1/triage-tickets${query}`);
  if (!res.ok) throw new Error('Lỗi tải danh sách Triage Tickets');
  return await res.json();
}

export async function resolveTriageTicket(ticketId, actionType, resolutionNotes, staffName = 'Điều dưỡng trực', staffUserId = 'user_staff_01') {
  const res = await fetch(`${API_BASE}/api/v1/triage-tickets/${ticketId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action_type: actionType,
      staff_user_id: staffUserId,
      staff_name: staffName,
      resolution_notes: resolutionNotes
    })
  });
  if (!res.ok) throw new Error('Lỗi gửi kết quả xử lý ca Triage');
  return await res.json();
}


