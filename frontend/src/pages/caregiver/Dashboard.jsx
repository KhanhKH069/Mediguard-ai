import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, UserCheck, AlertOctagon, Check } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { fetchSchedules, caregiverConfirm } from '../../services/api';

export default function Dashboard() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await fetchSchedules();
      setSchedules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Tự động làm mới mỗi 5 giây
    return () => clearInterval(interval);
  }, []);

  const handleConfirm = async (schId) => {
    try {
      await caregiverConfirm(schId, 2, 'Người nhà đã kiểm tra và xác nhận an toàn');
      await loadData();
    } catch (err) {
      alert('Lỗi xác nhận');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Giới thiệu nguyên tắc an toàn */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-8 h-8 text-blue-200" />
          <h2 className="text-2xl font-bold">Bảng Điều Khiển Người Chăm Sóc</h2>
        </div>
        <p className="text-blue-100 text-sm md:text-base max-w-2xl">
          Theo dõi độc lập 3 trạng thái của từng cữ thuốc. Hệ thống không bao giờ tự ý đánh đồng việc bấm nút
          hoặc mở ngăn thuốc với việc người dùng đã thực tế nuốt thuốc.
        </p>
      </div>

      {/* Danh sách các cữ thuốc trong ngày */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {schedules.map((sch) => (
          <div
            key={sch.id}
            className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-xl font-bold text-slate-800">
                    Cữ Buổi {sch.time_period} ({sch.target_time})
                  </span>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">
                  ID: #{sch.id}
                </span>
              </div>

              {/* Thuốc cần dùng */}
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Thuốc đã được duyệt:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sch.medications.map((m) => (
                    <span
                      key={m.id}
                      className="bg-blue-50 text-blue-800 px-3 py-1 rounded-xl text-sm font-semibold border border-blue-200"
                    >
                      💊 {m.name} ({m.dosage})
                    </span>
                  ))}
                </div>
              </div>

              {/* 3 TRẠNG THÁI TÁCH BIỆT RÕ RÀNG */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Trạng thái thực tế:
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    type="user_responded"
                    active={sch.status?.user_responded}
                    label={sch.status?.user_responded ? 'Bác đã phản hồi' : 'Chưa có phản hồi'}
                  />
                  <StatusBadge
                    type="device_recorded"
                    active={sch.status?.device_recorded}
                    label={sch.status?.device_recorded ? 'Đã ghi nhận thao tác' : 'Chưa ghi nhận'}
                  />
                  <StatusBadge
                    type="caregiver_confirmed"
                    active={sch.status?.caregiver_confirmed}
                    label={sch.status?.caregiver_confirmed ? 'Con đã xác nhận' : 'Chờ người nhà duyệt'}
                  />
                </div>
              </div>

              {sch.notes && (
                <p className="text-xs text-slate-500 italic mb-4">
                  📝 {sch.notes}
                </p>
              )}
            </div>

            {/* Nút hành động của Người chăm sóc */}
            {!sch.status?.caregiver_confirmed ? (
              <button
                onClick={() => handleConfirm(sch.id)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20"
              >
                <Check className="w-5 h-5" />
                <span>Tôi đã kiểm tra & xác nhận</span>
              </button>
            ) : (
              <div className="text-center py-2 bg-purple-50 text-purple-700 font-bold rounded-2xl text-sm border border-purple-200">
                ✓ Gia đình đã hoàn tất xác nhận cữ thuốc này
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
