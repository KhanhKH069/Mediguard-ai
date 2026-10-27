import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Search,
  User,
  HeartPulse,
  RefreshCw,
  BellRing,
  Check,
  Plus,
  Mic,
  Square,
  Keyboard,
  ListChecks,
  X,
  Loader2
} from 'lucide-react';
import { fetchSymptoms, confirmSymptom, reportSymptom, connectRealtimeUpdates } from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';
import { createSpeechRecognizer, unlockAllAudio } from '../../services/voiceService';

const SEVERITY_STYLE = {
  'Khẩn cấp': {
    bar: 'bg-red-600',
    pill: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/60',
    dot: 'bg-red-600'
  },
  'Trung bình': {
    bar: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500'
  },
  'Nhẹ': {
    bar: 'bg-[#0D9488]',
    pill: 'bg-[#F0FDFA] text-[#0F766E] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4] border border-[#99F6E4] dark:border-[#0D9488]/40',
    dot: 'bg-[#0D9488]'
  }
};

const SOURCE_PREFIX = /^Nguồn ghi nhận: [^.]+\.\s*/;

function detectSource(item) {
  const action = (item.action_taken || '').toLowerCase();
  if (action.includes('giọng nói')) return { label: 'Giọng nói', icon: Mic };
  if (action.includes('văn bản')) return { label: 'Văn bản', icon: Keyboard };
  if (action.includes('chọn nhanh')) return { label: 'Chọn nhanh', icon: ListChecks };
  return null;
}

