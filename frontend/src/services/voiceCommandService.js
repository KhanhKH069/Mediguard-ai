// ==============================================================================
// MEDIGUARD AI - SENIOR VOICE COMMAND ENGINE (BỘ ĐIỀU KHIỂN GIỌNG NÓI DÀNH CHO NGƯỜI CAO TUỔI)
// ==============================================================================

export const COMMAND_TYPES = {
  NAV_HOME: 'NAV_HOME',
  NAV_DRUG_LOOKUP: 'NAV_DRUG_LOOKUP',
  NAV_PILL_SCANNER: 'NAV_PILL_SCANNER',
  NAV_SYMPTOM_REPORT: 'NAV_SYMPTOM_REPORT',
  NAV_VOICE_CHAT: 'NAV_VOICE_CHAT',
  ACTION_CONFIRM_INTAKE: 'ACTION_CONFIRM_INTAKE',
  ACTION_READ_SCHEDULE: 'ACTION_READ_SCHEDULE',
  ACTION_UNSURE: 'ACTION_UNSURE',
  ACTION_EMERGENCY: 'ACTION_EMERGENCY',
  ACTION_REPORT_SYMPTOM: 'ACTION_REPORT_SYMPTOM',
  SETTING_FONT_LARGE: 'SETTING_FONT_LARGE',
  SETTING_FONT_NORMAL: 'SETTING_FONT_NORMAL',
  SETTING_THEME_DARK: 'SETTING_THEME_DARK',
  SETTING_THEME_LIGHT: 'SETTING_THEME_LIGHT',
  STOP_SPEECH: 'STOP_SPEECH',
  HELP_COMMANDS: 'HELP_COMMANDS',
  AI_CHAT_FALLBACK: 'AI_CHAT_FALLBACK'
};

// Danh mục triệu chứng mở rộng nhận diện trực tiếp bằng giọng nói
const DIRECT_SYMPTOMS = [
  { keywords: ['chóng mặt', 'hoa mắt', 'choáng váng', 'đảo điên'], name: 'Chóng mặt, hoa mắt', severity: 'Khẩn cấp' },
  { keywords: ['đau đầu', 'nhức đầu', 'buốt đầu', 'nặng đầu'], name: 'Đau đầu, nhức đầu', severity: 'Trung bình' },
  { keywords: ['buồn nôn', 'nôn mửa', 'cồn cào', 'mắc ói'], name: 'Buồn nôn, cồn cào', severity: 'Khẩn cấp' },
  { keywords: ['đau bụng', 'quặn bụng', 'đau dạ dày', 'chướng bụng', 'đầy hơi'], name: 'Đau bụng, khó chịu tiêu hóa', severity: 'Khẩn cấp' },
  { keywords: ['khó thở', 'hụt hơi', 'thở dốc', 'ngộp thở'], name: 'Khó thở, hụt hơi', severity: 'Khẩn cấp' },
  { keywords: ['tức ngực', 'đau ngực', 'thắt ngực', 'nặng ngực', 'nhói tim'], name: 'Tức ngực, đau thắt ngực', severity: 'Khẩn cấp' },
  { keywords: ['mệt mỏi', 'rất mệt', 'mệt quá', 'mệt trong người', 'kiệt sức', 'đuối sức', 'bủn rủn'], name: 'Mệt mỏi bất thường', severity: 'Trung bình' },
  { keywords: ['sốt', 'nóng sốt', 'nóng ran', 'người sốt', 'sốt cao'], name: 'Bị sốt, người nóng', severity: 'Trung bình' },
  { keywords: ['tim đập nhanh', 'hồi hộp', 'đánh trống ngực', 'thình thịch', 'đập nhanh', 'nhịp tim'], name: 'Tim đập nhanh, hồi hộp', severity: 'Khẩn cấp' },
  { keywords: ['uống nhầm', 'lỡ uống nhầm', 'nhầm thuốc', 'uống quá liều'], name: 'Nghi ngờ uống nhầm thuốc', severity: 'Khẩn cấp' },
  { keywords: ['run tay', 'run chân', 'co giật', 'run rẩy'], name: 'Run tay chân', severity: 'Trung bình' },
  { keywords: ['dị ứng', 'mẩn ngứa', 'nổi sảy', 'ngứa'], name: 'Mẩn ngứa, dị ứng da', severity: 'Trung bình' }
];

/**
 * Chuẩn hóa chuỗi giọng nói: chữ thường, bỏ dấu câu thừa, chuẩn hóa khoảng trắng
 */
