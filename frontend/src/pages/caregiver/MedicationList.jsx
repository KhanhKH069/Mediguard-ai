import React, { useState, useEffect } from 'react';
import {
  Plus,
  Pill,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldAlert,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import {
  fetchMedications,
  deleteMedication,
  connectRealtimeUpdates,
  createMedication,
  uploadMedicationImage,
  getMediaUrl
} from '../../services/api';

const PRESET_MEDICATIONS = [
  {
    name: 'Amlodipine 5mg',
    category: 'Thuốc Huyết Áp',
    dosage: '1 viên',
    timePeriod: 'Sáng',
    instruction: 'Uống sau ăn sáng 30 phút với nước ấm'
  },
  {
    name: 'Glucophage XR 500mg',
    category: 'Tiểu Đường Tuýp 2',
    dosage: '1 viên',
    timePeriod: 'Tối',
    instruction: 'Uống ngay sau bữa ăn tối, không nhai vỡ viên'
  },
  {
    name: 'Tanakan 40mg (Ginkgo)',
    category: 'Tuần Hoàn Não',
    dosage: '1 viên',
    timePeriod: 'Trưa',
    instruction: 'Uống trong bữa ăn trưa với nửa cốc nước'
  },
  {
    name: 'Crestor 10mg (Rosuvastatin)',
    category: 'Mỡ Máu / Tim Mạch',
    dosage: '1 viên',
    timePeriod: 'Tối',
    instruction: 'Uống cố định vào buổi tối trước khi nghỉ ngơi'
  }
];

export default function MedicationList({ elderId = null, currentUser = null }) {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Thuốc Huyết Áp');
  const [dosage, setDosage] = useState('1 viên');
  const [instruction, setInstruction] = useState('Uống sau khi ăn 30 phút với nước ấm');
  const [timePeriod, setTimePeriod] = useState('Sáng');
  const [uploadingId, setUploadingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const [medToDelete, setMedToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

  const showFeedback = (type, text) => {
    setStatusFeedback({ type, text });
    setTimeout(() => setStatusFeedback(null), 4500);
  };

  const loadMeds = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await fetchMedications(activeElderId);
      setMedications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải danh mục thuốc:', err);
      setLoadError('Không thể tải danh mục thuốc từ máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeds();

    const disconnect = connectRealtimeUpdates((msg) => {
      if (['schedule_updated', 'medication_created', 'medication_deleted'].includes(msg.type) || msg.action) {
        loadMeds();
      }
    });

    return () => disconnect();
  }, [activeElderId]);

  const applyPreset = (preset) => {
    setName(preset.name);
    setCategory(preset.category);
    setDosage(preset.dosage);
    setTimePeriod(preset.timePeriod);
    setInstruction(preset.instruction);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showFeedback('error', 'Vui lòng nhập tên thuốc và hàm lượng trước khi lưu.');
      return;
    }

    setIsAdding(true);
    try {
      await createMedication({
        elder_id: activeElderId,
        name: name.trim(),
        category,
        dosage,
        instruction,
        time_period: timePeriod
      });

      const savedName = name.trim();
      setName('');
      showFeedback('success', `Đã thêm thuốc "${savedName}" vào danh mục điều trị.`);
      await loadMeds();
    } catch (err) {
      console.error(err);
      showFeedback('error', `Lỗi khi lưu thuốc: ${err.message || 'Không thể kết nối máy chủ'}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!medToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMedication(medToDelete.id);
      showFeedback('success', `Đã xóa thuốc "${medToDelete.name}" khỏi danh mục.`);
      setMedToDelete(null);
      await loadMeds();
    } catch (err) {
      showFeedback('error', `Lỗi khi xóa thuốc: ${err.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadImage = async (medId, file) => {
    if (!file) return;
    setUploadingId(medId);
    try {
      await uploadMedicationImage(medId, file);
      showFeedback('success', 'Đã cập nhật ảnh mẫu tham chiếu cho thuật toán AI.');
      await loadMeds();
    } catch (err) {
      showFeedback('error', `Lỗi tải ảnh mẫu: ${err.message || 'Không thể tải tệp lên'}`);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {statusFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 transition-all ${
            statusFeedback.type === 'success'
              ? 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4]'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusFeedback.text}</span>
          </div>
          <button
            onClick={() => setStatusFeedback(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loadError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-4 text-red-800 dark:text-red-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{loadError}</span>
          </div>
          <button
            onClick={loadMeds}
            className="ui-btn-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Form thêm thuốc mới */}
      <div className="ui-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 text-[#0D9488] dark:text-[#2DD4BF] flex items-center justify-center border border-[#99F6E4] dark:border-[#0D9488]/30 shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="ui-section-title">
                Thêm thuốc mới vào hồ sơ điều trị
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cấu hình tên thuốc, liều lượng và cữ uống chuẩn theo đơn bác sĩ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-[#0D9488]" /> Điền nhanh:
            </span>
            {PRESET_MEDICATIONS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#F0FDFA] dark:bg-slate-800 dark:hover:bg-[#0D9488]/20 text-[11px] font-semibold text-slate-600 hover:text-[#0F766E] dark:text-slate-300 dark:hover:text-[#5EEAD4] border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ui-label">Tên thuốc & Hàm lượng *</label>
              <input
                type="text"
                placeholder="Ví dụ: Amlodipine 5mg hoặc Glucophage 500mg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="ui-input"
              />
            </div>
            <div>
              <label className="ui-label">Nhóm bệnh / Công dụng</label>
              <input
                type="text"
                placeholder="Ví dụ: Thuốc Huyết Áp, Tiểu Đường, Dạ Dày..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="ui-label">Liều lượng uống</label>
              <input
                type="text"
                placeholder="Ví dụ: 1 viên, 2 viên..."
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="ui-input"
              />
            </div>
            <div>
              <label className="ui-label">Cữ uống trong ngày</label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="ui-select"
              >
                <option value="Sáng">Cữ Sáng</option>
                <option value="Trưa">Cữ Trưa</option>
                <option value="Chiều">Cữ Chiều</option>
                <option value="Tối">Cữ Tối</option>
              </select>
            </div>
            <div>
              <label className="ui-label">Hướng dẫn dùng thuốc</label>
              <input
                type="text"
                placeholder="Ví dụ: Uống sau ăn 30 phút kèm nước ấm"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isAdding}
              className="ui-btn-primary text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Đang lưu...' : 'Lưu thuốc vào danh mục'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Danh sách thuốc hiện tại */}
      <div className="ui-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h4 className="ui-section-title">
                Danh mục thuốc đang điều trị ({medications.length} loại)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản lý đơn thuốc và ảnh vỉ mẫu tham chiếu cho thuật toán AI Computer Vision
              </p>
            </div>
          </div>

          <button
            onClick={loadMeds}
            className="ui-btn-secondary py-2 px-3 text-xs"
            title="Làm mới danh mục thuốc"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : medications.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <Pill className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h5 className="text-sm font-bold text-[#0B1F3A] dark:text-white mb-1">
              Chưa có loại thuốc nào trong hồ sơ này
            </h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Sử dụng biểu mẫu phía trên hoặc chọn một thuốc mẫu để thêm vào phác đồ điều trị hàng ngày.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {medications.map((m, idx) => (
              <div
                key={m.id}
                className="p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-[#0D9488]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 tabular-nums">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <h5 className="text-base font-display font-bold text-[#0B1F3A] dark:text-white">
                      {m.name}
                    </h5>
                    <span className="text-[11px] bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] font-semibold px-2.5 py-0.5 rounded-md border border-[#99F6E4] dark:border-[#0D9488]/30">
                      {m.category}
                    </span>
                    <span className="text-[11px] bg-[#0B1F3A] text-white font-semibold px-2.5 py-0.5 rounded-md">
                      Cữ {m.time_period}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Liều dùng: <span className="font-mono font-bold text-[#0B1F3A] dark:text-white">{m.dosage}</span> · {m.instruction}
                  </p>

                  {m.reference_image && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={getMediaUrl(`/storage/reference_images/${m.reference_image.split(/[\\/]/).pop()}`)}
                        alt={m.name}
                        className="w-11 h-11 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <p className="text-xs text-[#0D9488] dark:text-[#2DD4BF] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu ảnh mẫu đối chiếu AI
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  <label className="ui-btn-secondary text-xs py-2 px-3.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>{uploadingId === m.id ? 'Đang tải...' : 'Cập nhật ảnh mẫu'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(m.id, e.target.files[0])}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setMedToDelete(m)}
                    className="ui-btn-danger text-xs py-2 px-3.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Xác Nhận Xóa Thuốc */}
      {medToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-md w-full p-6 shadow-saas-lg relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMedToDelete(null)}
              className="absolute top-5 right-5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-red-200 dark:border-red-800">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white">
                Xác nhận ngừng & xóa thuốc
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa loại thuốc này khỏi phác đồ điều trị không?
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4 space-y-1.5 text-left text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Tên thuốc:</span>
                <span className="font-bold text-[#0B1F3A] dark:text-white">{medToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Nhóm:</span>
                <span className="font-semibold text-[#0D9488]">{medToDelete.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Cữ & Liều lượng:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  Cữ {medToDelete.time_period} ({medToDelete.dosage})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMedToDelete(null)}
                className="ui-btn-secondary py-2.5"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
