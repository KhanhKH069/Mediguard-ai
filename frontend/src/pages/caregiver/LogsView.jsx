import React, { useState, useEffect } from 'react';
import { History, Play, AlertTriangle, ShieldCheck, CheckCircle2, Clock, Check, Image as ImageIcon, X } from 'lucide-react';
import { fetchLogs, caregiverConfirm, getMediaUrl } from '../../services/api';

export default function LogsView({ elderId = 1, currentUser = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? currentUser.user_id : 1);

  const loadLogs = async () => {
    try {
      const data = await fetchLogs(activeElderId);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeElderId]);

  const handleConfirmRow = async (logId) => {
    setConfirmingId(logId);
    try {
      await caregiverConfirm(logId, currentUser?.user_id || 2, 'Con/Cháu đã kiểm tra và xác nhận an toàn cho Bác');
      await loadLogs();
    } catch (err) {
      alert('Lỗi xác nhận: ' + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'reminder_sent':
        return <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Lời Nhắc Đã Phát</span>;
      case 'user_responded':
        return <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Bác Đã Phản Hồi</span>;
      case 'device_recorded':
        return <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Thao Tác Thiết Bị / Camera</span>;
      case 'caregiver_confirmed':
        return <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Người Nhà Đã Duyệt</span>;
      case 'alert':
        return <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Cảnh Báo Khẩn</span>;
      default:
        return <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{type}</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <History className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-display font-black text-slate-800 dark:text-white">
              Nhật Ký Kiểm Toán Y Tế (Audit Trail Log)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lưu trữ bất biến bảo đảm sự an toàn tối đa cho Bác
            </p>
          </div>
        </div>
        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
        >
          Làm Mới
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <th className="py-3 px-4">Thời Gian</th>
              <th className="py-3 px-4">Loại Sự Kiện</th>
              <th className="py-3 px-4">Nội Dung / Thao Tác</th>
              <th className="py-3 px-4">CV Đối Chiếu</th>
              <th className="py-3 px-4">Ghi Chú & Audio</th>
              <th className="py-3 px-4 text-center">Xác Nhận Người Thân</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {new Date(l.timestamp).toLocaleTimeString('vi-VN')} {new Date(l.timestamp).toLocaleDateString('vi-VN')}
                </td>
                <td className="py-3.5 px-4">{getEventBadge(l.event_type)}</td>
                <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                  {l.response_content || l.device_action || '—'}
                </td>
                <td className="py-3.5 px-4">
                  {l.cv_status && l.cv_status !== 'NONE' ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          l.cv_status === 'MATCHED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : l.cv_status === 'MISMATCH'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {l.cv_status}
                      </span>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>{l.notes || '—'}</span>
                    {l.audio_url && (
                      <button
                        onClick={() => new Audio(getMediaUrl(l.audio_url)).play()}
                        className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 flex-shrink-0 transition-colors"
                        title="Nghe lại file giọng đọc đã phát"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                  {l.event_type === 'caregiver_confirmed' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConfirmRow(l.id)}
                      disabled={confirmingId === l.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      title="Con/Cháu đã kiểm tra và xác nhận an toàn cho Bác"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{confirmingId === l.id ? 'Đang lưu...' : 'Xác nhận an toàn'}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal xem trước ảnh đối chiếu */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Hình Ảnh Vỉ Thuốc Đã Chụp</h4>
            <img src={getMediaUrl(previewImage)} alt="Ảnh vỉ thuốc" className="w-full rounded-2xl max-h-96 object-contain bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      )}
    </div>
  );
}
