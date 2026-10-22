import React, { useState, useEffect } from 'react';
import { Plus, Pill, Upload, Trash2, CheckCircle2, AlertTriangle, X, ShieldAlert, Sparkles } from 'lucide-react';
import { fetchMedications, deleteMedication, connectRealtimeUpdates, createMedication, uploadMedicationImage, getMediaUrl } from '../../services/api';

export default function MedicationList({ elderId = 1, currentUser = null }) {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Thuốc Huyết Áp');
  const [dosage, setDosage] = useState('1 viên');
  const [instruction, setInstruction] = useState('Uống sau khi ăn 30 phút với nước ấm');
  const [timePeriod, setTimePeriod] = useState('Sáng');
  const [uploadingId, setUploadingId] = useState(null);

  // Modal xác nhận xóa thuốc
  const [medToDelete, setMedToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? currentUser.user_id : 1);

  const loadMeds = async () => {
    try {
      setLoading(true);
      const data = await fetchMedications(activeElderId);
      setMedications(data || []);
    } catch (err) {
      console.error('Lỗi tải danh mục thuốc:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeds();

    // Lắng nghe cập nhật WebSocket để tự động đồng bộ khi có thuốc mới hoặc bị xóa
    const disconnect = connectRealtimeUpdates((msg) => {
      if (['schedule_updated', 'medication_created', 'medication_deleted'].includes(msg.type) || msg.action) {
        loadMeds();
      }
    });

    return () => disconnect();
  }, [activeElderId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createMedication({
        elder_id: activeElderId,
        name: name.trim(),
        category,
        dosage,
        instruction,
        time_period: timePeriod
      });

      setName('');
      setStatusFeedback({ type: 'success', text: `Đã thêm thuốc "${name.trim()}" vào danh mục thành công!` });
      setTimeout(() => setStatusFeedback(null), 4000);
      await loadMeds();
    } catch (err) {
      console.error(err);
      alert(`Lỗi khi lưu thuốc: ${err.message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!medToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMedication(medToDelete.id);
      setStatusFeedback({ type: 'success', text: `Đã xóa thuốc "${medToDelete.name}" khỏi danh mục thành công.` });
      setTimeout(() => setStatusFeedback(null), 4000);
      setMedToDelete(null);
      await loadMeds();
    } catch (err) {
      alert(`Lỗi khi xóa thuốc: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadImage = async (medId, file) => {
    if (!file) return;
    setUploadingId(medId);
    try {
      await uploadMedicationImage(medId, file);
      setStatusFeedback({ type: 'success', text: 'Đã cập nhật ảnh mẫu tham chiếu cho thuốc thành công!' });
      setTimeout(() => setStatusFeedback(null), 4000);
      await loadMeds();
    } catch (err) {
      alert(`Lỗi tải ảnh mẫu: ${err.message}`);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thông báo phản hồi thao tác */}
      {statusFeedback && (
        <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between transition-all ${
          statusFeedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>{statusFeedback.text}</span>
          </div>
          <button onClick={() => setStatusFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form thêm thuốc mới */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
        <h3 className="text-xl font-display font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span>Thêm Thuốc Mới Vào Hồ Sơ</span>
        </h3>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Tên Thuốc & Hàm Lượng *
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Amlodipine 5mg hoặc Glucophage 500mg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Nhóm Bệnh / Công Dụng
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Thuốc Huyết Áp, Thuốc Tiểu Đường, Dạ Dày..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Liều Lượng Uống
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 1 viên, 2 viên, 5ml..."
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Cữ Uống Trong Ngày
              </label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all cursor-pointer"
              >
                <option value="Sáng">Cữ Sáng</option>
                <option value="Trưa">Cữ Trưa</option>
                <option value="Tối">Cữ Tối</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Hướng Dẫn Dùng Thuốc
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Uống sau ăn 30 phút kèm nước ấm"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-display font-bold text-sm rounded-2xl shadow-glow-blue transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Lưu Thuốc Vào Danh Mục</span>
            </button>
          </div>
        </form>
      </div>

      {/* Danh sách thuốc hiện tại */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xl font-display font-black text-slate-800 dark:text-white">
                Danh Mục Thuốc Đang Dùng ({medications.length} loại)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Dữ liệu riêng biệt theo từng hồ sơ người cao tuổi
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Đang tải danh mục thuốc...</span>
          </div>
        ) : medications.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Pill className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h5 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
              Chưa có loại thuốc nào trong hồ sơ này
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm mx-auto">
              Bạn có thể dùng biểu mẫu phía trên để thêm các loại thuốc mà cụ đang sử dụng hàng ngày.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {medications.map((m) => (
              <div
                key={m.id}
                className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-base font-bold text-slate-900 dark:text-white">{m.name}</h5>
                    <span className="text-[11px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-800">
                      {m.category}
                    </span>
                    <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800">
                      Cữ {m.time_period}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Liều dùng: <span className="font-bold text-slate-800 dark:text-slate-200">{m.dosage}</span> • {m.instruction}
                  </p>

                  {m.reference_image && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={getMediaUrl(`/storage/reference_images/${m.reference_image.split(/[\\/]/).pop()}`)}
                        alt={m.name}
                        className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã có ảnh mẫu tham chiếu đối chiếu
                      </p>
                    </div>
                  )}
                </div>

                {/* Các nút hành động: Đổi Ảnh Mẫu & Xóa Thuốc */}
                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  {/* Upload ảnh vỉ mẫu */}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm transition-all active:scale-95">
                    <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{uploadingId === m.id ? 'Đang tải...' : 'Đổi Ảnh Mẫu'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(m.id, e.target.files[0])}
                    />
                  </label>

                  {/* NÚT XÓA THUỐC KHI KHÔNG DÙNG NỮA */}
                  <button
                    type="button"
                    onClick={() => setMedToDelete(m)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-sm transition-all active:scale-95"
                    title="Xóa loại thuốc này khi người cao tuổi không còn sử dụng nữa"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Xóa Thuốc</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Xác Nhận Xóa Thuốc */}
      {medToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setMedToDelete(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-3 ring-4 ring-rose-500/10">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Xác Nhận Ngừng & Xóa Thuốc
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Người chăm sóc có chắc chắn muốn xóa thuốc này khỏi danh mục điều trị của Bác không?
              </p>
            </div>

            {/* Thông tin thuốc chuẩn bị xóa */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 mb-5 space-y-1 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tên thuốc:</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">{medToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Nhóm:</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{medToDelete.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Cữ & Liều lượng:</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cữ {medToDelete.time_period} ({medToDelete.dosage})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs mb-5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <span>
                Sau khi xóa, hệ thống AI sẽ <b>ngừng phát lời nhắc</b> uống loại thuốc này và không kiểm tra ảnh thuốc tương ứng nữa.
              </span>
            </div>

            {/* Nút hành động trong modal */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMedToDelete(null)}
                className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xác Nhận Xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
