import React, { useState, useEffect } from 'react';
import {
  History,
  Play,
  CheckCircle2,
  Check,
  X,
  Mic,
  Volume2,
  Search,
  RefreshCw,
  Camera,
  HeartPulse,
  Flame,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { fetchLogs, caregiverConfirm, speakText, getMediaUrl, connectRealtimeUpdates } from '../../services/api';
import SymptomManager from './SymptomManager';
import TriageBoard from '../../components/TriageBoard';

export default function LogsView({ elderId = null, currentUser = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [eventFilter, setEventFilter] = useState('all'); // 'all' | 'voice' | 'vision' | 'confirmed'
  const [searchQuery, setSearchQuery] = useState('');
  const [subModule, setSubModule] = useState('events'); // 'events' | 'symptoms' | 'triage'
  const [playingId, setPlayingId] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

  const showToast = (text, type = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs(activeElderId);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải nhật ký theo dõi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const disconnect = connectRealtimeUpdates(() => {
      loadLogs();
    });
    return () => disconnect();
  }, [activeElderId]);

  const handleConfirmRow = async (logId) => {
    setConfirmingId(logId);
    try {
      await caregiverConfirm(
        logId,
        currentUser?.user_id,
        'Người chăm sóc đã kiểm tra và duyệt an toàn từ Nhật ký theo dõi'
      );
      showToast('Đã xác nhận kiểm tra sự kiện trong nhật ký.');
      await loadLogs();
    } catch (err) {
      showToast('Lỗi xác nhận: ' + (err.message || 'Vui lòng thử lại'), 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handlePlayAudio = async (logItem) => {
    setPlayingId(logItem.id);
    try {
      if (logItem.audio_url) {
        const audio = new Audio(getMediaUrl(logItem.audio_url));
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => setPlayingId(null);
        await audio.play();
      } else {
        const textToRead =
          logItem.response_content || logItem.notes || 'Sự kiện đã được ghi nhận vào nhật ký.';
        await speakText(textToRead);
        setPlayingId(null);
      }
    } catch (e) {
      setPlayingId(null);
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'reminder_sent':
        return (
          <span className="bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap inline-flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Lời nhắc giọng nói</span>
          </span>
        );
      case 'user_responded':
        return (
          <span className="bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border border-[#99F6E4] dark:border-[#0D9488]/30 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap inline-flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" />
            <span>Bác phản hồi giọng nói</span>
          </span>
        );
      case 'device_recorded':
        return (
          <span className="bg-[#0B1F3A]/5 dark:bg-slate-800 text-[#0B1F3A] dark:text-[#2DD4BF] border border-slate-200 dark:border-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap inline-flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Camera đối chiếu</span>
          </span>
        );
      case 'caregiver_confirmed':
        return (
          <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Gia đình đã duyệt</span>
          </span>
        );
      case 'alert':
        return (
          <span className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap">
            Cảnh báo khẩn
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap">
            {type}
          </span>
        );
    }
  };

  const voiceLogsCount = logs.filter(
    (l) => l.event_type === 'user_responded' || l.event_type === 'reminder_sent' || l.audio_url
  ).length;
  const visionLogsCount = logs.filter(
    (l) => l.event_type === 'device_recorded' || (l.cv_status && l.cv_status !== 'NONE')
  ).length;
  const confirmedLogsCount = logs.filter((l) => l.event_type === 'caregiver_confirmed').length;

  const filteredLogs = logs.filter((l) => {
    if (
      eventFilter === 'voice' &&
      !(l.event_type === 'user_responded' || l.event_type === 'reminder_sent' || l.audio_url)
    ) {
      return false;
    }
    if (
      eventFilter === 'vision' &&
      !(l.event_type === 'device_recorded' || (l.cv_status && l.cv_status !== 'NONE'))
    ) {
      return false;
    }
    if (eventFilter === 'confirmed' && l.event_type !== 'caregiver_confirmed') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const content = `${l.response_content || ''} ${l.notes || ''} ${l.event_type || ''} ${l.cv_status || ''}`.toLowerCase();
      return content.includes(q);
    }
    return true;
  });

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

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-4 text-red-800 dark:text-red-200 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={loadLogs}
            className="ui-btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 1. Thanh điều hướng phân hệ Nhật ký & Tổng hợp nhanh */}
      <section className="ui-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="ui-kicker block">
              NHẬT KÝ KIỂM CHỨNG Y KHOA
            </span>
            <h2 className="ui-page-title mt-0.5">
              Lịch sử tương tác giọng nói, đối chiếu ảnh & sự kiện
            </h2>
          </div>

          <div className="inline-flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 self-start lg:self-center">
            {[
              { id: 'events', label: 'Nhật ký giọng nói & sự kiện', icon: History },
              { id: 'symptoms', label: 'Sổ triệu chứng', icon: HeartPulse },
              { id: 'triage', label: 'Phân loại lâm sàng (Triage)', icon: Flame }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = subModule === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubModule(tab.id)}
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

        {subModule === 'events' && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Tổng sự kiện:</span>
                <strong className="font-mono font-bold text-sm text-[#0B1F3A] dark:text-white tabular-nums">
                  {logs.length}
                </strong>
              </div>
              <span className="text-slate-200 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#0D9488]" />
                <span className="text-slate-500">Giọng nói:</span>
                <strong className="font-mono font-bold text-sm text-[#0D9488] dark:text-[#2DD4BF] tabular-nums">
                  {voiceLogsCount}
                </strong>
              </div>
              <span className="text-slate-200 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#0B1F3A] dark:text-[#2DD4BF]" />
                <span className="text-slate-500">Đối chiếu ảnh:</span>
                <strong className="font-mono font-bold text-sm text-[#0B1F3A] dark:text-[#2DD4BF] tabular-nums">
                  {visionLogsCount}
                </strong>
              </div>
              <span className="text-slate-200 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-500">Đã duyệt:</span>
                <strong className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {confirmedLogsCount}
                </strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm nội dung tương tác..."
                  className="w-full sm:w-52 pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#0B1F3A] dark:text-white outline-none focus:border-[#0D9488]"
                />
              </div>

              <button
                onClick={loadLogs}
                className="ui-btn-subtle text-xs py-1.5 px-3"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {subModule === 'symptoms' && <SymptomManager elderId={activeElderId} currentUser={currentUser} />}
      {subModule === 'triage' && <TriageBoard />}

      {subModule === 'events' && (
        <section className="ui-card overflow-hidden">
          {/* Bộ lọc loại sự kiện */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {[
                { id: 'all', label: `Tất cả (${logs.length})` },
                { id: 'voice', label: `Tương tác giọng nói (${voiceLogsCount})` },
                { id: 'vision', label: `Đối chiếu hình ảnh (${visionLogsCount})` },
                { id: 'confirmed', label: `Gia đình đã duyệt (${confirmedLogsCount})` }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setEventFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    eventFilter === f.id
                      ? 'bg-[#0B1F3A] text-white'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              Hiển thị {filteredLogs.length} bản ghi
            </span>
          </div>

          {loading && logs.length === 0 ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                Không có bản ghi nào khớp với bộ lọc
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Thử chọn “Tất cả” hoặc xóa từ khóa tìm kiếm để xem toàn bộ lịch sử.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="ui-table-head">
                      <th className="ui-table-th">Thời gian</th>
                      <th className="ui-table-th">Loại sự kiện</th>
                      <th className="ui-table-th">Nội dung tương tác / Giọng nói</th>
                      <th className="ui-table-th">Đối chiếu ảnh</th>
                      <th className="ui-table-th">Ghi chú & Nghe lại</th>
                      <th className="ui-table-th text-right">Trạng thái duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                    {filteredLogs.map((l) => (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="ui-table-td font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                          {new Date(l.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}{' '}
                          • {new Date(l.timestamp).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="ui-table-td">{getEventBadge(l.event_type)}</td>
                        <td className="ui-table-td font-medium text-[#0B1F3A] dark:text-white max-w-xs">
                          {l.response_content || l.device_action || '—'}
                        </td>
                        <td className="ui-table-td">
                          {l.cv_status && l.cv_status !== 'NONE' ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md ${
                                  l.cv_status === 'MATCHED'
                                    ? 'bg-[#F0FDFA] text-[#0D9488] border border-[#99F6E4]'
                                    : l.cv_status === 'MISMATCH'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {l.cv_status === 'MATCHED'
                                  ? 'Phù hợp'
                                  : l.cv_status === 'MISMATCH'
                                  ? 'Không khớp'
                                  : 'Chưa chắc chắn'}
                              </span>
                              {l.image_url && (
                                <button
                                  onClick={() => setPreviewImage(getMediaUrl(l.image_url))}
                                  className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                                >
                                  Xem ảnh
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="ui-table-td">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-300 text-xs truncate max-w-[200px]">
                              {l.notes || '—'}
                            </span>
                            {(l.audio_url || l.response_content) && (
                              <button
                                onClick={() => handlePlayAudio(l)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] dark:text-[#5EEAD4] text-xs font-semibold hover:bg-[#CCFBF1] transition-colors shrink-0 cursor-pointer"
                                title="Nghe lại tương tác giọng nói"
                              >
                                <Play className="w-3 h-3" />
                                <span>{playingId === l.id ? 'Đang phát...' : 'Nghe'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="ui-table-td text-right whitespace-nowrap">
                          {l.event_type === 'caregiver_confirmed' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Đã xác nhận</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmRow(l.id)}
                              disabled={confirmingId === l.id}
                              className="ui-btn-primary text-xs py-1.5 px-3"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{confirmingId === l.id ? 'Đang lưu...' : 'Xác nhận'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.map((l) => (
                  <div key={`mob-log-item-${l.id}`} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {getEventBadge(l.event_type)}
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {new Date(l.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        • {new Date(l.timestamp).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white">
                      {l.response_content || l.device_action || l.notes || 'Sự kiện đã được ghi nhận'}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        {(l.audio_url || l.response_content) && (
                          <button
                            onClick={() => handlePlayAudio(l)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDFA] text-[#0D9488] text-xs font-semibold cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>{playingId === l.id ? 'Đang phát...' : 'Nghe lại'}</span>
                          </button>
                        )}
                        {l.image_url && (
                          <button
                            onClick={() => setPreviewImage(getMediaUrl(l.image_url))}
                            className="text-xs font-semibold text-[#0D9488] underline cursor-pointer"
                          >
                            Xem ảnh
                          </button>
                        )}
                      </div>

                      {l.event_type === 'caregiver_confirmed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đã duyệt</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirmRow(l.id)}
                          disabled={confirmingId === l.id}
                          className="ui-btn-primary text-xs py-1 px-3"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Xác nhận</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Modal xem trước ảnh chụp */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1F3A]/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-lg w-full p-5 relative border border-slate-200 dark:border-slate-700 shadow-saas-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="font-display font-bold text-base text-[#0B1F3A] dark:text-white mb-3">
              Hình ảnh viên thuốc đã chụp đối chiếu
            </h4>
            <img
              src={previewImage}
              alt="Captured Pill"
              className="w-full h-72 object-contain rounded-xl bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
}
