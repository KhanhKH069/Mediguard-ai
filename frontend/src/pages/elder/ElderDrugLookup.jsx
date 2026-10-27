import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Camera,
  Pill,
  Volume2,
  RefreshCw,
  Search,
  AlertTriangle
} from 'lucide-react';
import { searchDrugs, lookupDrugByImage } from '../../services/api';
import { playVoiceSpeech } from '../../services/voiceService';
import { playChimeSound } from '../../utils/soundEffects';

const POPULAR_ELDER_DRUGS = [
  { name: 'Amlodipine 5mg', query: 'Amlodipine', label: 'Huyết áp' },
  { name: 'Panadol Extra', query: 'Panadol', label: 'Giảm đau • Hạ sốt' },
  { name: 'Metformin 500mg', query: 'Metformin', label: 'Đường huyết' },
  { name: 'Omeprazole 20mg', query: 'Omeprazole', label: 'Dạ dày' },
  { name: 'Ginkgo Biloba', query: 'Ginkgo', label: 'Tuần hoàn não' },
  { name: 'Berberin 50mg', query: 'Berberin', label: 'Tiêu hóa' }
];

export default function ElderDrugLookup({ onBack }) {
  const [query, setQuery] = useState('');
  const [drugResult, setDrugResult] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileInputRef = useRef(null);

  const handleSearch = async (searchTerm) => {
    const term = (searchTerm || query).trim();
    if (!term) return;
    setIsLoading(true);
    setNoticeMessage('');
    playChimeSound();

    try {
      const res = await searchDrugs(term);
      if (res && res.results && res.results.length > 0) {
        const found = res.results[0];
        setDrugResult(found);

        const speechText =
          `Dạ thưa Bác, thuốc ${found.name} thuộc nhóm ${found.category}. ` +
          `Công dụng là ${found.indication}. ` +
          `Liều dùng cho Bác là: ${found.dosage_elderly}`;
        speakResult(speechText);
      } else {
        setNoticeMessage('Dạ cháu chưa tìm thấy thuốc này trong sổ tay. Bác chạm chọn một thuốc quen thuộc bên dưới hoặc chụp ảnh vỏ hộp giúp cháu nhé!');
      }
    } catch (err) {
      setNoticeMessage('Chưa kết nối được sổ tay thuốc lúc này. Bác vui lòng thử lại sau ít giây nhé.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setNoticeMessage('');
    playChimeSound();

    try {
      const res = await lookupDrugByImage(file);
      if (res && res.drug_info) {
        const found = res.drug_info;
        setDrugResult(found);

        const speechText =
          `Dạ cháu đã nhận diện được đây là hộp thuốc ${found.name}, thuộc nhóm ${found.category}. ` +
          `Bác nhớ ${found.dosage_elderly}`;
        speakResult(speechText);
      } else {
        setNoticeMessage('Cháu chưa nhìn rõ nhãn thuốc trên ảnh. Bác chụp lại dưới ánh sáng rõ hơn hoặc chọn tên thuốc bên dưới nhé!');
      }
    } catch (err) {
      setNoticeMessage('Không thể nhận diện ảnh thuốc lúc này. Bác chụp lại rõ hơn hoặc bấm chọn tên thuốc bên dưới nhé!');
    } finally {
      setIsLoading(false);
    }
  };

  const speakResult = async (text) => {
    setIsSpeaking(true);
    try {
      await playVoiceSpeech(null, text);
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2.5 text-base font-bold text-[#0B1F3A] dark:text-white bg-white dark:bg-[#0E1E36] hover:bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-saas transition-all cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5 text-[#0D9488]" />
        <span>Quay lại trang chính</span>
      </button>

      <div className="space-y-1.5">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0D9488] px-2.5 py-1 rounded-md bg-[#F0FDFA] dark:bg-[#0D9488]/20">
          Sổ tay dược phẩm gia đình
        </span>
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-[#0B1F3A] dark:text-white">
          Tra Cứu Thông Tin Thuốc
        </h2>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
          Bác chụp ảnh vỏ hộp thuốc hoặc chạm vào tên thuốc bên dưới để nghe cháu đọc công dụng và cách uống.
        </p>
      </div>

      {noticeMessage && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-base sm:text-lg font-semibold">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* 2 Ô Thao tác chính: Chụp ảnh & Tìm kiếm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageCapture}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="p-6 rounded-2xl bg-[#0D9488] hover:bg-[#0F766E] text-white flex flex-col items-start justify-between gap-4 border-2 border-[#115E59] border-b-4 active:translate-y-0.5 transition-all text-left min-h-[150px] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center border border-white/25">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-display font-bold">Chụp Ảnh Vỏ Hộp Thuốc</div>
            <div className="text-xs sm:text-sm text-teal-100 mt-1">Đưa hộp thuốc hoặc vỉ thuốc trước máy ảnh</div>
          </div>
        </button>

        <div className="p-6 rounded-2xl bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas flex flex-col justify-between gap-4 min-h-[150px]">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[#0D9488]" />
            <span className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white">Tìm theo tên thuốc:</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ví dụ: Amlodipine, Panadol..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-3 text-base sm:text-lg font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white outline-none focus:border-[#0D9488]"
            />
            <button
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="px-5 py-3 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white font-bold text-base transition-colors cursor-pointer"
            >
              Tìm
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#0D9488] animate-spin mx-auto" />
          <p className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white">
            Cháu đang tìm thông tin thuốc cho Bác...
          </p>
        </div>
      )}

      {/* Kết quả tra cứu */}
      {drugResult && !isLoading && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas-md space-y-5">
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-dashed border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/20 px-3 py-1 rounded-md">
                {drugResult.category}
              </span>
              <h3 className="text-3xl sm:text-4xl font-display font-bold text-[#0B1F3A] dark:text-white mt-2">
                {drugResult.name}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium mt-1">
                Hoạt chất: {drugResult.active_ingredient}
              </p>
            </div>

            <button
              onClick={() => {
                const text = `Thuốc ${drugResult.name}, ${drugResult.category}. Công dụng: ${drugResult.indication}. Cách dùng: ${drugResult.dosage_elderly}`;
                speakResult(text);
              }}
              disabled={isSpeaking}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-sm transition-colors shrink-0 cursor-pointer"
            >
              <Volume2 className="w-5 h-5" />
              <span>{isSpeaking ? 'Đang đọc...' : 'Đọc Lại'}</span>
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 space-y-1.5">
            <div className="text-xs font-mono font-bold text-[#0D9488] uppercase tracking-wider">
              01 • Công dụng điều trị
            </div>
            <p className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] dark:text-white leading-snug">
              {drugResult.indication}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="text-xs font-mono font-bold text-[#0B1F3A] dark:text-[#2DD4BF] uppercase tracking-wider">
              02 • Liều lượng & cách uống cho người cao tuổi
            </div>
            <p className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] dark:text-white leading-snug">
              {drugResult.dosage_elderly}
            </p>
          </div>

          {drugResult.elder_notes && (
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-base sm:text-lg font-medium text-amber-900 dark:text-amber-200">
              <strong>Lưu ý an toàn:</strong> {drugResult.elder_notes}
            </div>
          )}
        </div>
      )}

      {/* Các loại thuốc quen thuộc */}
      <div className="space-y-3">
        <h4 className="text-base font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Pill className="w-4 h-4 text-[#0D9488]" />
          <span>Các thuốc thường dùng trong tủ thuốc gia đình:</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_ELDER_DRUGS.map((item) => (
            <button
              key={item.query}
              onClick={() => handleSearch(item.query)}
              className="p-4 rounded-2xl bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 hover:border-[#0D9488] shadow-saas text-left transition-all active:translate-y-0.5 cursor-pointer"
            >
              <div className="text-xs font-mono font-bold text-[#0D9488] uppercase tracking-wider">
                {item.label}
              </div>
              <div className="text-lg sm:text-xl font-display font-bold text-[#0B1F3A] dark:text-white mt-1">
                {item.name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
