import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Volume2,
  Mic,
  Square,
  Send,
  RotateCcw,
  Keyboard,
  ListChecks,
  Loader2,
  ChevronRight,
  Waves,
  Brain,
  Frown,
  Activity,
  Wind,
  HeartPulse,
  BatteryLow,
  Pill,
  Stethoscope
} from 'lucide-react';
import { reportSymptom } from '../../services/api';
import { playVoiceSpeech, createSpeechRecognizer, unlockAllAudio } from '../../services/voiceService';
import { playChimeSound } from '../../utils/soundEffects';

const QUICK_SYMPTOMS = [
  { id: 'chong_mat', name: 'Chóng mặt, hoa mắt', severity: 'Khẩn cấp', icon: Waves, desc: 'Choáng váng, đứng không vững' },
  { id: 'dau_dau', name: 'Đau đầu, nhức đầu', severity: 'Trung bình', icon: Brain, desc: 'Nặng đầu hoặc đau nửa đầu' },
  { id: 'buon_non', name: 'Buồn nôn, cồn cào', severity: 'Khẩn cấp', icon: Frown, desc: 'Khó chịu trong bụng, muốn nôn' },
  { id: 'dau_bung', name: 'Đau bụng, đầy hơi', severity: 'Khẩn cấp', icon: Activity, desc: 'Đau quặn hoặc chướng bụng' },
  { id: 'kho_tho', name: 'Khó thở, hụt hơi', severity: 'Khẩn cấp', icon: Wind, desc: 'Thở dốc, tức ngực' },
  { id: 'tim_dap_nhanh', name: 'Tim đập nhanh', severity: 'Khẩn cấp', icon: HeartPulse, desc: 'Hồi hộp, đánh trống ngực' },
  { id: 'met_moi', name: 'Rất mệt trong người', severity: 'Trung bình', icon: BatteryLow, desc: 'Bủn rủn tay chân, không có sức' },
  { id: 'uong_nham', name: 'Nghi uống nhầm thuốc', severity: 'Khẩn cấp', icon: Pill, desc: 'Lấy nhầm ngăn hoặc vỉ thuốc khác' }
];

const SUGGESTED_PHRASES = [
  'Bác thấy đau tức ngực',
  'Bác bị chóng mặt, buồn nôn',
  'Bác đau nhức khớp gối',
  'Bác bị sốt, người nóng',
  'Bác thấy khó thở',
  'Bác lỡ uống nhầm thuốc'
];

const KEYWORD_CHIPS = [
  'Chóng mặt', 'Đau đầu', 'Buồn nôn', 'Đau bụng', 'Khó thở', 'Tức ngực',
  'Tim đập nhanh', 'Sốt', 'Mệt mỏi', 'Đau lưng', 'Tê tay chân', 'Uống nhầm thuốc'
];

const EMERGENCY_WORDS = [
  'tức ngực', 'thắt ngực', 'khó thở', 'hụt hơi', 'uống nhầm',
  'ngất', 'bất tỉnh', 'co giật', 'liệt', 'méo miệng', 'choáng váng nặng',
  'nôn ra máu', 'đau nhói tim'
];

