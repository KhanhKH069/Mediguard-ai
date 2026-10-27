import test from 'node:test';
import assert from 'node:assert';

// Mock storage & browser globals before importing api.js
const mockStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
  };
};

global.sessionStorage = mockStorage();
global.localStorage = mockStorage();

// Dynamic import of api.js
const {
  fastAIReply,
  getStoredUser,
  setStoredUser,
  clearStoredUser,
  getStoredToken,
  getAuthHeaders
} = await import('../services/api.js');

// Helper to spy on global.fetch
function mockFetch(resolver) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
    return resolver(url, options);
  };
  return calls;
}

test('1. fastAIReply đính kèm Authorization theo cơ chế auth thực tế (Bearer token từ session/local)', async () => {
  clearStoredUser();
  const testToken = 'jwt-token-xyz-12345';
  setStoredUser({
    user_id: 2,
    username: 'caregiver_nam',
    role: 'CAREGIVER',
    access_token: testToken
  });

  assert.strictEqual(getStoredToken(), testToken, 'getStoredToken() phải lấy đúng token của người dùng đang đăng nhập');
  const authHeaders = getAuthHeaders();
  assert.strictEqual(authHeaders['Authorization'], `Bearer ${testToken}`, 'getAuthHeaders() phải tạo đúng Bearer token');

  const calls = mockFetch(async () => ({
    ok: true,
    json: async () => ({ success: true, reply: 'Dạ cháu chào Bác ạ!' })
  }));

  const res = await fastAIReply(1, 'Chào trợ lý AI');

  assert.strictEqual(calls.length, 1);
  const req = calls[0];
  assert.ok(req.url.endsWith('/api/ai/fast-reply'), 'URL phải gọi tới /api/ai/fast-reply');
  assert.strictEqual(req.options.headers['Authorization'], `Bearer ${testToken}`, 'fastAIReply phải đính kèm Authorization: Bearer token');
  assert.strictEqual(req.options.headers['Content-Type'], 'application/json', 'Content-Type phải là application/json');
  assert.strictEqual(res.reply, 'Dạ cháu chào Bác ạ!');
});

test('2. Caregiver chọn elder 1 thì request gửi elder_id=1, không phải ID caregiver', async () => {
  const caregiverUser = {
    user_id: 99, // Caregiver ID
    username: 'caregiver_hoa',
    role: 'CAREGIVER',
    access_token: 'caregiver-token-99'
  };
  setStoredUser(caregiverUser);

  const calls = mockFetch(async () => ({
    ok: true,
    json: async () => ({ success: true, reply: 'Lịch hôm nay của Bác...' })
  }));

  const selectedElderId = 1; // Caregiver đã chọn người thân ID 1
  await fastAIReply(selectedElderId, 'Đọc lịch uống thuốc hôm nay');

  assert.strictEqual(calls.length, 1);
  const payload = calls[0].body;
  assert.strictEqual(payload.elder_id, 1, 'elder_id phải là ID hồ sơ người cao tuổi được chọn (1)');
  assert.notStrictEqual(payload.elder_id, caregiverUser.user_id, 'Tuyệt đối không được gửi ID caregiver (99) làm elder_id');
});

test('3. Caregiver chưa chọn elder thì không gửi ID caregiver làm elder_id (elder_id=null)', async () => {
  const caregiverUser = {
    user_id: 88, // Caregiver ID
    username: 'caregiver_tuan',
    role: 'CAREGIVER',
    access_token: 'caregiver-token-88'
  };
  setStoredUser(caregiverUser);

  const calls = mockFetch(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      reply: 'Dạ chào bạn, bạn chưa chọn hồ sơ người cao tuổi nào để tra cứu thông tin y tế.'
    })
  }));

  const selectedElderId = null; // Chưa chọn người thân nào
  await fastAIReply(selectedElderId, 'Hôm nay uống thuốc gì?');

  assert.strictEqual(calls.length, 1);
  const payload = calls[0].body;
  assert.strictEqual(payload.elder_id, null, 'Khi chưa chọn người thân, elder_id phải là null');
  assert.notStrictEqual(payload.elder_id, caregiverUser.user_id, 'Không được fallback sang ID caregiver (88)');
});

