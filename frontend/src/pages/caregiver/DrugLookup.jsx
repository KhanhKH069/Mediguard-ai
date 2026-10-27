import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Camera,
  Upload,
  Pill,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  Plus,
  RefreshCw,
  FileText,
  X,
  ScanLine,
  BookOpen,
  Volume2
} from 'lucide-react';
import {
  fetchMedications,
  verifyPillImage,
  speakText,
  getMediaUrl,
  fetchDrugCatalog,
  searchDrugs,
  lookupDrugByImage,
  addDrugToElderMedications,
  scanPrescription,
  batchAddPrescription
} from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';

const CATEGORIES = [
  'Tất cả',
  'Thuốc Tim Mạch - Hạ Huyết Áp',
  'Thuốc Tiểu Đường',
  'Thuốc Tiêu Hóa - Dạ Dày',
  'Giảm Đau - Hạ Sốt',
  'Thuốc Bổ Não & Tuần Hoàn'
];

export default function DrugLookup({ elderId = 1 }) {
  const [activeMode, setActiveMode] = useState('verify'); // 'verify' | 'image' | 'prescription' | 'text'
  const [feedbackToast, setFeedbackToast] = useState(null);

  const showToast = (text, type = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 4500);
  };

  // State cho Trạm Kiểm Tra Hình Ảnh Thuốc (Match / Mismatch / Low Confidence)
  const [elderMeds, setElderMeds] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('1');
  const [verifyPreview, setVerifyPreview] = useState('/demo_pills/amlodipine.jpg');
  const [verifyResult, setVerifyResult] = useState({
    cv_status: 'MATCHED',
    confidence_score: 0.96,
    message: 'Hình ảnh vỉ thuốc trùng khớp với mẫu Amlodipine 5mg trong phác đồ điều trị của Bác.'
  });
  const [isVerifyingPill, setIsVerifyingPill] = useState(false);
  const verifyInputRef = useRef(null);

  // State cho Tra cứu dược điển
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [drugs, setDrugs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState(null);

  // State cho Nhận diện vỏ hộp
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageScanResult, setImageScanResult] = useState(null);
  const fileInputRef = useRef(null);

  // State cho Modal thêm thuốc vào lịch
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState('Sáng');
  const [targetDosage, setTargetDosage] = useState('1 viên');
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccessMessage, setAddSuccessMessage] = useState('');

  // State cho Quét đơn thuốc bệnh viện
  const [prescriptionText, setPrescriptionText] = useState('');
  const [isScanningPrescription, setIsScanningPrescription] = useState(false);
  const [prescriptionResult, setPrescriptionResult] = useState(null);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [batchAddSuccess, setBatchAddSuccess] = useState('');
  const presFileInputRef = useRef(null);

  useEffect(() => {
    fetchMedications(elderId)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setElderMeds(data);
          setSelectedMedId(String(data[0].id));
        }
      })
      .catch((e) => console.warn('Lỗi tải danh mục thuốc:', e));
  }, [elderId]);

  const currentSelectedMed = elderMeds.find((m) => String(m.id) === String(selectedMedId)) || elderMeds[0];

  const handleRunPillVerification = async (blobOrFile, previewUrl) => {
    setIsVerifyingPill(true);
    setVerifyPreview(previewUrl);
    playChimeSound();

    const formData = new FormData();
    formData.append('medication_id', selectedMedId || '1');
    formData.append('file', blobOrFile, 'pill_check.jpg');

    try {
      const data = await verifyPillImage(formData);
      setVerifyResult(data);
      if (data.message) {
        speakText(data.message).catch(() => {});
      }
    } catch (err) {
      setVerifyResult({
        cv_status: 'LOW_CONFIDENCE',
        confidence_score: 0.42,
        message: 'Hình ảnh chưa đủ độ nét hoặc thiếu sáng. Đề nghị chụp lại dưới ánh sáng rõ hoặc nhờ người chăm sóc kiểm tra trực tiếp.'
      });
    } finally {
      setIsVerifyingPill(false);
    }
  };

  const handleVerifySample = async (sampleType) => {
    let path = '/demo_pills/amlodipine.jpg';
    if (sampleType === 'LOW_CONFIDENCE') {
      path = '/demo_pills/low_confidence_sample.jpg';
    } else if (sampleType === 'MISMATCH') {
      path = '/demo_pills/mismatch_capsule.jpg';
    }

    try {
      setIsVerifyingPill(true);
      setVerifyPreview(path);
      const res = await fetch(path);
      const blob = await res.blob();
      await handleRunPillVerification(blob, path);
    } catch (e) {
      setIsVerifyingPill(false);
    }
  };

  const handleScanPrescription = async (fileOrText) => {
    setIsScanningPrescription(true);
    setPrescriptionResult(null);
    setBatchAddSuccess('');
    try {
      const res = await scanPrescription(fileOrText);
      setPrescriptionResult(res);
    } catch (err) {
      showToast('Lỗi quét đơn thuốc: ' + (err.message || 'Vui lòng thử lại'), 'error');
    } finally {
      setIsScanningPrescription(false);
    }
  };

  const handleBatchAddPrescription = async () => {
    if (!prescriptionResult || !prescriptionResult.items) return;
    const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
    if (!targetElderId) {
      showToast('Vui lòng chọn hồ sơ người cao tuổi trước khi lưu đơn thuốc.', 'error');
      return;
    }
    setIsBatchAdding(true);
    try {
      const res = await batchAddPrescription({
        elder_id: targetElderId,
        items: prescriptionResult.items,
        create_schedules: true
      });
      if (res && res.success) {
        setBatchAddSuccess(`${res.message}`);
        showToast(res.message);
        setTimeout(() => setBatchAddSuccess(''), 4000);
      }
    } catch (err) {
      showToast('Lỗi thêm thuốc: ' + (err.message || 'Vui lòng thử lại'), 'error');
    } finally {
      setIsBatchAdding(false);
    }
  };

  const loadCatalog = async () => {
    setIsLoading(true);
    try {
      const cat = selectedCategory === 'Tất cả' ? null : selectedCategory;
      const res = await fetchDrugCatalog(cat);
      setDrugs(res.drugs || []);
    } catch (err) {
      console.error('Lỗi tải danh mục thuốc:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'text' && !searchQuery.trim()) {
      loadCatalog();
    }
  }, [selectedCategory, activeMode]);

  useEffect(() => {
    if (!searchQuery.trim()) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await searchDrugs(searchQuery.trim());
        setDrugs(res.results || []);
      } catch (err) {
        console.error('Lỗi tìm kiếm thuốc:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setIsAnalyzingImage(true);
    setImageScanResult(null);

    try {
      const res = await lookupDrugByImage(file);
      if (res && res.success) {
        setImageScanResult(res);
        if (res.drug_info) {
          setSelectedDrug(res.drug_info);
        }
      }
    } catch (err) {
      showToast('Không thể nhận diện hình ảnh: ' + (err.message || 'Vui lòng thử lại'), 'error');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleAddToElderSchedule = async () => {
    if (!selectedDrug) return;
    const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
    if (!targetElderId) {
      showToast('Vui lòng chọn hồ sơ người cao tuổi trước khi thêm thuốc.', 'error');
      return;
    }
    setIsAdding(true);
    setAddSuccessMessage('');

    try {
      const res = await addDrugToElderMedications({
        elder_id: targetElderId,
        drug_id: selectedDrug.id,
        time_period: targetPeriod,
        dosage: targetDosage,
        instruction: `Uống cữ ${targetPeriod} theo chỉ định: ${selectedDrug.dosage_elderly}`
      });

      if (res && res.success) {
        const msg = `Đã thêm "${selectedDrug.name}" vào cữ ${targetPeriod} của Bác thành công!`;
        setAddSuccessMessage(msg);
        showToast(msg);
        setTimeout(() => {
          setIsAddModalOpen(false);
          setAddSuccessMessage('');
        }, 1500);
      }
    } catch (err) {
      showToast('Lỗi thêm thuốc: ' + (err.message || 'Vui lòng thử lại'), 'error');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedbackToast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
            feedbackToast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200'
              : 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {feedbackToast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
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

      {/* Header & Mode Switcher */}
      <div className="ui-card p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0B1F3A] text-white flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-[#2DD4BF]" />
          </div>
          <div>
            <span className="ui-kicker block">TRẠM THỊ GIÁC MÁY TÍNH & DƯỢC ĐIỂN</span>
            <h2 className="ui-page-title mt-0.5">
              Kiểm tra hình ảnh thuốc & Dược điển AI
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Đối chiếu quang học vỉ thuốc với mẫu chuẩn (Phù hợp / Không khớp / Chưa đủ chắc chắn) và tra cứu thông tin thuốc
            </p>
          </div>
        </div>

        {/* 4 Chế độ */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 self-start lg:self-auto">
          {[
            { id: 'verify', label: 'Đối chiếu ảnh thuốc', icon: ShieldCheck },
            { id: 'image', label: 'Nhận diện vỏ hộp', icon: Camera },
            { id: 'prescription', label: 'Quét đơn bệnh viện', icon: FileText },
            { id: 'text', label: 'Từ điển dược phẩm', icon: BookOpen }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1F3A] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CHẾ ĐỘ 1 (MẶC ĐỊNH): ĐỐI CHIẾU HÌNH ẢNH THUỐC (PHÙ HỢP / KHÔNG KHỚP / CHƯA ĐỦ CHẮC CHẮN) */}
      {activeMode === 'verify' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Chọn thuốc đối chiếu, tải ảnh & 3 kịch bản mẫu */}
          <div className="lg:col-span-7 ui-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="ui-section-title">
                  1. Chọn thuốc chuẩn & Tải ảnh kiểm tra
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hệ thống so sánh đặc trưng hình thái, màu sắc và cấu trúc vỉ thuốc với ảnh mẫu đã duyệt
                </p>
              </div>

              <select
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white outline-none focus:border-[#0D9488] cursor-pointer"
              >
                {elderMeds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.dosage}) — Cữ {m.time_period}
                  </option>
                ))}
              </select>
            </div>

            {/* Khung So Sánh Trực Quan: Ảnh Thực Tế vs Ảnh Mẫu Chuẩn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ảnh thực tế đang kiểm tra */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Ảnh thuốc đưa vào kiểm tra</span>
                  <span className="font-mono text-[11px] text-[#0D9488]">Camera / Tải lên</span>
                </div>
                <div className="relative aspect-4/3 rounded-2xl bg-slate-950 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  {verifyPreview ? (
                    <img
                      src={verifyPreview}
                      alt="Ảnh thuốc kiểm tra"
                      className={`w-full h-full object-contain transition-all ${
                        verifyResult?.cv_status === 'LOW_CONFIDENCE' ? 'blur-[1.5px] brightness-90' : ''
                      }`}
                    />
                  ) : (
                    <div className="text-center text-slate-400 p-4 text-xs">
                      <Camera className="w-8 h-8 mx-auto mb-1.5 opacity-60" />
                      <span>Chưa chọn ảnh</span>
                    </div>
                  )}

                  {isVerifyingPill && (
                    <div className="absolute inset-0 bg-[#0B1F3A]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                      <ScanLine className="w-8 h-8 text-[#2DD4BF] animate-pulse" />
                      <span className="text-xs font-mono font-semibold text-[#5EEAD4]">
                        Đang phân tích thị giác máy tính...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ảnh mẫu chuẩn trong hồ sơ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Ảnh mẫu chuẩn trong hồ sơ</span>
                  <span className="font-mono text-[11px] text-slate-500">Đã duyệt bởi người nhà</span>
                </div>
                <div className="relative aspect-4/3 rounded-2xl bg-slate-100 dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <img
                    src={
                      currentSelectedMed?.reference_image
                        ? getMediaUrl(`/storage/reference_images/${currentSelectedMed.reference_image.split(/[\\/]/).pop()}`)
                        : '/demo_pills/amlodipine.jpg'
                    }
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/demo_pills/amlodipine.jpg';
                    }}
                    alt="Ảnh mẫu chuẩn"
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#0B1F3A]/85 text-white text-[11px] font-semibold backdrop-blur-xs">
                    Mẫu chuẩn: {currentSelectedMed?.name || 'Amlodipine 5mg'}
                  </span>
                </div>
              </div>
            </div>

            {/* Nút tải ảnh từ thiết bị & 3 nút kiểm thử nhanh 3 trạng thái */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  ref={verifyInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleRunPillVerification(file, URL.createObjectURL(file));
                    }
                  }}
                />
                <button
                  onClick={() => verifyInputRef.current?.click()}
                  disabled={isVerifyingPill}
                  className="ui-btn-primary text-xs sm:text-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải ảnh thuốc lên để đối chiếu</span>
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Hoặc chọn nhanh 3 kịch bản kiểm thử bên dưới:
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleVerifySample('MATCHED')}
                  disabled={isVerifyingPill}
                  className="p-3 rounded-xl bg-[#F0FDFA] hover:bg-[#CCFBF1] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/40 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F766E] dark:text-[#5EEAD4]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Mẫu 1: Phù hợp</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Vỉ Amlodipine 5mg đúng chuẩn
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifySample('MISMATCH')}
                  disabled={isVerifyingPill}
                  className="p-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Mẫu 2: Không khớp</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Viên nang Redoxin khác loại
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifySample('LOW_CONFIDENCE')}
                  disabled={isVerifyingPill}
                  className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Mẫu 3: Chưa chắc chắn</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Ảnh mờ / thiếu sáng cần chụp lại
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Cột phải: Kết quả phân tích AI 3 trạng thái & Khuyến nghị hành động */}
          <div className="lg:col-span-5 ui-card p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="ui-section-title">
                  2. Kết quả đánh giá hình ảnh thuốc
                </h3>
                {verifyResult?.message && (
                  <button
                    onClick={() => speakText(verifyResult.message).catch(() => {})}
                    className="ui-btn-subtle text-xs py-1.5 px-3"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>Đọc kết quả</span>
                  </button>
                )}
              </div>

              {verifyResult && (
                <div
                  className={`p-5 rounded-2xl border-2 space-y-3 transition-all ${
                    verifyResult.cv_status === 'MATCHED'
                      ? 'bg-[#F0FDFA] dark:bg-[#0D9488]/15 border-[#0D9488] text-[#0B1F3A] dark:text-white'
                      : verifyResult.cv_status === 'MISMATCH'
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-950 dark:text-red-100'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {verifyResult.cv_status === 'MATCHED' && (
                      <div className="w-11 h-11 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    )}
                    {verifyResult.cv_status === 'MISMATCH' && (
                      <div className="w-11 h-11 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                    )}
                    {verifyResult.cv_status === 'LOW_CONFIDENCE' && (
                      <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                        <HelpCircle className="w-6 h-6" />
                      </div>
                    )}

                    <div>
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider opacity-75 block">
                        Trạng thái: {verifyResult.cv_status}
                      </span>
                      <h4 className="text-lg font-display font-bold leading-snug">
                        {verifyResult.cv_status === 'MATCHED' && 'Kết quả: Phù hợp với mẫu chuẩn'}
                        {verifyResult.cv_status === 'MISMATCH' && 'Cảnh báo: Không khớp mẫu thuốc'}
                        {verifyResult.cv_status === 'LOW_CONFIDENCE' && 'Kết quả: Chưa đủ chắc chắn'}
                      </h4>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed font-medium">
                    {verifyResult.message}
                  </p>

                  {/* Độ tin cậy quang học */}
                  <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Chỉ số tương đồng quang học (Confidence)</span>
                      <span className="font-mono font-bold text-sm tabular-nums">
                        {Math.round((verifyResult.confidence_score ?? verifyResult.score ?? 0.92) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/80 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          verifyResult.cv_status === 'MATCHED'
                            ? 'bg-[#0D9488]'
                            : verifyResult.cv_status === 'MISMATCH'
                            ? 'bg-red-600'
                            : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.round((verifyResult.confidence_score ?? verifyResult.score ?? 0.92) * 100)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Bảng đối chiếu 3 tiêu chí hình thái học */}
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                    {[
                      {
                        label: 'Hình thái viên',
                        value:
                          verifyResult.cv_status === 'MATCHED'
                            ? 'Trùng khớp'
                            : verifyResult.cv_status === 'MISMATCH'
                            ? 'Sai lệch'
                            : 'Mờ nét'
                      },
                      {
                        label: 'Màu sắc & Vỉ',
                        value:
                          verifyResult.cv_status === 'MATCHED'
                            ? 'Đúng chuẩn'
                            : verifyResult.cv_status === 'MISMATCH'
                            ? 'Khác màu'
                            : 'Thiếu sáng'
                      },
                      {
                        label: 'Khuyến nghị',
                        value:
                          verifyResult.cv_status === 'MATCHED'
                            ? 'An toàn uống'
                            : verifyResult.cv_status === 'MISMATCH'
                            ? 'Dừng uống ngay'
                            : 'Chụp lại ảnh'
                      }
                    ].map((crit) => (
                      <div
                        key={crit.label}
                        className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10"
                      >
                        <span className="block text-[10px] opacity-70">{crit.label}</span>
                        <strong className="font-semibold block mt-0.5">{crit.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hướng dẫn xử lý theo 3 trạng thái */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-2 text-xs">
                <div className="font-bold text-[#0B1F3A] dark:text-white">
                  Quy trình xử lý 3 trạng thái của MediGuard AI:
                </div>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0D9488] mt-1 shrink-0" />
                    <span><strong>Phù hợp (Matched):</strong> Xác nhận đúng thuốc trong đơn, cho phép Bác uống an toàn.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600 mt-1 shrink-0" />
                    <span><strong>Không khớp (Mismatch):</strong> Phát cảnh báo giọng nói tức thời và gửi thông báo khẩn cho người chăm sóc.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                    <span><strong>Chưa đủ chắc chắn (Low Confidence):</strong> Hướng dẫn chụp lại hoặc giữ nguyên khay thuốc chờ con cháu kiểm tra.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span>Tự động lưu kết quả vào Nhật ký theo dõi</span>
              <span className="font-mono text-[#0D9488]">Vision Guard v2</span>
            </div>
          </div>
        </div>
      )}

      {/* CHẾ ĐỘ 2: TRA CỨU BẰNG HÌNH ẢNH VỎ HỘP */}
      {activeMode === 'image' && (
        <div className="ui-card p-6 space-y-6">
          <div className="max-w-2xl mx-auto text-center space-y-1.5">
            <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
              Chụp hoặc tải lên ảnh hộp thuốc / vỉ thuốc
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hệ thống đối chiếu nhãn thuốc với danh mục dược điển và kiểm tra lưu ý an toàn cho người lớn tuổi
            </p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="max-w-xl mx-auto p-8 rounded-2xl border-2 border-dashed border-[#0D9488]/40 hover:border-[#0D9488] bg-slate-50/70 dark:bg-slate-900/60 cursor-pointer transition-all flex flex-col items-center justify-center gap-4 text-center"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
              }}
            />

            {imagePreview ? (
              <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img
                  src={imagePreview}
                  alt="Ảnh thuốc đã tải lên"
                  className="w-full h-56 object-cover"
                />
                {isAnalyzingImage && (
                  <div className="absolute inset-0 bg-[#0B1F3A]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white">
                    <ScanLine className="w-9 h-9 text-[#2DD4BF] animate-pulse" />
                    <span className="text-xs font-mono font-bold text-[#5EEAD4]">
                      Đang phân tích nhãn thuốc...
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] dark:text-[#2DD4BF] flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                    Bấm vào đây để chọn ảnh hộp thuốc hoặc vỉ thuốc
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Hỗ trợ ảnh JPG, PNG, WEBP</p>
                </div>
              </>
            )}
          </div>

          {imageScanResult && imageScanResult.drug_info && (
            <div className="max-w-2xl mx-auto p-5 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0D9488] text-white flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono font-bold text-[#0F766E] dark:text-[#5EEAD4]">
                      Độ khớp: {Math.round(imageScanResult.confidence * 100)}%
                    </span>
                    <h4 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
                      {imageScanResult.drug_info.name}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedDrug(imageScanResult.drug_info);
                    setIsAddModalOpen(true);
                  }}
                  className="ui-btn-primary text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm vào đơn của Bác</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-[#0D9488]">Hoạt chất:</span>
                  <p className="text-[#0B1F3A] dark:text-white mt-0.5">{imageScanResult.drug_info.active_ingredient}</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-[#0D9488]">Nhóm tác dụng:</span>
                  <p className="text-[#0B1F3A] dark:text-white mt-0.5">{imageScanResult.drug_info.category}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-[#0D9488]">Hướng dẫn dùng cho người cao tuổi:</span>
                <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{imageScanResult.drug_info.dosage_elderly}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHẾ ĐỘ 3: QUÉT ĐƠN THUỐC BỆNH VIỆN */}
      {activeMode === 'prescription' && (
        <div className="ui-card p-6 space-y-6">
          <div className="max-w-2xl mx-auto text-center space-y-1.5">
            <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
              Chụp hoặc nhập nội dung đơn thuốc bệnh viện
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tự động đọc tên thuốc, liều lượng, cữ uống (Sáng / Trưa / Tối) và lưu thẳng vào lịch nhắc của Bác
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <div
              onClick={() => presFileInputRef.current?.click()}
              className="p-6 rounded-2xl border-2 border-dashed border-[#0D9488]/40 hover:border-[#0D9488] bg-slate-50 dark:bg-slate-900/50 cursor-pointer transition-all flex flex-col items-center justify-center gap-3 text-center"
            >
              <input
                type="file"
                ref={presFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleScanPrescription(e.target.files[0]);
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                  Chụp hoặc chọn ảnh đơn thuốc
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Nhận diện chữ in trên toa thuốc</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <span className="ui-label">Hoặc dán nội dung đơn thuốc:</span>
                <textarea
                  rows={3}
                  value={prescriptionText}
                  onChange={(e) => setPrescriptionText(e.target.value)}
                  placeholder="Ví dụ:&#10;1. Amlodipine 5mg: 1 viên - Sáng sau ăn&#10;2. Meloxicam 7.5mg: 1 viên - Trưa sau ăn no"
                  className="ui-input text-xs"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sample = "1. Amlodipine 5mg: 1 viên - Sáng sau ăn\n2. Meloxicam 7.5mg: 1 viên - Trưa sau ăn no\n3. Metformin 500mg: 1 viên - Tối sau bữa ăn\n4. Carbocistein 250mg: 2 viên - Sáng, Tối";
                    setPrescriptionText(sample);
                    handleScanPrescription(sample);
                  }}
                  className="text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                >
                  Điền đơn mẫu thử nghiệm
                </button>
                <button
                  onClick={() => handleScanPrescription(prescriptionText)}
                  disabled={isScanningPrescription || !prescriptionText.trim()}
                  className="ui-btn-primary text-xs py-2 px-4"
                >
                  {isScanningPrescription ? 'Đang bóc tách...' : 'Phân tích đơn'}
                </button>
              </div>
            </div>
          </div>

          {prescriptionResult && (
            <div className="max-w-4xl mx-auto space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#0F766E] dark:text-[#5EEAD4]">
                    Đã bóc tách thành công ({prescriptionResult.total_medications} loại thuốc)
                  </span>
                  <p className="text-sm font-bold text-[#0B1F3A] dark:text-white mt-0.5">
                    {prescriptionResult.hospital_or_clinic} — {prescriptionResult.diagnosis}
                  </p>
                </div>
                <button
                  onClick={handleBatchAddPrescription}
                  disabled={isBatchAdding}
                  className="ui-btn-primary text-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isBatchAdding ? 'Đang lưu vào lịch...' : 'Lưu tất cả vào lịch của Bác'}</span>
                </button>
              </div>

              {batchAddSuccess && (
                <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{batchAddSuccess}</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="ui-table-head">
                      <th className="ui-table-th">Tên thuốc bóc tách</th>
                      <th className="ui-table-th">Liều lượng</th>
                      <th className="ui-table-th">Cữ uống</th>
                      <th className="ui-table-th">Hướng dẫn sử dụng</th>
                      <th className="ui-table-th text-center">Độ khớp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {prescriptionResult.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="ui-table-td">
                          <div className="font-bold text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
                            <span>{item.standardized_name}</span>
                            {item.is_in_database && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0FDFA] text-[#0D9488] font-bold">
                                Đã chuẩn hóa
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">{item.category}</span>
                        </td>
                        <td className="ui-table-td font-mono font-bold text-[#0B1F3A] dark:text-white">
                          {item.dosage}
                        </td>
                        <td className="ui-table-td">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#0B1F3A] text-white">
                            Cữ {item.time_period}
                          </span>
                        </td>
                        <td className="ui-table-td text-slate-600 dark:text-slate-300">
                          {item.instruction}
                        </td>
                        <td className="ui-table-td text-center font-mono font-bold text-[#0D9488]">
                          {Math.round(item.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHẾ ĐỘ 4: TỪ ĐIỂN DƯỢC PHẨM */}
      {activeMode === 'text' && (
        <div className="space-y-5">
          <div className="ui-card p-5 space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Nhập tên thuốc, hoạt chất hoặc bệnh lý (ví dụ: Amlodipine, Panadol, tiểu đường, huyết áp...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-[#0B1F3A] dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0D9488] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1F3A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSearchQuery('');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat && !searchQuery
                      ? 'bg-[#0B1F3A] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-7 h-7 text-[#0D9488] animate-spin mx-auto mb-2" />
              <span className="text-sm text-slate-500 font-semibold">Đang tra cứu dược điển...</span>
            </div>
          ) : drugs.length === 0 ? (
            <div className="ui-card p-12 text-center">
              <Pill className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0B1F3A] dark:text-white">Không tìm thấy thông tin thuốc phù hợp</h3>
              <p className="text-xs text-slate-500 mt-1">
                Hãy thử tìm bằng tên hoạt chất hoặc chuyển sang chế độ nhận diện bằng ảnh vỏ hộp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drugs.map((drug) => (
                <div
                  key={drug.id}
                  onClick={() => setSelectedDrug(drug)}
                  className="ui-card-interactive p-5 flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                          {drug.category}
                        </span>
                        <h4 className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white group-hover:text-[#0D9488] transition-colors">
                          {drug.name}
                        </h4>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center shrink-0">
                        <Pill className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                      <p>
                        <span className="font-bold text-[#0B1F3A] dark:text-white">Hoạt chất:</span> {drug.active_ingredient}
                      </p>
                      <p className="line-clamp-2">
                        <span className="font-bold text-[#0B1F3A] dark:text-white">Chỉ định:</span> {drug.indication}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[#0D9488]">
                    <span>Xem chi tiết dược lý</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT THUỐC */}
      {selectedDrug && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-saas-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 dark:bg-[#0E1E36]/95 backdrop-blur-md p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#0D9488]">
                    {selectedDrug.category}
                  </span>
                  <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
                    {selectedDrug.name}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedDrug(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500">Hoạt chất & Nồng độ</span>
                <p className="text-base font-bold text-[#0B1F3A] dark:text-white mt-0.5">
                  {selectedDrug.active_ingredient}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1.5">Công dụng & Chỉ định điều trị</h4>
                <p className="text-[#0B1F3A] dark:text-white leading-relaxed bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedDrug.indication}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1.5">Liều dùng & Hướng dẫn cho người cao tuổi</h4>
                <div className="p-4 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 text-[#0B1F3A] dark:text-white leading-relaxed">
                  {selectedDrug.dosage_elderly}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                  <h5 className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Chống chỉ định</span>
                  </h5>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedDrug.contraindications}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                  <h5 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Tương tác cần tránh</span>
                  </h5>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedDrug.interactions}
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/95 dark:bg-[#0E1E36]/95 backdrop-blur-md p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedDrug(null)}
                className="ui-btn-secondary text-xs py-2.5 px-5"
              >
                Đóng
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="ui-btn-primary text-xs py-2.5 px-6"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm thuốc này vào cữ của Bác</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN THÊM VÀO LỊCH */}
      {isAddModalOpen && selectedDrug && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-saas-lg">
            <h4 className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Pill className="w-5 h-5 text-[#0D9488]" />
              <span>Thêm "{selectedDrug.name}"</span>
            </h4>
            <p className="text-xs text-slate-500">
              Thuốc sẽ được bổ sung vào danh mục điều trị của Bác {elderId ? `(Mã #${elderId})` : ''}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="ui-label">Chọn cữ uống:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Sáng', 'Trưa', 'Tối'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setTargetPeriod(p)}
                      className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                        targetPeriod === p
                          ? 'bg-[#0D9488] text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Cữ {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="ui-label">Liều lượng:</label>
                <input
                  type="text"
                  value={targetDosage}
                  onChange={(e) => setTargetDosage(e.target.value)}
                  className="ui-input"
                  placeholder="Ví dụ: 1 viên, 2 viên..."
                />
              </div>

              {addSuccessMessage && (
                <div className="p-3 rounded-xl bg-[#F0FDFA] text-[#0F766E] font-bold text-center">
                  {addSuccessMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                disabled={isAdding}
                className="ui-btn-secondary text-xs py-2 px-4"
              >
                Hủy
              </button>
              <button
                onClick={handleAddToElderSchedule}
                disabled={isAdding}
                className="ui-btn-primary text-xs py-2 px-5"
              >
                {isAdding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Xác nhận thêm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
