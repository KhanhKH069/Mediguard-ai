import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc và trích xuất hàm resolveValidSteps từ file ElderVoiceAssistantTab.jsx
const componentPath = path.join(__dirname, 'ElderVoiceAssistantTab.jsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');

const matchFn = componentSource.match(/export function resolveValidSteps\(steps\)\s*\{([\s\S]*?)\n\}/);
if (!matchFn) {
  throw new Error('Không tìm thấy export function resolveValidSteps trong ElderVoiceAssistantTab.jsx');
}
const resolveValidSteps = new Function('steps', matchFn[1]);

function shouldRenderStepsCard(steps) {
  return Array.isArray(steps) && steps.length > 0;
}

test('1. API trả steps là một array có phần tử: hiển thị đúng các bước nhận được', () => {
  const apiResp = {
    reply: 'Lịch uống thuốc hôm nay của Bác gồm có...',
    steps: [
      'Uống thuốc cữ sáng: Amlodipine 5mg (1 viên)',
      'Đo lại huyết áp sau khi uống thuốc 30 phút'
    ]
  };

  const steps = resolveValidSteps(apiResp.steps);
  assert.strictEqual(steps.length, 2);
  assert.strictEqual(steps[0], 'Uống thuốc cữ sáng: Amlodipine 5mg (1 viên)');
  assert.strictEqual(steps[1], 'Đo lại huyết áp sau khi uống thuốc 30 phút');
  assert.strictEqual(shouldRenderStepsCard(steps), true, 'Thẻ "Việc Bác cần làm ngay" phải được hiển thị');
});

test('2. API trả steps: []: không hiển thị thẻ hướng dẫn', () => {
  const apiResp = {
    reply: 'Hiện tại bạn chưa có người cao tuổi được liên kết.',
    steps: []
  };

  const steps = resolveValidSteps(apiResp.steps);
  assert.deepStrictEqual(steps, []);
  assert.strictEqual(shouldRenderStepsCard(steps), false, 'Thẻ "Việc Bác cần làm ngay" không được hiển thị khi steps rỗng');
});

test('3. API không có trường steps: không hiển thị thẻ hướng dẫn', () => {
  const apiResp = {
    success: true,
    reply: 'Dạ chào bạn Hà Yến Nhi, bạn không có quyền truy cập thông tin y tế của người cao tuổi này ạ.'
  };

  const steps = resolveValidSteps(apiResp.steps);
  assert.deepStrictEqual(steps, []);
  assert.strictEqual(shouldRenderStepsCard(steps), false, 'Thẻ "Việc Bác cần làm ngay" không được hiển thị khi thiếu steps');
});

test('4. API trả steps sai kiểu: không crash và không hiển thị hướng dẫn mặc định', () => {
  const invalidCases = [
    null,
    undefined,
    'bước 1: uống thuốc',
    12345,
    true,
    false,
    { step: 1 },
    [null, undefined, '', '   ']
  ];

  for (const invalidValue of invalidCases) {
    let steps;
    assert.doesNotThrow(() => {
      steps = resolveValidSteps(invalidValue);
    }, `resolveValidSteps không được crash khi nhận kiểu: ${typeof invalidValue}`);

    assert.deepStrictEqual(steps, [], `Phải trả về mảng rỗng cho giá trị: ${JSON.stringify(invalidValue)}`);
    assert.strictEqual(shouldRenderStepsCard(steps), false, 'Không được hiển thị thẻ khi steps sai kiểu');
  }
});

test('5. Đảm bảo logic handleAskQuestion và JSX render tuân thủ đúng yêu cầu', () => {
  // Kiểm tra không còn ternary fallback hardcode 3 bước trong handleAskQuestion
  assert.doesNotMatch(
    componentSource,
    /steps:\s*resp\?\.steps\s*&&\s*Array\.isArray\(resp\.steps\)\s*&&\s*resp\.steps\.length\s*>\s*0\s*\?\s*resp\.steps\s*:\s*\[/,
    'Đã xóa bỏ hoàn toàn fallback tự ý gán 3 bước mặc định khi resp.steps thiếu'
  );

  // Kiểm tra JSX có điều kiện hiển thị thẻ "Việc Bác cần làm ngay"
  assert.match(
    componentSource,
    /\{Array\.isArray\(aiAnswer\.steps\)\s*&&\s*aiAnswer\.steps\.length\s*>\s*0\s*&&\s*\(/,
    'JSX phải kiểm tra Array.isArray(aiAnswer.steps) && aiAnswer.steps.length > 0 trước khi render thẻ'
  );
});