export function normalizeSpeech(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân tích câu nói của người cao tuổi và trích xuất ý định (Intent Recognition)
 */
export function parseVoiceCommand(rawText) {
  const clean = normalizeSpeech(rawText);
  if (!clean) return null;

  // 1. DỪNG LẠI / IM LẶNG
  if (
    clean === 'dừng lại' ||
    clean === 'im lặng' ||
    clean === 'tắt tiếng' ||
    clean === 'ngừng đọc' ||
    clean === 'dừng đọc' ||
    clean === 'thôi' ||
    clean === 'dừng' ||
    clean.includes('im lặng') ||
    clean.includes('tắt tiếng') ||
    clean.includes('dừng đọc') ||
    clean.includes('ngừng nói') ||
    clean.includes('ngưng nói') ||
    clean.includes('đừng đọc') ||
    clean.includes('tắt loa')
  ) {
    return {
      type: COMMAND_TYPES.STOP_SPEECH,
      title: 'Dừng âm thanh',
      actionName: 'Đã dừng giọng đọc',
      reply: '',
      speechText: ''
    };
  }

  // 2. KHẨN CẤP / CỨU TÔI / BÁO ĐỘNG
  if (
    clean.includes('cứu tôi') ||
    clean.includes('cứu với') ||
    clean.includes('khẩn cấp') ||
    clean.includes('cần giúp đỡ') ||
    clean.includes('gọi cấp cứu') ||
    clean.includes('gọi người nhà') ||
    clean.includes('báo động') ||
    clean.includes('giúp bác với') ||
    clean.includes('bị ngã') ||
    clean.includes('té ngã') ||
    clean.includes('gọi con')
  ) {
    return {
      type: COMMAND_TYPES.ACTION_EMERGENCY,
      title: 'Báo động khẩn cấp',
      actionName: 'Đã phát tín hiệu khẩn cấp tới con cháu',
      reply: '🚨 Dạ thưa Bác, cháu đã gửi tín hiệu khẩn cấp tới điện thoại của con cháu ngay lập tức rồi ạ! Bác giữ bình tĩnh và ngồi nghỉ ngơi tại chỗ nhé.',
      speechText: 'Dạ thưa Bác, cháu đã gửi tín hiệu khẩn cấp tới điện thoại của con cháu ngay lập tức rồi ạ! Bác giữ bình tĩnh và ngồi nghỉ ngơi tại chỗ nhé.'
    };
  }

  // 3. XÁC NHẬN ĐÃ UỐNG THUỐC
  const intakeKeywords = [
    'uống rồi', 'đã uống', 'uống xong', 'bác đã uống', 'tôi đã uống',
    'uống hết rồi', 'đã uống thuốc', 'xác nhận uống', 'xong cữ rồi',
    'uống xong rồi', 'uống thuốc rồi', 'bác uống rồi', 'tôi uống rồi'
  ];
  if (intakeKeywords.some((k) => clean.includes(k)) || (clean.includes('uống') && (clean.includes('rồi') || clean.includes('xong') || clean.includes('hết')))) {
    return {
      type: COMMAND_TYPES.ACTION_CONFIRM_INTAKE,
      title: 'Xác nhận uống thuốc',
      actionName: 'Đã ghi nhận Bác uống xong thuốc hôm nay',
      reply: 'Dạ thưa Bác, cháu đã ghi nhận Bác uống xong thuốc cữ này và gửi thông báo an tâm cho con cháu rồi ạ!',
      speechText: 'Dạ thưa Bác, cháu đã ghi nhận Bác uống xong thuốc cữ này và gửi thông báo an tâm cho con cháu rồi ạ! Bác uống thêm chút nước ấm và nghỉ ngơi nhé.'
    };
  }

  // 4. CHƯA CHẮC CHẮN / NHỜ CON XEM
  if (
    clean.includes('chưa chắc chắn') ||
    clean.includes('chưa dám uống') ||
    clean.includes('nhờ con xem') ||
    clean.includes('hỏi lại con') ||
    clean.includes('chưa rõ') ||
    clean.includes('nghi ngờ')
  ) {
    return {
      type: COMMAND_TYPES.ACTION_UNSURE,
      title: 'Chưa chắc chắn',
      actionName: 'Đã báo con cháu kiểm tra lại khay thuốc',
      reply: 'Dạ Bác cứ để nguyên khay thuốc ở đó, cháu đã nhắn các con kiểm tra lại giúp Bác rồi ạ.',
      speechText: 'Dạ Bác cứ để nguyên khay thuốc ở đó, cháu đã nhắn các con kiểm tra lại giúp Bác rồi ạ.'
    };
  }

  // 5. ĐỌC LỊCH THUỐC / NHẮC THUỐC
  const scheduleReadKeywords = [
    'đọc lịch', 'nhắc thuốc', 'uống thuốc gì', 'lịch thuốc', 'cữ này có thuốc gì',
    'đọc lại lời dặn', 'nghe lại lời dặn', 'bật loa nhắc', 'hôm nay uống gì',
    'mấy viên thuốc', 'mấy viên', 'những thuốc gì', 'cữ thuốc này', 'đọc thuốc', 'nhắc lại'
  ];
  if (scheduleReadKeywords.some((k) => clean.includes(k))) {
    return {
      type: COMMAND_TYPES.ACTION_READ_SCHEDULE,
      title: 'Đọc lịch uống thuốc',
      actionName: 'Đọc chi tiết cữ thuốc và lời dặn',
      reply: 'Dạ thưa Bác, cháu đang đọc lịch uống thuốc cữ này cho Bác nghe đây ạ.',
      speechText: '' // Sẽ được cập nhật động từ dữ liệu cữ thuốc hiện tại
    };
  }

  // 6. KIỂM TRA TRIỆU CHỨNG SỨC KHỎE TRỰC TIẾP
  for (const item of DIRECT_SYMPTOMS) {
    if (item.keywords.some((k) => clean.includes(k))) {
      return {
        type: COMMAND_TYPES.ACTION_REPORT_SYMPTOM,
        title: `Báo triệu chứng: ${item.name}`,
        actionName: `Đã lưu triệu chứng [${item.name}] vào sổ theo dõi`,
        symptomName: item.name,
        severity: item.severity,
        rawSpeech: rawText,
        reply: `Dạ thưa Bác, cháu đã lưu ngay triệu chứng "${item.name}" vào sổ theo dõi hôm nay và phát tín hiệu báo cho con cháu rồi ạ. Bác hãy ngồi nghỉ ngơi tại chỗ và uống nước ấm nhé!`,
        speechText: `Dạ thưa Bác, cháu đã lưu ngay triệu chứng "${item.name}" vào sổ theo dõi hôm nay và phát tín hiệu báo cho con cháu rồi ạ. Bác hãy ngồi nghỉ ngơi tại chỗ và uống một ngụm nước ấm nhé!`
      };
    }
  }

  // 7. ĐIỀU HƯỚNG TRANG (NAVIGATION)
  // 7.1. Trang chủ / Màn hình chính
  if (
    clean.includes('trang chủ') ||
    clean.includes('trang chính') ||
    clean.includes('về nhà') ||
    clean.includes('màn hình chính') ||
    clean.includes('quay lại') ||
    clean.includes('trở về') ||
    clean.includes('quay về') ||
    clean.includes('bắt đầu lại') ||
    clean.includes('mở trang chủ') ||
    clean === 'nhà'
  ) {
    return {
      type: COMMAND_TYPES.NAV_HOME,
      targetPage: 'home',
      title: 'Về trang chủ',
      actionName: 'Đã chuyển về Màn hình chính',
      reply: 'Dạ thưa Bác, cháu đã chuyển về Màn hình chính cho Bác rồi ạ!',
      speechText: 'Dạ thưa Bác, cháu đã chuyển về Màn hình chính cho Bác rồi ạ!'
    };
  }

  // 7.2. Tra cứu thuốc / Hộp thuốc
  if (
    clean.includes('tra cứu') ||
    clean.includes('tìm thuốc') ||
    clean.includes('hộp thuốc') ||
    clean.includes('xem thuốc') ||
    clean.includes('tìm kiếm thuốc') ||
    clean.includes('công dụng thuốc') ||
    clean.includes('hướng dẫn thuốc') ||
    clean.includes('thông tin thuốc') ||
    clean.includes('thuốc này là gì')
  ) {
    return {
      type: COMMAND_TYPES.NAV_DRUG_LOOKUP,
      targetPage: 'drug_lookup',
      title: 'Tra cứu hộp thuốc',
      actionName: 'Đã mở sổ Tra cứu thuốc',
      reply: 'Dạ thưa Bác, cháu đã mở sổ Tra cứu thuốc cho Bác rồi ạ. Bác có thể tìm tên thuốc hoặc chụp ảnh vỏ hộp nhé!',
      speechText: 'Dạ thưa Bác, cháu đã mở sổ Tra cứu thuốc cho Bác rồi ạ. Bác có thể tìm tên thuốc hoặc chụp ảnh vỏ hộp nhé!'
    };
  }

  // 7.3. Soi kiểm tra thuốc bằng Camera
  if (
    clean.includes('soi thuốc') ||
    clean.includes('quét thuốc') ||
    clean.includes('kiểm tra thuốc') ||
    clean.includes('chụp ảnh thuốc') ||
    clean.includes('soi ảnh') ||
    clean.includes('camera thuốc') ||
    clean.includes('máy ảnh thuốc') ||
    clean.includes('máy ảnh soi') ||
    clean.includes('soi viên') ||
    clean.includes('soi khay thuốc')
  ) {
    return {
      type: COMMAND_TYPES.NAV_PILL_SCANNER,
      targetPage: 'pill_scanner',
      title: 'Soi kiểm tra thuốc',
      actionName: 'Đã mở camera Soi kiểm tra thuốc',
      reply: 'Dạ thưa Bác, cháu đã mở camera Soi kiểm tra thuốc cho Bác rồi ạ. Bác đưa khay thuốc trước máy nhé!',
      speechText: 'Dạ thưa Bác, cháu đã mở camera Soi kiểm tra thuốc cho Bác rồi ạ. Bác đưa khay thuốc trước máy nhé!'
    };
  }

  // 7.4. Báo triệu chứng / Sổ triệu chứng
  if (
    clean.includes('báo triệu chứng') ||
    clean.includes('sổ triệu chứng') ||
    clean.includes('ghi triệu chứng') ||
    clean.includes('mở triệu chứng') ||
    clean.includes('theo dõi triệu chứng') ||
    clean.includes('sổ sức khỏe') ||
    clean.includes('khai bệnh')
  ) {
    return {
      type: COMMAND_TYPES.NAV_SYMPTOM_REPORT,
      targetPage: 'symptom_report',
      title: 'Báo triệu chứng sức khỏe',
      actionName: 'Đã mở sổ Báo triệu chứng',
      reply: 'Dạ thưa Bác, cháu đã mở sổ Báo triệu chứng sức khỏe cho Bác rồi ạ.',
      speechText: 'Dạ thưa Bác, cháu đã mở sổ Báo triệu chứng sức khỏe cho Bác rồi ạ.'
    };
  }

  // 7.5. Mở trò chuyện / Tâm sự với AI
  if (
    clean.includes('trò chuyện') ||
    clean.includes('nói chuyện') ||
    clean.includes('tâm sự') ||
    clean.includes('hỏi đáp') ||
    clean.includes('hỏi trợ lý') ||
    clean.includes('gặp trợ lý') ||
    clean.includes('nói chuyện với cháu')
  ) {
    return {
      type: COMMAND_TYPES.NAV_VOICE_CHAT,
      targetPage: 'voice',
      title: 'Trò chuyện cùng cháu',
      actionName: 'Đã mở màn hình Đối thoại giọng nói',
      reply: 'Dạ, cháu đang ở đây trò chuyện cùng Bác đây ạ!',
      speechText: 'Dạ, cháu đang ở đây trò chuyện cùng Bác đây ạ!'
    };
  }

  // 8. CÀI ĐẶT HIỂN THỊ (CỠ CHỮ & GIAO DIỆN)
  // 8.1. Chữ to / Chữ lớn
  if (
    clean.includes('chữ to') ||
    clean.includes('chữ lớn') ||
    clean.includes('cỡ chữ to') ||
    clean.includes('phóng to chữ') ||
    clean.includes('cho chữ to') ||
    clean.includes('chữ bự') ||
    clean.includes('rất lớn')
  ) {
    return {
      type: COMMAND_TYPES.SETTING_FONT_LARGE,
      title: 'Chỉnh chữ to hơn',
      actionName: 'Đã phóng to cỡ chữ dễ đọc',
      scale: 'large',
      reply: 'Dạ cháu đã phóng to cỡ chữ cho Bác dễ nhìn hơn rồi ạ!',
      speechText: 'Dạ cháu đã phóng to cỡ chữ cho Bác dễ nhìn hơn rồi ạ!'
    };
  }

  // 8.2. Chữ vừa / Chữ bình thường
  if (
    clean.includes('chữ vừa') ||
    clean.includes('chữ bình thường') ||
    clean.includes('cỡ chữ vừa') ||
    clean.includes('thu nhỏ chữ') ||
    clean.includes('chữ chuẩn')
  ) {
    return {
      type: COMMAND_TYPES.SETTING_FONT_NORMAL,
      title: 'Chỉnh chữ chuẩn vừa vặn',
      actionName: 'Đã đặt cỡ chữ tiêu chuẩn',
      scale: 'normal',
      reply: 'Dạ cháu đã chỉnh cỡ chữ về mức vừa vặn cho Bác rồi ạ!',
      speechText: 'Dạ cháu đã chỉnh cỡ chữ về mức vừa vặn cho Bác rồi ạ!'
    };
  }

  // 8.3. Màn hình tối / Tắt đèn
  if (
    clean.includes('chế độ tối') ||
    clean.includes('màn hình tối') ||
    clean.includes('giao diện tối') ||
    clean.includes('tắt đèn')
  ) {
    return {
      type: COMMAND_TYPES.SETTING_THEME_DARK,
      title: 'Chuyển giao diện tối',
      actionName: 'Đã chuyển sang giao diện tối dịu mắt',
      theme: 'dark',
      reply: 'Dạ cháu đã chuyển sang màn hình tối dịu mắt cho Bác rồi ạ.',
      speechText: 'Dạ cháu đã chuyển sang màn hình tối dịu mắt cho Bác rồi ạ.'
    };
  }

  // 8.4. Màn hình sáng / Bật đèn
  if (
    clean.includes('chế độ sáng') ||
    clean.includes('màn hình sáng') ||
    clean.includes('giao diện sáng') ||
    clean.includes('bật đèn')
  ) {
    return {
      type: COMMAND_TYPES.SETTING_THEME_LIGHT,
      title: 'Chuyển giao diện sáng',
      actionName: 'Đã chuyển sang giao diện sáng rõ nét',
      theme: 'light',
      reply: 'Dạ cháu đã chuyển sang màn hình sáng rõ nét cho Bác rồi ạ.',
      speechText: 'Dạ cháu đã chuyển sang màn hình sáng rõ nét cho Bác rồi ạ.'
    };
  }

  // 9. HƯỚNG DẪN CÂU LỆNH
  if (
    clean.includes('hướng dẫn') ||
    clean.includes('bạn làm được gì') ||
    clean.includes('cháu làm được gì') ||
    clean.includes('câu lệnh') ||
    clean.includes('giúp tôi') ||
    clean.includes('cách dùng') ||
    clean.includes('nói những gì') ||
    clean.includes('nói gì') ||
    clean.includes('lệnh giọng nói')
  ) {
    return {
      type: COMMAND_TYPES.HELP_COMMANDS,
      title: 'Hướng dẫn câu lệnh',
      actionName: 'Đang hiển thị các câu lệnh mẫu',
      reply: 'Dạ thưa Bác, Bác có thể nói: "Về trang chủ", "Tôi đã uống thuốc rồi", "Đọc lịch thuốc", "Tra cứu thuốc", "Soi kiểm tra thuốc", "Bác bị mệt", hoặc "Chữ to hơn" ạ!',
      speechText: 'Dạ thưa Bác, Bác có thể nói: Về trang chủ, Tôi đã uống thuốc rồi, Đọc lịch thuốc, Tra cứu thuốc, Soi kiểm tra thuốc, Bác bị mệt, hoặc Chữ to hơn ạ!'
    };
  }

  // 10. MẶC ĐỊNH: GỬI SANG TRỢ LÝ AI ĐỐI THOẠI Y TẾ
  return {
    type: COMMAND_TYPES.AI_CHAT_FALLBACK,
    title: 'Hỏi đáp y tế & trò chuyện',
    actionName: 'Đang kết nối trợ lý AI trả lời Bác',
    userSpeech: rawText
  };
}

/**
 * Danh sách câu lệnh mẫu thông dụng để hiển thị gợi ý cho người cao tuổi
 */
export const SAMPLE_VOICE_COMMANDS = [
  { icon: '🏠', text: 'Về trang chủ', desc: 'Quay lại màn hình phiếu thuốc' },
  { icon: '💊', text: 'Tôi đã uống thuốc rồi', desc: 'Xác nhận uống xong cữ này' },
  { icon: '🔊', text: 'Đọc lịch thuốc hôm nay', desc: 'Nghe lại danh sách thuốc & giờ uống' },
  { icon: '🔍', text: 'Tra cứu hộp thuốc', desc: 'Xem công dụng và liều dùng' },
  { icon: '📸', text: 'Soi kiểm tra thuốc', desc: 'Mở camera đối chiếu viên thuốc' },
  { icon: '🩺', text: 'Bác thấy chóng mặt', desc: 'Ghi ngay triệu chứng và báo con cháu' },
  { icon: '🔤', text: 'Chữ to hơn', desc: 'Phóng to cỡ chữ cho dễ nhìn' },
  { icon: '🌙', text: 'Bật chế độ tối', desc: 'Chuyển màn hình tối dịu mắt' },
  { icon: '🆘', text: 'Cứu tôi, khẩn cấp', desc: 'Phát tín hiệu khẩn cấp đến gia đình' }
];
