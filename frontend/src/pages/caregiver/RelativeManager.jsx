import React, { useState, useEffect } from 'react';
import {
  User,
  UserPlus,
  ShieldCheck,
  Phone,
  Calendar,
  Pill,
  History,
  HeartPulse,
  CheckCircle2,
  Clock,
  Stethoscope,
  MapPin,
  AlertCircle,
  Edit3,
  Check,
  X,
  FileCheck2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import {
  fetchElders,
  fetchSchedules,
  fetchMedications,
  fetchLogs,
  fetchSymptoms,
  registerUser
} from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import MedicationList from './MedicationList';

export default function RelativeManager({
  elderId = null,
  currentUser = null,
  onSelectElder = null
}) {
  const [elders, setElders] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [subTab, setSubTab] = useState('overview'); // 'overview' | 'medications' | 'history'

  const showToast = (text, type = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Hồ sơ lâm sàng bổ sung (lưu localStorage theo elderId để giữ nguyên khi demo)
  const [clinicalMeta, setClinicalMeta] = useState(() => {
    try {
      const saved = localStorage.getItem(`mediguard_elder_meta_${elderId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      age: 72,
      bloodType: 'O+',
      conditions: 'Tăng huyết áp độ 2, Rối loạn tuần hoàn não, Đái tháo đường tuýp 2',
      allergies: 'Không dị ứng kháng sinh nhóm Penicillin',
      hospital: 'Bệnh viện Lão khoa Trung ương',
      doctor: 'BS.CKII Trần Minh Hoàng',
      emergencyPhone: '0987 654 321 (Anh Nam - Con trai)',
      address: 'Quận Đống Đa, Hà Nội'
    };
  });
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  // Modal thêm người thân mới
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [eldersData, schData, medData, logData, sympData] = await Promise.all([
        fetchElders(),
        fetchSchedules(activeElderId),
        fetchMedications(activeElderId),
        fetchLogs(activeElderId).catch(() => []),
        fetchSymptoms(activeElderId).catch(() => ({ symptoms: [] }))
      ]);
      setElders(Array.isArray(eldersData) ? eldersData : []);
      setSchedules(Array.isArray(schData) ? schData : []);
      setMedications(Array.isArray(medData) ? medData : []);
      setLogs(Array.isArray(logData) ? logData : []);
      setSymptoms(sympData?.symptoms || []);
    } catch (err) {
      console.error('Lỗi tải hồ sơ người thân:', err);
      setLoadError('Không thể kết nối máy chủ để tải đầy đủ hồ sơ lâm sàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    try {
      const saved = localStorage.getItem(`mediguard_elder_meta_${activeElderId}`);
      if (saved) {
        setClinicalMeta(JSON.parse(saved));
      }
    } catch (e) {}
  }, [activeElderId]);

  const handleSaveMeta = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(`mediguard_elder_meta_${activeElderId}`, JSON.stringify(clinicalMeta));
    } catch (e) {}
    setIsEditingMeta(false);
    showToast('Đã cập nhật thông tin y tế nền của người thân.');
  };

  const handleCreateElder = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newFullName.trim() || !newUsername.trim()) {
      setCreateError('Vui lòng nhập họ tên và mã tài khoản thiết bị cho người thân.');
      return;
    }
    setIsCreating(true);
    try {
      const created = await registerUser({
        username: newUsername.trim(),
        password: '123456',
        full_name: newFullName.trim(),
        role: 'ELDER',
        phone_number: newPhone.trim() || null
      });
      setIsAddModalOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewPhone('');
      showToast(`Đã tạo hồ sơ cho "${newFullName.trim()}" thành công.`);
      await loadAll();
      if (onSelectElder && created?.user_id) {
        onSelectElder(created.user_id);
      }
    } catch (err) {
      setCreateError(err.message || 'Không thể tạo hồ sơ mới.');
    } finally {
      setIsCreating(false);
    }
  };

  const currentProfile = elders.find((e) => e.id === activeElderId) || elders[0] || {
    id: activeElderId,
    full_name: 'Bác Nguyễn Văn Ba',
    username: 'ong_ba',
    phone_number: '0901 234 567'
  };

  return (
    <div className="space-y-6">
      {/* Toast thông báo */}
      {feedbackToast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
            feedbackToast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200'
              : 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
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

      {/* Cảnh báo lỗi kết nối */}
      {loadError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-red-800 dark:text-red-200 text-xs sm:text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadAll}
            className="ui-btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 1. Thanh chọn người thân & Nút thêm hồ sơ */}
      <div className="ui-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Hồ sơ người thân trong gia đình:
          </span>
          {elders.map((el) => {
            const isSelected = el.id === activeElderId;
            return (
              <button
                key={el.id}
                onClick={() => onSelectElder && onSelectElder(el.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0B1F3A] text-white border-[#0B1F3A] shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0D9488]'
                }`}
              >
                <User className={`w-4 h-4 ${isSelected ? 'text-[#2DD4BF]' : 'text-slate-400'}`} />
                <span>{el.full_name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadAll}
            className="ui-btn-secondary py-2 px-3 text-xs"
            title="Làm mới dữ liệu hồ sơ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="ui-btn-primary text-xs sm:text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm hồ sơ người thân</span>
          </button>
        </div>
      </div>

      {/* 2. Thẻ Thông Tin Người Dùng (Patient Profile Card) */}
      <div className="ui-card overflow-hidden">
        <div className="bg-[#0B1F3A] text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center font-display font-bold text-xl sm:text-2xl shrink-0 shadow-xs">
              {currentProfile.full_name?.charAt(0) || 'B'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
                  {currentProfile.full_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-[#5EEAD4] font-mono text-xs font-semibold border border-white/15">
                  Mã hồ sơ #{currentProfile.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
                  Đang theo dõi tích cực
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Tài khoản thiết bị: <span className="font-mono text-white font-semibold">{currentProfile.username}</span> • Tuổi: <strong className="text-white">{clinicalMeta.age}</strong> • Nhóm máu: <strong className="text-[#5EEAD4] font-mono">{clinicalMeta.bloodType}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`tel:${currentProfile.phone_number || '0901234567'}`}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 border border-white/15 transition-colors"
            >
              <Phone className="w-4 h-4 text-[#5EEAD4]" />
              <span>Gọi trực tiếp ({currentProfile.phone_number || '0901 234 567'})</span>
            </a>
            <button
              onClick={() => setIsEditingMeta(!isEditingMeta)}
              className="px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditingMeta ? 'Đóng chỉnh sửa' : 'Cập nhật hồ sơ y tế'}</span>
            </button>
          </div>
        </div>

        {/* Form chỉnh sửa hoặc lưới thông tin y tế */}
        {isEditingMeta ? (
          <form onSubmit={handleSaveMeta} className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="ui-label">Chẩn đoán & Bệnh lý nền đang điều trị</label>
                <input
                  type="text"
                  value={clinicalMeta.conditions}
                  onChange={(e) => setClinicalMeta({ ...clinicalMeta, conditions: e.target.value })}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Bệnh viện / Cơ sở y tế</label>
                <input
                  type="text"
                  value={clinicalMeta.hospital}
                  onChange={(e) => setClinicalMeta({ ...clinicalMeta, hospital: e.target.value })}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Bác sĩ điều trị chính</label>
                <input
                  type="text"
                  value={clinicalMeta.doctor}
                  onChange={(e) => setClinicalMeta({ ...clinicalMeta, doctor: e.target.value })}
                  className="ui-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="ui-label">Tiền sử dị ứng thuốc & Cảnh báo an toàn</label>
                <input
                  type="text"
                  value={clinicalMeta.allergies}
                  onChange={(e) => setClinicalMeta({ ...clinicalMeta, allergies: e.target.value })}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Người liên hệ khẩn cấp</label>
                <input
                  type="text"
                  value={clinicalMeta.emergencyPhone}
                  onChange={(e) => setClinicalMeta({ ...clinicalMeta, emergencyPhone: e.target.value })}
                  className="ui-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="ui-label">Tuổi</label>
                  <input
                    type="number"
                    value={clinicalMeta.age}
                    onChange={(e) => setClinicalMeta({ ...clinicalMeta, age: e.target.value })}
                    className="ui-input font-mono"
                  />
                </div>
                <div>
                  <label className="ui-label">Nhóm máu</label>
                  <input
                    type="text"
                    value={clinicalMeta.bloodType}
                    onChange={(e) => setClinicalMeta({ ...clinicalMeta, bloodType: e.target.value })}
                    className="ui-input font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingMeta(false)}
                className="ui-btn-secondary text-xs py-2 px-4"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="ui-btn-primary text-xs py-2 px-4"
              >
                <Check className="w-4 h-4" />
                <span>Lưu thông tin y tế</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-[#0E1E36]">
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                <HeartPulse className="w-4 h-4 text-[#0D9488]" />
                <span>Chẩn đoán & Bệnh nền</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white leading-relaxed">
                {clinicalMeta.conditions}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                <Stethoscope className="w-4 h-4 text-[#0D9488]" />
                <span>Đơn vị & Bác sĩ điều trị</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white">
                {clinicalMeta.hospital}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {clinicalMeta.doctor}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Lưu ý dị ứng & An toàn</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white leading-relaxed">
                {clinicalMeta.allergies}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                <Phone className="w-4 h-4 text-[#0D9488]" />
                <span>Người chăm sóc chính</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white">
                {clinicalMeta.emergencyPhone}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" /> {clinicalMeta.address}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Sub-navigation: Lịch dùng thuốc đã xác nhận | Danh mục thuốc điều trị | Lịch sử theo dõi */}
      <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#0E1E36] p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-saas">
        {[
          { id: 'overview', label: 'Lịch dùng thuốc đã xác nhận', icon: FileCheck2, count: schedules.length },
          { id: 'medications', label: 'Danh mục thuốc & Ảnh mẫu', icon: Pill, count: medications.length },
          { id: 'history', label: 'Lịch sử theo dõi & Triệu chứng', icon: History, count: logs.length + symptoms.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums ${
                  active
                    ? 'bg-[#0D9488] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: Lịch dùng thuốc đã được xác nhận */}
      {subTab === 'overview' && (
        <div className="ui-card overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="ui-section-title">
                Phác đồ & Lịch dùng thuốc đã được xác nhận
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Các cữ thuốc đã được người chăm sóc đối chiếu với toa bác sĩ và kích hoạt nhắc tự động
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] dark:text-[#5EEAD4] bg-[#F0FDFA] dark:bg-[#0D9488]/20 px-3 py-1.5 rounded-xl border border-[#99F6E4] dark:border-[#0D9488]/30 self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4" />
              <span>Đã thẩm định đơn thuốc</span>
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Calendar className="w-9 h-9 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                Chưa có lịch dùng thuốc nào cho hồ sơ này
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Vui lòng chuyển sang mục “Lịch thuốc & Tủ thuốc” trên thanh điều hướng để thiết lập khung giờ nhắc cho người thân.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="ui-table-head">
                      <th className="ui-table-th">Cữ uống</th>
                      <th className="ui-table-th">Giờ chuẩn</th>
                      <th className="ui-table-th">Thuốc & Liều lượng chỉ định</th>
                      <th className="ui-table-th">Thông tin duyệt toa</th>
                      <th className="ui-table-th">Trạng thái hôm nay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {schedules.map((sch, idx) => (
                      <tr key={sch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="ui-table-td whitespace-nowrap">
                          <div className="font-display font-bold text-[#0B1F3A] dark:text-white">
                            Buổi {sch.time_period}
                          </div>
                          <span className="text-xs font-mono text-slate-500">
                            Ngăn #0{sch.compartment_number || idx + 1}
                          </span>
                        </td>
                        <td className="ui-table-td font-mono font-bold text-[#0D9488] dark:text-[#2DD4BF] whitespace-nowrap tabular-nums">
                          {sch.target_time}
                        </td>
                        <td className="ui-table-td">
                          <div className="flex flex-wrap gap-1.5">
                            {sch.medications?.length > 0 ? (
                              sch.medications.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-white text-xs font-medium border border-slate-200 dark:border-slate-700"
                                >
                                  {m.name} ({m.dosage})
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">Chưa gắn thuốc</span>
                            )}
                          </div>
                          {sch.notes && (
                            <p className="text-xs text-slate-500 mt-1">{sch.notes}</p>
                          )}
                        </td>
                        <td className="ui-table-td text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="font-semibold text-[#0B1F3A] dark:text-white flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
                            <span>Người duyệt #{sch.verified_by || 2}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {sch.verified_at ? new Date(sch.verified_at).toLocaleDateString('vi-VN') : 'Đã xác minh'}
                          </span>
                        </td>
                        <td className="ui-table-td">
                          <div className="flex flex-wrap gap-1.5">
                            <StatusBadge
                              type="user_responded"
                              active={sch.status?.user_responded}
                              label={sch.status?.user_responded ? 'Đã uống' : 'Chờ uống'}
                            />
                            <StatusBadge
                              type="caregiver_confirmed"
                              active={sch.status?.caregiver_confirmed}
                              label={sch.status?.caregiver_confirmed ? 'Đã xác nhận' : 'Chờ duyệt'}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards cho Lịch dùng thuốc đã xác nhận */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {schedules.map((sch, idx) => (
                  <div key={`mob-rel-sch-${sch.id}`} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0B1F3A] text-white font-mono font-bold text-xs tabular-nums">
                          {sch.target_time}
                        </span>
                        <div>
                          <div className="font-display font-bold text-sm text-[#0B1F3A] dark:text-white">
                            Buổi {sch.time_period}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">
                            Ngăn #0{sch.compartment_number || idx + 1}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-[#0D9488] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã duyệt toa</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sch.medications?.map((m) => (
                        <span
                          key={m.id}
                          className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#0B1F3A] dark:text-white"
                        >
                          {m.name} ({m.dosage})
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge
                        type="user_responded"
                        active={sch.status?.user_responded}
                        label={sch.status?.user_responded ? 'Đã uống' : 'Chờ uống'}
                      />
                      <StatusBadge
                        type="caregiver_confirmed"
                        active={sch.status?.caregiver_confirmed}
                        label={sch.status?.caregiver_confirmed ? 'Đã xác nhận' : 'Chờ duyệt'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB 2: Danh mục thuốc & Ảnh mẫu */}
      {subTab === 'medications' && (
        <MedicationList elderId={activeElderId} currentUser={currentUser} />
      )}

      {/* SUBTAB 3: Lịch sử theo dõi & Triệu chứng của người thân */}
      {subTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 ui-card p-6 space-y-4">
            <h3 className="text-base font-display font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#0D9488]" />
              <span>Lịch sử dùng thuốc & Tương tác ({logs.length})</span>
            </h3>
            {logs.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Chưa có bản ghi tương tác nào cho hồ sơ này.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 tabular-nums">
                          {new Date(l.timestamp).toLocaleString('vi-VN')}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0FDFA] text-[#0F766E] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4] border border-[#99F6E4]/60 dark:border-[#0D9488]/30">
                          {l.event_type}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A] dark:text-white">
                        {l.response_content || l.device_action || l.notes || 'Sự kiện theo dõi'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 ui-card p-6 space-y-4">
            <h3 className="text-base font-display font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-[#0D9488]" />
              <span>Lịch sử triệu chứng ghi nhận ({symptoms.length})</span>
            </h3>
            {symptoms.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-8 h-8 text-[#0D9488] mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Chưa có triệu chứng bất thường nào được ghi nhận.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {symptoms.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-[#0B1F3A] dark:text-white">
                        {s.symptom_name}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          s.severity === 'Khẩn cấp'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {s.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      {s.reported_time} • {s.reported_date}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal thêm người thân mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-saas-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white">
                Thêm hồ sơ người thân mới
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateElder} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="ui-label">Họ và tên người thân *</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ví dụ: Bà Nguyễn Thị Lan (70 tuổi)"
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Tên tài khoản thiết bị *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ví dụ: ba_lan"
                  className="ui-input font-mono"
                />
              </div>
              <div>
                <label className="ui-label">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ví dụ: 0912 345 678"
                  className="ui-input font-mono"
                />
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300">
                  {createError}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 ui-btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 ui-btn-primary"
                >
                  {isCreating ? 'Đang tạo...' : 'Tạo hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
