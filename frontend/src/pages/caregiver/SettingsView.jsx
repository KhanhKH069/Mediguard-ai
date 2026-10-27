import React, { useState, useEffect } from 'react';
import {
  User,
  Bell,
  Volume2,
  Smartphone,
  Plus,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  Sliders,
  Sun,
  Moon,
  Type,
  Save,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Bot,
  ChevronDown,
  ChevronUp,
  Radio
} from 'lucide-react';
import {
  fetchUsers,
  fetchElders,
  fetchZaloConfig,
  registerUser,
  speakText,
  fetchLLMConfig,
  saveLLMConfig,
  fastAIReply
} from '../../services/api';
import { playVoiceSpeech } from '../../services/voiceService';
import ZaloMiniAppView from './ZaloMiniAppView';

export default function SettingsView({
  currentUser,
  elderId = null,
  isDarkMode,
  onToggleTheme,
  fontScale,
  onChangeFontScale
}) {
  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'zalo_miniapp'
  const [users, setUsers] = useState([]);
  const [elders, setElders] = useState([]);
  const [zaloConfig, setZaloConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Account & PIN state
  const [accountForm, setAccountForm] = useState({
    full_name: currentUser?.full_name || 'Nguyễn Văn Nam',
    username: currentUser?.username || 'anh_nam',
    phone: currentUser?.phone || '0987 654 321',
    email: 'nam.nguyen@mediguard.vn',
    relationship: 'Con trai cả (Người giám hộ chính)',
    caregiverPin: localStorage.getItem('mediguard_pin') || '1234'
  });

  // Add new caregiver modal
  const [showAddCaregiver, setShowAddCaregiver] = useState(false);
  const [newCaregiver, setNewCaregiver] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    relationship: 'Con gái / Người đồng chăm sóc'
  });
  const [creatingCaregiver, setCreatingCaregiver] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('mediguard_notif_prefs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      zaloInstantPush: true,
      missedDoseAlert: true,
      missedDoseDelayMinutes: 15,
      visionMismatchAlert: true,
      symptomEscalationCall: true,
      dailySummaryReport: true,
      dailyReportTime: '20:30',
      soundChimeEnabled: true
    };
  });

  // Voice assistant settings
  const [selectedVoice, setSelectedVoice] = useState(
    () => localStorage.getItem('mediguard_voice') || 'vi-VN-Google'
  );
  const [voiceRate, setVoiceRate] = useState(
    () => localStorage.getItem('mediguard_rate') || '-8%'
  );
  const [testingVoice, setTestingVoice] = useState(false);
  const [llmConfig, setLlmConfig] = useState(null);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState('');
  const [savingLLM, setSavingLLM] = useState(false);
  const [llmFeedbackMsg, setLlmFeedbackMsg] = useState('');
  const [testingAIQuestion, setTestingAIQuestion] = useState(false);
  const [aiTestResponse, setAiTestResponse] = useState('');
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);

  const handleQuickTestAI = async (question) => {
    if (testingAIQuestion) return;
    setTestingAIQuestion(true);
    setAiTestResponse('Đang kết nối trợ lý AI để trả lời...');
    try {
      const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
      const data = await fastAIReply(targetElderId, question, selectedVoice, voiceRate);
      if (data && data.reply) {
        setAiTestResponse(data.reply);
        await playVoiceSpeech(data.audio_url, data.reply, selectedVoice, voiceRate);
      } else {
        setAiTestResponse('Không nhận được câu trả lời từ trợ lý.');
      }
    } catch (err) {
      setAiTestResponse('Lỗi kiểm tra AI: ' + (err.message || 'Không có kết nối'));
    } finally {
      setTestingAIQuestion(false);
    }
  };

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [usersData, eldersData, zaloData, llmData] = await Promise.all([
        fetchUsers().catch(() => []),
        fetchElders().catch(() => []),
        fetchZaloConfig().catch(() => null),
        fetchLLMConfig().catch(() => null)
      ]);
      setUsers(usersData || []);
      setElders(eldersData || []);
      setZaloConfig(zaloData);
      if (llmData) setLlmConfig(llmData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setAccountForm((prev) => ({
        ...prev,
        full_name: currentUser.full_name || prev.full_name,
        username: currentUser.username || prev.username,
        phone: currentUser.phone || prev.phone
      }));
    }
  }, [currentUser]);

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
    localStorage.setItem('mediguard_notif_prefs', JSON.stringify(notifPrefs));
    localStorage.setItem('mediguard_pin', accountForm.caregiverPin);
    localStorage.setItem('mediguard_voice', selectedVoice);
    localStorage.setItem('mediguard_rate', voiceRate);
    setSavingMsg('Đã lưu tùy chọn tài khoản, người chăm sóc và thông báo thành công.');
    setTimeout(() => setSavingMsg(''), 4000);
  };

  const handleCreateCaregiver = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newCaregiver.username.trim() || !newCaregiver.full_name.trim()) return;
    setCreatingCaregiver(true);
    try {
      await registerUser({
        username: newCaregiver.username.trim(),
        password: newCaregiver.password || '123456',
        full_name: newCaregiver.full_name.trim(),
        role: 'caregiver',
        phone: newCaregiver.phone.trim() || '0912 345 678'
      });
      await loadSettingsData();
      setShowAddCaregiver(false);
      setNewCaregiver({
        username: '',
        password: '',
        full_name: '',
        phone: '',
        relationship: 'Con gái / Người đồng chăm sóc'
      });
      setSavingMsg('Đã thêm người chăm sóc mới vào gia đình.');
      setTimeout(() => setSavingMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Không thể tạo tài khoản người chăm sóc: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setCreatingCaregiver(false);
    }
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    const sample =
      selectedVoice === 'vi-VN-Google'
        ? 'Kính chào Bác! Đây là giọng đọc Chị Google quen thuộc của hệ thống MediGuard AI nhắc uống thuốc hàng ngày.'
        : selectedVoice === 'vi-VN-NamMinhNeural'
        ? 'Kính chào Bác! Đây là giọng đọc Nam Minh trầm ấm của hệ thống MediGuard AI nhắc uống thuốc hàng ngày.'
        : 'Kính chào Bác! Đây là giọng đọc Hoài My nhẹ nhàng của hệ thống MediGuard AI nhắc uống thuốc hàng ngày.';
    try {
      const res = await speakText(sample, selectedVoice, voiceRate);
      await playVoiceSpeech(res?.audio_url, sample, selectedVoice, voiceRate);
    } catch (err) {
      await playVoiceSpeech(null, sample, selectedVoice, voiceRate);
    } finally {
      setTestingVoice(false);
    }
  };

  const handleSaveLLM = async (e) => {
    if (e) e.preventDefault();
    setSavingLLM(true);
    setLlmFeedbackMsg('');
    try {
      await saveLLMConfig({
        gemini_api_key: geminiApiKeyInput.trim() || undefined,
        openai_api_key: openaiApiKeyInput.trim() || undefined
      });
      const updated = await fetchLLMConfig();
      setLlmConfig(updated);
      setGeminiApiKeyInput('');
      setOpenaiApiKeyInput('');
      setLlmFeedbackMsg('Đã lưu cấu hình LLM thành công! Trợ lý AI đã sẵn sàng trả lời thông minh mọi câu hỏi của Bác.');
      setTimeout(() => setLlmFeedbackMsg(''), 5000);
    } catch (err) {
      setLlmFeedbackMsg('Không thể lưu cấu hình LLM: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setSavingLLM(false);
    }
  };

  const caregiversList = users.filter((u) => u.role === 'caregiver');

  return (
    <div className="space-y-6">
      {/* Sub-navigation: Cài đặt hệ thống vs Zalo Mini App */}
      <div className="ui-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="ui-kicker block">
            TÀI KHOẢN & TÙY CHỌN HỆ THỐNG
          </span>
          <h2 className="ui-page-title mt-0.5">
            Cài đặt gia đình & thông báo an toàn
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubTab('general')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'general'
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1F3A]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Cài đặt chung</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('zalo_miniapp')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'zalo_miniapp'
                  ? 'bg-[#0D9488] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1F3A]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Cổng Zalo OA / Mini App</span>
            </button>
          </div>
        </div>
      </div>

      {savingMsg && (
        <div className="p-4 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 border border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4] text-xs sm:text-sm font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savingMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {activeSubTab === 'zalo_miniapp' ? (
        <ZaloMiniAppView />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (5 CỘT): THÔNG TIN TÀI KHOẢN & MẠNG LƯỚI NGƯỜI CHĂM SÓC */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Thông tin tài khoản đang đăng nhập */}
            <div className="ui-card overflow-hidden">
              <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0D9488] flex items-center justify-center font-display font-bold text-base">
                    {(accountForm.full_name || 'N').charAt(0)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#5EEAD4] block">
                      TÀI KHOẢN QUẢN TRỊ GIA ĐÌNH
                    </span>
                    <h3 className="text-base font-display font-bold text-white">
                      {accountForm.full_name}
                    </h3>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-mono font-semibold">
                  Đang hoạt động
                </span>
              </div>

              <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
                <div>
                  <label className="ui-label">Họ và tên người chăm sóc</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={accountForm.full_name}
                      onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })}
                      className="ui-input pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="ui-label">Số điện thoại khẩn cấp</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={accountForm.phone}
                        onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                        className="ui-input pl-10 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="ui-label">Mã PIN mở khóa Bác sĩ/Con</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        maxLength={6}
                        value={accountForm.caregiverPin}
                        onChange={(e) => setAccountForm({ ...accountForm, caregiverPin: e.target.value })}
                        className="ui-input pl-10 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="ui-label">Email nhận báo cáo tuân thủ hàng tuần</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={accountForm.email}
                      onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                      className="ui-input pl-10"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full ui-btn-primary py-2.5 text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu thông tin tài khoản</span>
                </button>
              </form>
            </div>

            {/* 2. Danh sách người chăm sóc trong gia đình */}
            <div className="ui-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="ui-kicker block">
                    ĐỘI NGŨ ĐỒNG HÀNH
                  </span>
                  <h3 className="ui-section-title">
                    Người chăm sóc ({caregiversList.length || 1})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCaregiver(!showAddCaregiver)}
                  className="ui-btn-subtle text-xs py-1.5 px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm người chăm sóc</span>
                </button>
              </div>

              {showAddCaregiver && (
                <form
                  onSubmit={handleCreateCaregiver}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="text-xs font-bold text-[#0B1F3A] dark:text-white">
                    Thêm tài khoản người đồng chăm sóc
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Họ và tên (VD: Chị Lan)"
                      value={newCaregiver.full_name}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, full_name: e.target.value })}
                      className="ui-input py-2 text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Tên đăng nhập (VD: chi_lan)"
                      value={newCaregiver.username}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, username: e.target.value })}
                      className="ui-input py-2 text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Số điện thoại Zalo"
                      value={newCaregiver.phone}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, phone: e.target.value })}
                      className="ui-input py-2 text-xs font-mono"
                    />
                    <input
                      type="password"
                      placeholder="Mật khẩu (mặc định 123456)"
                      value={newCaregiver.password}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, password: e.target.value })}
                      className="ui-input py-2 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCaregiver(false)}
                      className="ui-btn-secondary text-xs py-1.5 px-3"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={creatingCaregiver}
                      className="ui-btn-navy text-xs py-1.5 px-3.5"
                    >
                      {creatingCaregiver ? 'Đang tạo...' : 'Tạo tài khoản'}
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(caregiversList.length > 0
                  ? caregiversList
                  : [{ id: 1, full_name: accountForm.full_name, username: accountForm.username, phone: accountForm.phone }]
                ).map((cg, idx) => (
                  <div key={cg.id || idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-[#2DD4BF] font-display font-bold text-sm flex items-center justify-center shrink-0">
                        {(cg.full_name || 'C').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0B1F3A] dark:text-white truncate">
                          {cg.full_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          @{cg.username} {cg.phone ? `• ${cg.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] text-[11px] font-semibold border border-[#99F6E4] dark:border-[#0D9488]/30 shrink-0">
                      {idx === 0 ? 'Chính' : 'Đồng giám hộ'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (7 CỘT): TÙY CHỌN THÔNG BÁO, GIỌNG ĐỌC AI & HIỂN THỊ */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Tùy chọn thông báo đa kênh */}
            <div className="ui-card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="ui-section-title">
                      Tùy chọn thông báo & cảnh báo an toàn
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cấu hình cách MediGuard AI gửi cảnh báo khi người thân uống thuốc hoặc gặp triệu chứng.
                    </p>
                  </div>
                </div>

                {zaloConfig && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('zalo_miniapp')}
                    className="hidden sm:inline-flex ui-btn-secondary text-xs py-1.5 px-3"
                  >
                    <span>Zalo OA</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#0D9488]" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'zaloInstantPush',
                    title: 'Thông báo tức thì qua Zalo OA / Mini App',
                    desc: 'Gửi tin nhắn Zalo ngay khi Bác bấm xác nhận đã uống thuốc hoặc cần tư vấn.'
                  },
                  {
                    key: 'visionMismatchAlert',
                    title: 'Cảnh báo khẩn khi AI phát hiện sai viên thuốc (Mismatch)',
                    desc: 'Phát âm báo lớn và đẩy thông báo ưu tiên cao nếu ảnh chụp thuốc không khớp đơn.'
                  },
                  {
                    key: 'missedDoseAlert',
                    title: 'Nhắc nhở người nhà khi quá giờ chưa xác nhận uống',
                    desc: `Tự động nhắc người chăm sóc nếu sau ${notifPrefs.missedDoseDelayMinutes} phút chưa ghi nhận phản hồi.`
                  },
                  {
                    key: 'symptomEscalationCall',
                    title: 'Kích hoạt cảnh báo đỏ khi có triệu chứng bất thường',
                    desc: 'Đưa cảnh báo lên đầu Dashboard gia đình khi phát hiện chóng mặt, tức ngực, khó thở.'
                  },
                  {
                    key: 'dailySummaryReport',
                    title: 'Báo cáo tổng kết tuân thủ cuối ngày',
                    desc: `Tổng hợp tỷ lệ uống thuốc đúng giờ của cả gia đình vào lúc ${notifPrefs.dailyReportTime}.`
                  }
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.desc}
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifPrefs[item.key]}
                      onClick={() =>
                        setNotifPrefs((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                      }
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
                        notifPrefs[item.key] ? 'bg-[#0D9488]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                          notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="ui-label">Thời gian chờ trước khi báo trễ cữ (phút)</label>
                  <select
                    value={notifPrefs.missedDoseDelayMinutes}
                    onChange={(e) =>
                      setNotifPrefs({ ...notifPrefs, missedDoseDelayMinutes: Number(e.target.value) })
                    }
                    className="ui-select"
                  >
                    <option value={10}>Sau 10 phút</option>
                    <option value={15}>Sau 15 phút (Khuyên dùng)</option>
                    <option value={30}>Sau 30 phút</option>
                  </select>
                </div>

                <div>
                  <label className="ui-label">Giờ gửi báo cáo tổng kết hàng ngày</label>
                  <input
                    type="time"
                    value={notifPrefs.dailyReportTime}
                    onChange={(e) =>
                      setNotifPrefs({ ...notifPrefs, dailyReportTime: e.target.value })
                    }
                    className="ui-input font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 2. Cấu hình Giọng đọc AI & Khả năng tiếp cận */}
            <div className="ui-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="ui-section-title">
                      Trợ lý giọng nói & trải nghiệm người cao tuổi
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tùy chỉnh giọng đọc Neural TTS tiếng Việt và kích thước hiển thị dễ nhìn.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={testingVoice}
                  className="ui-btn-navy text-xs py-2 px-3.5 self-start sm:self-auto"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#2DD4BF]" />
                  <span>{testingVoice ? 'Đang phát thử...' : 'Nghe thử giọng đọc'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="ui-label">Giọng đọc phát loa nhắc thuốc</label>
                  <div className="p-3.5 rounded-xl border border-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🩺</span>
                      <div>
                        <div className="text-xs font-bold text-[#0B1F3A] dark:text-white">
                          Chị Google (vi-VN-Google)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Giọng đọc duy nhất chuẩn mực, quen thuộc, rõ chữ, chống loạn cho người già
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#0D9488] text-white shrink-0">
                      Cố định
                    </span>
                  </div>
                </div>

                <div>
                  <label className="ui-label">Nhịp độ đọc cho người lớn tuổi</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '-12%', label: 'Chậm rãi (-12%)' },
                      { id: '-8%', label: 'Tự nhiên (-8%)' }
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setVoiceRate(r.id)}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                          voiceRate === r.id
                            ? 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#0D9488] text-[#0B1F3A] dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cỡ chữ & Giao diện */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-[#0D9488]" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Cỡ chữ toàn hệ thống:
                  </span>
                  <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                    {[
                      { id: 'normal', label: 'Tiêu chuẩn' },
                      { id: 'large', label: 'Chữ lớn' },
                      { id: 'xlarge', label: 'Rất lớn' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChangeFontScale && onChangeFontScale(item.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          fontScale === item.id
                            ? 'bg-[#0B1F3A] text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="ui-btn-secondary text-xs py-2 px-3.5"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#0B1F3A]" />}
                    <span>{isDarkMode ? 'Chế độ Sáng (Clinical Light)' : 'Chế độ Tối (Clinical Dark)'}</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="ui-btn-primary text-xs py-2.5 px-5"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu toàn bộ tùy chọn</span>
                </button>
              </div>
            </div>

            {/* 3. Trí Tuệ Nhân Tạo Thông Minh (MediGuard AI Pro - Tự Động Kích Hoạt) */}
            <div className="ui-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="ui-section-title">
                      Trí tuệ nhân tạo giọng nói & Bầu bạn thông minh
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tự động suy nghĩ, cập nhật thời tiết thực tế, tâm sự sẻ chia và ghi nhận thuốc/triệu chứng cho Bác.
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Đã kích hoạt sẵn 100%</span>
                </div>
              </div>

              {/* Banner Bản Quyền Sẵn Sàng Xuất Xưởng */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100">
                        {llmConfig?.license_name || 'Bản quyền MediGuard AI Pro (Kích hoạt sẵn theo thiết bị)'}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800/80 text-emerald-800 dark:text-emerald-200">
                        SẴN SÀNG
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                      Người dùng và Bác mở máy lên là có thể trò chuyện tự nhiên ngay, hoàn toàn không cần thao tác kỹ thuật hay đăng ký mã khóa phức tạp.
                    </p>
                  </div>
                </div>
              </div>

              {/* Thanh Thử Nghiệm Nhanh Độ Thông Minh Của AI */}
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B1F3A] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#0D9488] animate-pulse" />
                    <span>Thử nghiệm nhanh câu trả lời của Trợ lý AI:</span>
                  </span>
                  {testingAIQuestion && (
                    <span className="text-xs font-semibold text-[#0D9488] animate-pulse">
                      Đang xử lý giọng nói...
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { q: 'Hôm nay thời tiết như thế nào hả cháu?', label: '🌤️ Hỏi thời tiết thực tế' },
                    { q: 'Bác buồn quá ở nhà một mình cô đơn', label: '💬 Bác tâm sự buồn' },
                    { q: 'Dạ cháu ơi, Bác uống thuốc cữ sáng rồi nhé', label: '💊 Báo đã uống thuốc' },
                    { q: 'Cháu kể cho Bác nghe một chuyện vui đi', label: '😄 Nghe chuyện vui' }
                  ].map((item) => (
                    <button
                      key={item.q}
                      type="button"
                      disabled={testingAIQuestion}
                      onClick={() => handleQuickTestAI(item.q)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1F3A] dark:text-slate-200 hover:border-[#0D9488] hover:bg-[#F0FDFA] dark:hover:bg-[#0D9488]/15 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {aiTestResponse && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/60 text-xs text-[#0B1F3A] dark:text-slate-100 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0D9488] block">
                      Phản hồi thực tế từ Trợ lý AI:
                    </span>
                    <p className="text-sm font-semibold leading-relaxed">
                      {aiTestResponse}
                    </p>
                  </div>
                )}
              </div>

              {/* Tùy chọn Nâng cao dành cho Kỹ thuật viên / Bệnh viện (Accordion) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedKeys(!showAdvancedKeys)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D9488] dark:text-slate-400 dark:hover:text-[#2DD4BF] transition-colors cursor-pointer"
                >
                  {showAdvancedKeys ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Tùy chọn nâng cao dành cho Chuyên viên CNTT / Bệnh viện (Tùy biến khóa LLM riêng)</span>
                </button>

                {showAdvancedKeys && (
                  <form onSubmit={handleSaveLLM} className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
                    {llmFeedbackMsg && (
                      <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{llmFeedbackMsg}</span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="ui-label mb-0">Khóa riêng Google Gemini API (Tùy chọn)</label>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#0D9488] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Lấy key tại Google AI Studio</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input
                        type="password"
                        placeholder={llmConfig?.has_gemini ? `Đã cấu hình riêng (${llmConfig.gemini_masked}) - Để trống nếu giữ nguyên` : "Mặc định sử dụng Cổng MediGuard AI đã kích hoạt"}
                        value={geminiApiKeyInput}
                        onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                        className="ui-input text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="ui-label">Khóa riêng OpenAI / Groq API (Tùy chọn)</label>
                      <input
                        type="password"
                        placeholder={llmConfig?.has_openai ? `Đã cấu hình riêng (${llmConfig.openai_masked})` : "sk-... hoặc gsk_... (Để trống nếu dùng mặc định)"}
                        value={openaiApiKeyInput}
                        onChange={(e) => setOpenaiApiKeyInput(e.target.value)}
                        className="ui-input text-xs font-mono"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={savingLLM}
                        className="ui-btn-primary text-xs py-2 px-4 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingLLM ? 'Đang lưu...' : 'Lưu cấu hình riêng'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