const SEVERITY_LEVELS = [
  { id: 'Nhẹ', label: 'Nhẹ', sub: 'Lưu sổ theo dõi', dot: 'bg-emerald-600', active: 'border-[#0D9488] bg-teal-50/80 dark:bg-teal-950/60' },
  { id: 'Trung bình', label: 'Cần chú ý', sub: 'Người nhà hỏi thăm', dot: 'bg-amber-600', active: 'border-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  { id: 'Khẩn cấp', label: 'Khẩn cấp', sub: 'Gọi cho Bác ngay', dot: 'bg-red-600', active: 'border-red-600 bg-red-50 dark:bg-red-950/40' }
];

const SOURCE_LABEL = { voice: 'Giọng nói', text: 'Gõ chữ', quick: 'Chọn nhanh' };

const TABS = [
  { id: 'voice', label: 'Bằng giọng nói', icon: Mic },
  { id: 'text', label: 'Gõ chữ', icon: Keyboard },
  { id: 'quick', label: 'Chọn nhanh', icon: ListChecks }
];

export default function ElderSymptomReport({ onBack, currentUser, elderId = null }) {
  const [activeTab, setActiveTab] = useState('voice');
  const [symptomText, setSymptomText] = useState('');
  const [severity, setSeverity] = useState('Trung bình');
  const [isSevereDetected, setIsSevereDetected] = useState(false);
  const [inputSource, setInputSource] = useState('voice');

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechError, setSpeechError] = useState(null);
  const recognizerRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportedResult, setReportedResult] = useState(null);
  const [isPlayingReassurance, setIsPlayingReassurance] = useState(false);

  useEffect(() => {
    const textLower = `${symptomText} ${interimText}`.toLowerCase();
    const hasEmergency = EMERGENCY_WORDS.some((word) => textLower.includes(word));
    setIsSevereDetected(hasEmergency);
    if (hasEmergency) setSeverity('Khẩn cấp');
  }, [symptomText, interimText]);

  useEffect(() => {
    unlockAllAudio();

    const rec = createSpeechRecognizer(
      (transcript, isFinal) => {
        setSpeechError(null);
        if (isFinal) {
          setSymptomText((prev) => {
            const clean = prev.trim();
            return clean ? `${clean}. ${transcript}` : transcript;
          });
          setInterimText('');
          setInputSource('voice');
        } else {
          setInterimText(transcript);
        }
      },
      (err) => {
        setIsListening(false);
        if (err === 'not-allowed') {
          setSpeechError('Micro chưa được cấp quyền. Bác bấm "Cho phép" trên trình duyệt, hoặc chuyển sang mục "Gõ chữ" nhé.');
        } else if (err === 'no-speech') {
          setSpeechError('Cháu chưa nghe rõ. Bác bấm micro và nói to hơn một chút nhé.');
        }
      },
      () => setIsListening(false),
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

  const stopListening = () => {
    if (isListening && recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }
  };

  const toggleListening = async () => {
    await unlockAllAudio();
    setSpeechError(null);

    if (!recognizerRef.current) {
      setSpeechError('Trình duyệt này chưa hỗ trợ micro. Bác dùng mục "Gõ chữ" hoặc "Chọn nhanh" nhé.');
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    playChimeSound();
    setInterimText('');
    try {
      recognizerRef.current.start();
      setIsListening(true);
      setInputSource('voice');
    } catch (e) {
      setIsListening(false);
    }
  };

  const switchTab = (tabId) => {
    if (tabId !== 'voice') stopListening();
    setActiveTab(tabId);
  };

  const clearText = () => {
    setSymptomText('');
    setInterimText('');
  };

  const submitReport = async (titleOverride, severityOverride, descOverride, sourceOverride) => {
    const rawText = (titleOverride || symptomText || interimText || '').trim();
    if (!rawText) {
      setSpeechError('Bác hãy nói hoặc gõ triệu chứng trước khi gửi nhé.');
      return;
    }

    stopListening();
    setIsSubmitting(true);
    playChimeSound();

    const usedSeverity = severityOverride || severity;
    const usedSource = sourceOverride || inputSource;

    try {
      const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
      if (!targetElderId) {
        setSpeechError('Chưa chọn hồ sơ người cao tuổi để báo cáo triệu chứng.');
        return;
      }
      const res = await reportSymptom(
        targetElderId,
        rawText,
        usedSeverity,
        descOverride || rawText,
        '',
        usedSource
      );

      setReportedResult({
        symptom: res.symptom?.symptom_name || rawText,
        description: res.symptom?.description || rawText,
        severity: res.symptom?.severity || usedSeverity,
        time: res.reported_time,
        date: res.reported_date,
        speech: res.reply_speech,
        source: usedSource
      });

      setIsPlayingReassurance(true);
      await playVoiceSpeech(null, res.reply_speech);
    } catch (err) {
      setSpeechError('Không gửi được báo cáo: ' + err.message + '. Bác thử lại hoặc gọi điện cho con nhé.');
    } finally {
      setIsSubmitting(false);
      setIsPlayingReassurance(false);
    }
  };

  const replayReassuranceSpeech = async () => {
    if (!reportedResult?.speech) return;
    setIsPlayingReassurance(true);
    try {
      await playVoiceSpeech(null, reportedResult.speech);
    } finally {
      setIsPlayingReassurance(false);
    }
  };

  const handleReportAnother = () => {
    setReportedResult(null);
    clearText();
    setSeverity('Trung bình');
    setIsSevereDetected(false);
    setSpeechError(null);
  };

  const hasText = Boolean(symptomText.trim() || interimText.trim());
  const isEmergency = severity === 'Khẩn cấp';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#0B1F3A] dark:text-white">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2.5 text-base font-bold text-[#0B1F3A] dark:text-white bg-white dark:bg-[#0E1E36] hover:bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-saas transition-all cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5 text-[#0D9488]" />
        <span>Quay lại trang chính</span>
      </button>

      {reportedResult ? (
        <div className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas-md rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="text-center space-y-2.5">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center mx-auto border-2 border-[#0D9488]">
              <CheckCircle2 className="w-9 h-9 text-[#0D9488]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold">
              Đã Ghi Sổ & Báo Cho Các Con
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
              Con cháu đã nhận được thông báo trên điện thoại rồi ạ.
            </p>
          </div>

          <dl className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-base sm:text-lg bg-slate-50 dark:bg-slate-800/70">
            <div className="flex justify-between gap-4 px-5 py-3.5">
              <dt className="text-slate-600 dark:text-slate-400">Triệu chứng:</dt>
              <dd className="font-bold text-right">{reportedResult.symptom}</dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3.5">
              <dt className="text-slate-600 dark:text-slate-400">Mức độ:</dt>
              <dd className="font-bold flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${SEVERITY_LEVELS.find((l) => l.id === reportedResult.severity)?.dot || 'bg-amber-600'}`} />
                <span>{reportedResult.severity}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3.5">
              <dt className="text-slate-600 dark:text-slate-400">Thời gian:</dt>
              <dd className="font-mono font-semibold">{reportedResult.time} • {reportedResult.date}</dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3.5">
              <dt className="text-slate-600 dark:text-slate-400">Hình thức ghi:</dt>
              <dd className="font-semibold text-[#0D9488]">{SOURCE_LABEL[reportedResult.source] || 'Khác'}</dd>
            </div>
          </dl>

          <div className="rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#0D9488] font-mono font-bold text-xs uppercase tracking-wider">
              <Stethoscope className="w-4 h-4" />
              <span>Lời dặn dành cho Bác:</span>
            </div>
            <p className="text-xl sm:text-2xl font-display font-bold leading-relaxed">{reportedResult.speech}</p>
            <button
              onClick={replayReassuranceSpeech}
              disabled={isPlayingReassurance}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#0D9488] hover:underline disabled:opacity-60 pt-1 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>{isPlayingReassurance ? 'Đang đọc cho Bác nghe...' : 'Nghe lại lời dặn'}</span>
            </button>
          </div>

          <div className="grid gap-3 pt-2">
            <a
              href="tel:0987654321"
              className="flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xl font-display font-bold border-2 border-[#115E59] border-b-4 transition-all"
            >
              <Phone className="w-6 h-6" />
              <span>Gọi Điện Cho Con Ngay</span>
            </a>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleReportAnother}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ghi thêm mục khác</span>
              </button>
              <button
                onClick={onBack}
                className="py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Về trang chính
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="space-y-1.5">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60">
              Sổ theo dõi triệu chứng tại nhà
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold">
              Bác đang thấy khó chịu ở đâu ạ?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
              Bác có thể nói bằng giọng nói, gõ chữ hoặc chạm chọn nhanh. Cháu sẽ lưu vào sổ và báo cho con cháu ngay.
            </p>
          </header>

          {/* Bộ chuyển phương thức nhập */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => switchTab(id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
                  activeTab === id
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0B1F3A]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {speechError && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 text-amber-900 dark:text-amber-200 text-base font-semibold">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <span>{speechError}</span>
            </div>
          )}

          {/* TAB 1: NÓI */}
          {activeTab === 'voice' && (
            <section className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col items-center gap-4 py-2">
                <button
                  onClick={toggleListening}
                  aria-label={isListening ? 'Dừng ghi âm' : 'Bắt đầu nói'}
                  className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white transition-all active:translate-y-1 border-4 border-b-8 cursor-pointer ${
                    isListening
                      ? 'bg-red-600 border-red-800'
                      : 'bg-[#0D9488] hover:bg-[#0F766E] border-[#115E59]'
                  }`}
                >
                  {isListening ? <Square className="w-12 h-12 fill-current" /> : <Mic className="w-14 h-14 stroke-[2.2]" />}
                </button>

                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-display font-bold">
                    {isListening ? 'Cháu đang nghe Bác nói...' : 'Chạm vào Micro để nói triệu chứng'}
                  </p>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
                    {isListening ? 'Bác nói xong thì chạm lại vào nút để dừng' : 'Ví dụ: “Bác thấy chóng mặt và buồn nôn từ sáng”'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 min-h-[100px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold text-[#0D9488] uppercase tracking-wider">
                    Nội dung đã ghi nhận:
                  </span>
                  {hasText && (
                    <button onClick={clearText} className="text-xs font-bold text-red-600 hover:underline cursor-pointer">
                      Xóa để nói lại
                    </button>
                  )}
                </div>
                {hasText ? (
                  <p className="text-xl sm:text-2xl font-display font-bold leading-relaxed">
                    {symptomText}
                    {interimText && <span className="text-slate-400"> {interimText}</span>}
                  </p>
                ) : (
                  <p className="text-base text-slate-500">Chưa có nội dung. Bác chạm vào Micro bên trên hoặc chọn câu mẫu bên dưới nhé.</p>
                )}
              </div>

              <div className="space-y-2.5">
                <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Hoặc chạm nhanh câu có sẵn:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      onClick={() => {
                        setSymptomText(phrase);
                        setInputSource('voice');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: GÕ CHỮ */}
          {activeTab === 'text' && (
            <section className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="symptom-text-input" className="text-lg font-display font-bold block">
                  Mô tả cảm giác trong người của Bác:
                </label>
                <textarea
                  id="symptom-text-input"
                  value={symptomText}
                  onChange={(e) => {
                    setSymptomText(e.target.value);
                    setInputSource('text');
                  }}
                  rows={4}
                  placeholder="Ví dụ: Bác bị nhức đầu và buồn nôn từ 9 giờ sáng..."
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#0D9488] text-lg sm:text-xl font-medium outline-none transition resize-none"
                />
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>{symptomText.length} ký tự</span>
                  {symptomText && (
                    <button onClick={clearText} className="font-bold text-red-600 hover:underline cursor-pointer">
                      Xóa hết
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">Chạm để thêm từ khóa:</p>
                <div className="flex flex-wrap gap-2">
                  {KEYWORD_CHIPS.map((word) => (
                    <button
                      key={word}
                      onClick={() => {
                        setSymptomText((prev) => {
                          const clean = prev.trim();
                          return clean ? `${clean}, ${word.toLowerCase()}` : word;
                        });
                        setInputSource('text');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-teal-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                    >
                      + {word}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: CHỌN NHANH */}
          {activeTab === 'quick' && (
            <section className="space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Bác chạm vào một mục bên dưới, cháu sẽ gửi thông báo đến điện thoại của con cháu ngay:
              </p>
              <ul className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas rounded-3xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {QUICK_SYMPTOMS.map((item) => {
                  const Icon = item.icon;
                  const urgent = item.severity === 'Khẩn cấp';
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => submitReport(item.name, item.severity, item.desc, 'quick')}
                        disabled={isSubmitting}
                        className="w-full flex items-center gap-4 px-6 py-4.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        <span className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0D9488] flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                          <Icon className="w-6 h-6" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xl font-display font-bold">{item.name}</span>
                            {urgent && (
                              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                                Khẩn cấp
                              </span>
                            )}
                          </span>
                          <span className="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</span>
                        </span>
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Mức độ & Nút gửi */}
          {activeTab !== 'quick' && (
            <section className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas rounded-3xl p-6 sm:p-8 space-y-5">
              {isSevereDetected && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-base font-semibold">
                  <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span>Phát hiện triệu chứng cần lưu ý đặc biệt, cháu đã chuyển sang mức <strong>Khẩn cấp</strong> để báo người nhà gọi ngay cho Bác.</span>
                </div>
              )}

              <fieldset className="space-y-2.5">
                <legend className="text-base font-bold mb-1">Mức độ khó chịu của Bác:</legend>
                <div className="grid grid-cols-3 gap-2.5">
                  {SEVERITY_LEVELS.map((level) => {
                    const selected = severity === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setSeverity(level.id)}
                        aria-pressed={selected}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          selected ? level.active : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-base sm:text-lg font-display font-bold">
                          <span className={`w-3 h-3 rounded-full ${level.dot}`} />
                          {level.label}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{level.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <button
                onClick={() => submitReport()}
                disabled={isSubmitting || !hasText}
                className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-xl font-display font-bold text-white border-2 border-b-4 transition-all active:translate-y-0.5 disabled:opacity-50 cursor-pointer ${
                  isEmergency
                    ? 'bg-red-600 hover:bg-red-700 border-red-900'
                    : 'bg-[#0D9488] hover:bg-[#0F766E] border-[#115E59]'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-5 h-5" />}
                <span>{isSubmitting ? 'Đang gửi thông báo cho con...' : 'Gửi Vào Sổ Báo Cho Con Cháu'}</span>
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