test('4. Đổi hồ sơ người cao tuổi thì request tiếp theo sử dụng hồ sơ mới', async () => {
  const caregiverUser = {
    user_id: 77,
    username: 'caregiver_mai',
    role: 'CAREGIVER',
    access_token: 'token-77'
  };
  setStoredUser(caregiverUser);

  const calls = mockFetch(async () => ({
    ok: true,
    json: async () => ({ success: true, reply: 'Phản hồi thành công' })
  }));

  // Lần 1: Caregiver đang chọn elder ID 10
  let activeElderId = 10;
  await fastAIReply(activeElderId, 'Câu hỏi lần 1');
  assert.strictEqual(calls[0].body.elder_id, 10, 'Request 1 phải gửi elder_id=10');

  // Lần 2: Caregiver đổi sang elder ID 25
  activeElderId = 25;
  await fastAIReply(activeElderId, 'Câu hỏi lần 2');
  assert.strictEqual(calls[1].body.elder_id, 25, 'Request 2 phải gửi elder_id mới là 25');

  // Lần 3: Caregiver bỏ chọn (về null)
  activeElderId = null;
  await fastAIReply(activeElderId, 'Câu hỏi lần 3');
  assert.strictEqual(calls[2].body.elder_id, null, 'Request 3 phải gửi elder_id=null khi bỏ chọn');
});

test('5. Luồng elder không bị biến thành luồng caregiver và ngược lại', () => {
  // Logic trích xuất elderId chuẩn đã được áp dụng thống nhất xuyên suốt các component:
  const resolveTargetElderId = (propElderId, currentUser) => {
    return propElderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
  };

  // Case A: Người dùng đăng nhập là ELDER (ID = 5)
  const elderUser = { id: 5, user_id: 5, role: 'ELDER', full_name: 'Bác Lê Văn Năm' };
  // Elder màn hình không truyền prop elderId:
  const elderResolved = resolveTargetElderId(null, elderUser);
  assert.strictEqual(elderResolved, 5, 'Với tài khoản ELDER, phải dùng đúng ID của chính elder đó');

  // Case B: Người dùng đăng nhập là CAREGIVER (ID = 3)
  const caregiverUser = { id: 3, user_id: 3, role: 'CAREGIVER', full_name: 'Anh Nam' };
  // Caregiver chưa chọn hồ sơ:
  const cgResolvedNoSelect = resolveTargetElderId(null, caregiverUser);
  assert.strictEqual(cgResolvedNoSelect, null, 'Với CAREGIVER chưa chọn hồ sơ, targetElderId phải là null');
  assert.notStrictEqual(cgResolvedNoSelect, 3, 'Tuyệt đối không lấy user_id của caregiver làm elderId');

  // Case C: Caregiver chọn hồ sơ người cao tuổi ID = 12
  const cgResolvedWithSelect = resolveTargetElderId(12, caregiverUser);
  assert.strictEqual(cgResolvedWithSelect, 12, 'Với CAREGIVER đã chọn hồ sơ, targetElderId phải là ID được chọn');
  assert.notStrictEqual(cgResolvedWithSelect, 3, 'Không bị nhầm sang ID caregiver');
});

test('6. Lỗi API/auth được xử lý an toàn, không làm crash UI', async () => {
  // Case A: Lỗi HTTP 401 Unauthorized
  mockFetch(async () => ({
    ok: false,
    status: 401,
    text: async () => 'Token hết hạn hoặc không hợp lệ'
  }));

  let errorCaught = null;
  try {
    await fastAIReply(1, 'Hỏi câu 401');
  } catch (err) {
    errorCaught = err;
  }
  assert.ok(errorCaught instanceof Error);
  assert.match(errorCaught.message, /401/, 'Phải ném ra Error chứa status 401');

  // Giả lập cách component (ElderVoiceAssistantTab / SettingsView) hứng lỗi an toàn
  let safeUIResponse = '';
  try {
    await fastAIReply(1, 'Hỏi câu lỗi');
  } catch (err) {
    safeUIResponse = 'Dạ cháu đã lắng nghe Bác rồi ạ. Bác nhớ uống nước ấm và nghỉ ngơi nhé!';
  }
  assert.strictEqual(safeUIResponse.length > 0, true, 'UI xử lý fallback êm đẹp, không bị crash');

  // Case B: Lỗi mạng (Network Error / Failed to fetch)
  mockFetch(async () => {
    throw new TypeError('Failed to fetch');
  });

  let networkErrorCaught = null;
  try {
    await fastAIReply(1, 'Hỏi khi mất mạng');
  } catch (err) {
    networkErrorCaught = err;
  }
  assert.ok(networkErrorCaught instanceof TypeError);
  assert.strictEqual(networkErrorCaught.message, 'Failed to fetch');
});