export default function SymptomManager({ elderId, currentUser }) {
  const [symptomsData, setSymptomsData] = useState({
    total: 0,
    today_count: 0,
    unhandled_count: 0,
    by_date: {},
    symptoms: []
  });
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState('voice');
  const [newSymptomText, setNewSymptomText] = useState('');
  const [newSeverity, setNewSeverity] = useState('Trung bình');
  const [isRecording, setIsRecording] = useState(false);
  const [interimVoice, setInterimVoice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const recognizerRef = useRef(null);

  const showToast = (text, type = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const loadSymptoms = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSymptoms(elderId, selectedDateFilter || null);
      setSymptomsData(data || { total: 0, today_count: 0, unhandled_count: 0, by_date: {}, symptoms: [] });
    } catch (err) {
      console.error('Lỗi tải danh sách triệu chứng:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSymptoms();

    const disconnect = connectRealtimeUpdates((msg) => {
      if (msg.type === 'symptom_alert' || msg.type === 'symptom_confirmed') {
        playChimeSound();
        loadSymptoms();
      }
    });

    return () => disconnect();
  }, [elderId, selectedDateFilter]);

  useEffect(() => {
    const rec = createSpeechRecognizer(
      (transcript, isFinal) => {
        if (isFinal) {
          setNewSymptomText((prev) => {
            const clean = prev.trim();
            return clean ? `${clean}. ${transcript}` : transcript;
          });
          setInterimVoice('');
        } else {
          setInterimVoice(transcript);
        }
      },
      (err) => {
        setIsRecording(false);
        if (err === 'not-allowed') setModalError('Micro chưa được cấp quyền trên trình duyệt.');
      },
      () => setIsRecording(false),
      { continuous: true, interimResults: true }
    );
    recognizerRef.current = rec;

    return () => {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const stopRecording = () => {
    if (isRecording && recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
      setIsRecording(false);
    }
  };

  const toggleRecording = async () => {
    await unlockAllAudio();
    setModalError(null);
    if (!recognizerRef.current) {
      setModalError('Trình duyệt này chưa hỗ trợ ghi âm. Vui lòng dùng chế độ nhập văn bản.');
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    playChimeSound();
    setInterimVoice('');
    try {
      recognizerRef.current.start();
      setIsRecording(true);
    } catch (e) {
      setIsRecording(false);
    }
  };

  const closeModal = () => {
    stopRecording();
    setShowAddModal(false);
    setModalError(null);
  };

  const handleSaveNewSymptom = async () => {
    const text = (newSymptomText || interimVoice).trim();
    if (!text) {
      setModalError('Vui lòng nói hoặc nhập nội dung triệu chứng.');
      return;
    }

    stopRecording();
    setIsSaving(true);
    try {
      const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
      if (!targetElderId) {
        showToast('Vui lòng chọn hồ sơ người cao tuổi trước khi ghi nhận triệu chứng.', 'error');
        setIsSaving(false);
        return;
      }
      await reportSymptom(
        targetElderId,
        text,
        newSeverity,
        text,
        'Người nhà ghi nhận thay cho Bác.',
        modalMode
      );

      playChimeSound();
      setShowAddModal(false);
      setNewSymptomText('');
      setInterimVoice('');
      setNewSeverity('Trung bình');
      setModalError(null);
      showToast('Đã lưu triệu chứng vào sổ theo dõi.');
      loadSymptoms();
    } catch (err) {
      setModalError('Không thể lưu triệu chứng: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSymptom = async (symptomId) => {
    try {
      const caregiverId = currentUser?.user_id;
      await confirmSymptom(symptomId, caregiverId, 'Đã liên hệ kiểm tra bác an toàn');
      showToast('Đã xác nhận xử lý triệu chứng.');
      loadSymptoms();
    } catch (err) {
      showToast('Không thể xác nhận: ' + (err.message || 'Vui lòng thử lại'), 'error');
    }
  };

  const filteredSymptoms = symptomsData.symptoms.filter((item) => {
    const matchSearch =
      item.symptom_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.reported_date.includes(searchQuery);

    if (!matchSearch) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    if (activeTab === 'unhandled') return !item.caregiver_confirmed;
    if (activeTab === 'today') return item.reported_date === todayStr;
    return true;
  });

  const groupedByDate = filteredSymptoms.reduce((acc, curr) => {
    const d = curr.reported_date || 'Chưa rõ ngày';
    if (!acc[d]) acc[d] = [];
    acc[d].push(curr);
    return acc;
  }, {});

  const datesList = Object.keys(groupedByDate).sort().reverse();
  const todayStr = new Date().toISOString().split('T')[0];

  const stats = [
    { label: 'Ghi nhận hôm nay', value: symptomsData.today_count, unit: 'lần', icon: BellRing, tint: 'text-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/20' },
    { label: 'Chưa kiểm tra', value: symptomsData.unhandled_count, unit: 'cần xem', icon: AlertTriangle, tint: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
    { label: 'Tổng bản ghi', value: symptomsData.total, unit: 'lượt', icon: Activity, tint: 'text-[#0B1F3A] bg-slate-100 dark:bg-slate-800 dark:text-[#2DD4BF]' }
  ];

  return (
    <div className="space-y-5 text-[#0B1F3A] dark:text-white">
      {feedbackToast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
            feedbackToast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200'
              : 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackToast.text}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="ui-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h2 className="ui-section-title">Sổ theo dõi triệu chứng hàng ngày</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ghi nhận khi Bác nói, gõ chữ hoặc chọn nhanh · Đồng bộ tức thời tới người thân
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSymptoms}
            disabled={isLoading}
            className="ui-btn-secondary text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0D9488]' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="ui-btn-primary text-xs py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi nhận mới</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, unit, icon: Icon, tint }) => (
          <div key={label} className="ui-card p-5 flex items-center gap-3.5">
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="text-2xl font-display font-bold leading-tight mt-0.5 tabular-nums">
                {value} <span className="text-xs font-sans font-normal text-slate-500">{unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="ui-card p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'today', label: 'Hôm nay' },
            { id: 'unhandled', label: 'Chưa xử lý' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm triệu chứng..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:border-[#0D9488] outline-none"
            />
          </div>
          <input
            type="date"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:border-[#0D9488] outline-none cursor-pointer"
          />
        </div>
      </div>

      {datesList.length === 0 ? (
        <div className="ui-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-display font-bold">Chưa có triệu chứng bất thường nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có bản ghi nào trong khoảng thời gian này. Sức khỏe của Bác đang ổn định.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {datesList.map((dateStr) => {
            const items = groupedByDate[dateStr];
            const isToday = dateStr === todayStr;

            return (
              <section key={dateStr} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1 text-xs font-mono text-slate-500">
                  <Calendar className="w-4 h-4 text-[#0D9488]" />
                  <span className="font-bold text-[#0B1F3A] dark:text-white">{isToday ? 'Hôm nay' : dateStr}</span>
                  {isToday && <span>· {dateStr}</span>}
                  <span>· {items.length} bản ghi</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {items.map((item) => {
                    const sev = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE['Trung bình'];
                    const source = detectSource(item);
                    const SourceIcon = source?.icon;
                    const actionText = (item.action_taken || '').replace(SOURCE_PREFIX, '');

                    return (
                      <article key={item.id} className="ui-card relative overflow-hidden pl-5 pr-4 py-4">
                        <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${sev.bar}`} aria-hidden="true" />

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-display font-bold leading-snug">{item.symptom_name}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1 font-mono tabular-nums">
                                <Clock className="w-3.5 h-3.5" />
                                {item.reported_time}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {item.elder_name}
                              </span>
                              {source && (
                                <span className="flex items-center gap-1">
                                  <SourceIcon className="w-3.5 h-3.5" />
                                  {source.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${sev.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                            {item.severity}
                          </span>
                        </div>

                        {item.description && item.description !== item.symptom_name && (
                          <p className="mt-3 text-sm italic">“{item.description}”</p>
                        )}
                        {actionText && (
                          <p className="mt-1.5 text-xs text-slate-500">{actionText}</p>
                        )}

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          {item.caregiver_confirmed ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              Đã kiểm tra
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Chưa kiểm tra
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <a
                              href="tel:0901234567"
                              className="ui-btn-secondary text-xs py-1.5 px-3"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#0D9488]" />
                              Gọi Bác
                            </a>
                            {!item.caregiver_confirmed && (
                              <button
                                onClick={() => handleConfirmSymptom(item.id)}
                                className="ui-btn-primary text-xs py-1.5 px-3"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Đã xử lý
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-xs"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas-lg"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-display font-bold">Ghi nhận triệu chứng mới</h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {[
                  { id: 'voice', label: 'Giọng nói', icon: Mic },
                  { id: 'text', label: 'Văn bản', icon: Keyboard }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (id !== 'voice') stopRecording();
                      setModalMode(id);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalMode === id
                        ? 'bg-[#0B1F3A] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {modalMode === 'voice' && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer ${
                      isRecording ? 'bg-red-600' : 'bg-[#0D9488] hover:bg-[#0F766E]'
                    }`}
                  >
                    {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-6 h-6" />}
                  </button>
                  <div className="text-xs">
                    <p className="font-bold text-sm">{isRecording ? 'Đang ghi âm...' : 'Bấm để bắt đầu ghi âm'}</p>
                    <p className="text-slate-500">
                      {isRecording ? 'Bấm lần nữa để dừng' : 'Lời nói sẽ chuyển thành chữ bên dưới'}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="ui-label">Nội dung triệu chứng</label>
                <textarea
                  value={newSymptomText}
                  onChange={(e) => setNewSymptomText(e.target.value)}
                  placeholder="Ví dụ: Bác chóng mặt, đau mỏi vai gáy từ trưa"
                  rows={3}
                  className="ui-input resize-none"
                />
                {interimVoice && <p className="text-xs text-slate-500 italic">Đang nghe: {interimVoice}</p>}
              </div>

              <div className="space-y-1.5">
                <span className="ui-label">Mức độ</span>
                <div className="grid grid-cols-3 gap-2">
                  {['Nhẹ', 'Trung bình', 'Khẩn cấp'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setNewSeverity(lvl)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        newSeverity === lvl
                          ? 'border-[#0D9488] bg-[#F0FDFA] text-[#0F766E] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4]'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${SEVERITY_STYLE[lvl].dot}`} />
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {modalError && (
                <p className="flex items-start gap-2 text-xs font-bold text-red-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {modalError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeModal}
                className="ui-btn-secondary text-xs py-2 px-4"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveNewSymptom}
                disabled={isSaving || (!newSymptomText.trim() && !interimVoice.trim())}
                className="ui-btn-primary text-xs py-2 px-4"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Lưu & báo người nhà
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
