import React, { useState, useEffect } from 'react';
import { Plus, Check, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { fetchSchedules, createSchedule } from '../../services/api';

export default function ScheduleManager({ elderId = 1, currentUser = null }) {
  const [schedules, setSchedules] = useState([]);
  const [timePeriod, setTimePeriod] = useState('Sáng');
  const [targetTime, setTargetTime] = useState('07:30');
  const [notes, setNotes] = useState('');
  const [isPrescriptionVerified, setIsPrescriptionVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? currentUser.user_id : 1);

  const loadData = async () => {
    try {
      const data = await fetchSchedules(activeElderId);
      setSchedules(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeElderId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isPrescriptionVerified) {
      alert('Người chăm sóc vui lòng đánh dấu xác nhận đã đối chiếu đơn thuốc để đảm bảo an toàn cho Bác!');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSchedule({
        elder_id: activeElderId,
        time_period: timePeriod,
        target_time: targetTime,
        verified_by: currentUser?.user_id || 2, // Caregiver ID
        notes: notes || 'Đã đối chiếu theo đơn thuốc chỉ định của bác sĩ'
      });

      setMessage('✓ Đã thêm và xác minh lịch nhắc thuốc cho Bác thành công!');
      setNotes('');
      setIsPrescriptionVerified(false);
      setTimeout(() => setMessage(''), 4000);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(`Lỗi: ${err.message || 'Không thể tạo lịch thuốc'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
        <h3 className="text-xl font-display font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span>Thiết Lập Lịch Nhắc Thuốc Cho Bác</span>
        </h3>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Cữ Uống Trong Ngày
              </label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all cursor-pointer"
              >
                <option value="Sáng">Buổi Sáng</option>
                <option value="Trưa">Buổi Trưa</option>
                <option value="Tối">Buổi Tối</option>
                <option value="Đêm">Buổi Đêm</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Giờ Phát Chuông Nhắc *
              </label>
              <input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              Ghi Chú Đơn Thuốc / Hướng Dẫn Y Khoa
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Theo đơn thuốc Bệnh viện Lão Khoa ngày 15/10..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
            />
          </div>

          {/* Ô BẮT BUỘC TICK XÁC NHẬN AN TOÀN */}
          <div className="bg-blue-50/90 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
            <input
              type="checkbox"
              id="verifyCheck"
              checked={isPrescriptionVerified}
              onChange={(e) => setIsPrescriptionVerified(e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="verifyCheck" className="text-xs md:text-sm text-blue-900 dark:text-blue-200 font-medium cursor-pointer leading-relaxed">
              <span className="font-bold">Con/Cháu (Người chăm sóc) cam kết đã đối chiếu kỹ với đơn thuốc chỉ định của bác sĩ.</span>
              <br />
              <span className="text-slate-600 dark:text-slate-400 text-xs">
                Hệ thống sẽ ghi nhận định danh người duyệt (verified_by: #{currentUser?.user_id || 2}) vào biên bản kiểm toán y tế.
              </span>
            </label>
          </div>

          {message && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              {message}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-display font-bold text-sm rounded-2xl shadow-glow-blue transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'LƯU LỊCH ĐÃ XÁC MINH'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Danh sách lịch hiện có */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
        <h4 className="text-lg font-display font-bold text-slate-800 dark:text-white mb-4">
          Các Cữ Thuốc Đang Áp Dụng Cho Bác
        </h4>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {schedules.map((s) => (
            <div key={s.id} className="py-3.5 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Cữ Buổi {s.time_period} — {s.target_time}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Đã duyệt bởi Người chăm sóc #{s.verified_by} lúc {new Date(s.verified_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold px-3 py-1 rounded-full">
                Đang kích hoạt
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
