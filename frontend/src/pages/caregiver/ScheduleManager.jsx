import React, { useState, useEffect } from 'react';
import { Plus, Check, Clock, AlertCircle } from 'lucide-react';
import { fetchSchedules } from '../../services/api';

export default function ScheduleManager() {
  const [schedules, setSchedules] = useState([]);
  const [timePeriod, setTimePeriod] = useState('Sáng');
  const [targetTime, setTargetTime] = useState('07:30');
  const [notes, setNotes] = useState('');
  const [isPrescriptionVerified, setIsPrescriptionVerified] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchSchedules();
      setSchedules(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isPrescriptionVerified) {
      alert('Bạn phải tích vào ô xác nhận đã đối chiếu đơn thuốc để đảm bảo an toàn!');
      return;
    }

    try {
      const res = await fetch('/api/schedules/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elder_id: 1,
          time_period: timePeriod,
          target_time: targetTime,
          verified_by: 2, // Caregiver ID
          notes: notes || 'Đã đối chiếu theo đơn thuốc'
        })
      });
      if (res.ok) {
        setMessage('Đã thêm và xác minh lịch dùng thuốc thành công!');
        setNotes('');
        setIsPrescriptionVerified(false);
        await loadData();
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.detail}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Plus className="w-6 h-6 text-blue-600" /> Thiết Lập Lịch Nhắc Thuốc Mới
        </h3>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Cữ Uống</label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="Sáng">Buổi Sáng</option>
                <option value="Trưa">Buổi Trưa</option>
                <option value="Tối">Buổi Tối</option>
                <option value="Đêm">Buổi Đêm</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Giờ Nhắc</label>
              <input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Ghi Chú Đơn Thuốc / Hướng Dẫn
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Theo đơn thuốc Bệnh viện Lão Khoa ngày 15/10..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Ô BẮT BUỘC TICK XÁC NHẬN AN TOÀN */}
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 flex items-start gap-3">
            <input
              type="checkbox"
              id="verifyCheck"
              checked={isPrescriptionVerified}
              onChange={(e) => setIsPrescriptionVerified(e.target.checked)}
              className="w-5 h-5 mt-1 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="verifyCheck" className="text-sm text-blue-900 font-medium cursor-pointer">
              <span className="font-bold">Tôi cam kết đã đối chiếu kỹ với đơn thuốc chỉ định của bác sĩ.</span>
              <br />
              Hệ thống sẽ lưu vết ID của tôi (verified_by) vào biên bản kiểm toán y tế.
            </label>
          </div>

          {message && <p className="text-emerald-600 font-bold text-sm">{message}</p>}

          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl shadow-md transition-colors"
          >
            LƯU LỊCH ĐÃ XÁC MINH
          </button>
        </form>
      </div>

      {/* Danh sách lịch hiện có */}
      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200">
        <h4 className="text-lg font-bold text-slate-800 mb-4">Các Cữ Thuốc Đang Áp Dụng</h4>
        <div className="divide-y divide-slate-100">
          {schedules.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">
                  {s.time_period} - {s.target_time}
                </p>
                <p className="text-xs text-slate-500">
                  Đã duyệt bởi User #{s.verified_by} lúc {new Date(s.verified_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                Đang kích hoạt
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
