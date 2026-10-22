import React, { useState, useEffect } from 'react';
import { History, Play, AlertTriangle, ShieldCheck, CheckCircle2, Clock, Check, Image as ImageIcon, X } from 'lucide-react';
import { fetchLogs, caregiverConfirm } from '../../services/api';

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const loadLogs = async () => {
    try {
      const data = await fetchLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleConfirmRow = async (logId) => {
    setConfirmingId(logId);
    try {
      await caregiverConfirm(logId, 2, 'Tôi đã kiểm tra & xác nhận an toàn từ Nhật Ký');
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
        return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Lời Nhắc Đã Phát</span>;
      case 'user_responded':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Bác Đã Phản Hồi</span>;
      case 'device_recorded':
        return <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Thao Tác Thiết Bị / Camera</span>;
      case 'caregiver_confirmed':
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Người Nhà Đã Duyệt</span>;
      case 'alert':
        return <span className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Cảnh Báo Khẩn</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{type}</span>;
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-800">
            Biên Bản Kiểm Toán Y Tế (Audit Trail Log)
          </h3>
        </div>
        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
        >
          Làm Mới
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Thời Gian</th>
              <th className="py-3 px-4">Loại Sự Kiện</th>
              <th className="py-3 px-4">Nội Dung / Thao Tác</th>
              <th className="py-3 px-4">CV Đối Chiếu</th>
              <th className="py-3 px-4">Ghi Chú & Audio</th>
              <th className="py-3 px-4 text-center">Xác Nhận Người Thân</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                  {new Date(l.timestamp).toLocaleTimeString('vi-VN')} {new Date(l.timestamp).toLocaleDateString('vi-VN')}
                </td>
                <td className="py-3.5 px-4">{getEventBadge(l.event_type)}</td>
                <td className="py-3.5 px-4 font-medium text-slate-800">
                  {l.response_content || l.device_action || '—'}
                </td>
                <td className="py-3.5 px-4">
                  {l.cv_status && l.cv_status !== 'NONE' ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          l.cv_status === 'MATCHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.cv_status === 'MISMATCH'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.cv_status}
                      </span>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>{l.notes || '—'}</span>
                    {l.audio_url && (
                      <button
                        onClick={() => new Audio(l.audio_url).play()}
                        className="p-1.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 flex-shrink-0"
                        title="Nghe lại file giọng đọc đã phát"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                  {l.event_type === 'caregiver_confirmed' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConfirmRow(l.id)}
                      disabled={confirmingId === l.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                      title="Tôi đã kiểm tra & xác nhận cữ thuốc này an toàn"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{confirmingId === l.id ? 'Đang lưu...' : 'Tôi đã kiểm tra & xác nhận'}</span>
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:bg-slate-100 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <h4 className="text-lg font-bold text-slate-800 mb-4">Hình Ảnh Vỉ Thuốc Đã Chụp</h4>
            <img src={previewImage} alt="Ảnh vỉ thuốc" className="w-full rounded-2xl max-h-96 object-contain bg-slate-100" />
          </div>
        </div>
      )}
    </div>
  );
}
