import React, { useState, useEffect } from 'react';
import { playChimeSound } from '../../utils/soundEffects';
import { unlockAllAudio, playVoiceSpeech } from '../../services/voiceService';

export default function ElderHealthVitalsTab({ currentUser }) {
  // Lấy dữ liệu từ localStorage hoặc dùng mặc định
  const [vitals, setVitals] = useState(() => {
    try {
      const saved = localStorage.getItem('mediguard_vitals_demo');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      bloodPressureSys: 125,
      bloodPressureDia: 82,
      bloodSugar: '5.8',
      heartRate: 72,
      lastUpdated: '07:30 Sáng nay'
    };
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('bp'); // 'bp' | 'sugar' | 'hr'
  const [inputSys, setInputSys] = useState('120');
  const [inputDia, setInputDia] = useState('80');
  const [inputSugar, setInputSugar] = useState('5.6');
  const [inputHr, setInputHr] = useState('75');
  const [isMeasuringBluetooth, setIsMeasuringBluetooth] = useState(false);
  const [measureStatus, setMeasureStatus] = useState('');

  const saveVitals = (newVitals) => {
    setVitals(newVitals);
    try {
      localStorage.setItem('mediguard_vitals_demo', JSON.stringify(newVitals));
    } catch (e) {}
  };

  const handleStartBluetoothMeasure = () => {
    unlockAllAudio();
    playChimeSound();
    setIsMeasuringBluetooth(true);
    setMeasureStatus('Đang tìm kiếm máy đo huyết áp Bluetooth gần Bác...');

    setTimeout(() => {
      setMeasureStatus('Đã kết nối máy Omron HEM-7142T. Đang đo...');
    }, 1500);

    setTimeout(() => {
      const newSys = Math.floor(118 + Math.random() * 10);
      const newDia = Math.floor(76 + Math.random() * 8);
      const newHr = Math.floor(68 + Math.random() * 8);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Hôm nay`;

      const updated = {
        ...vitals,
        bloodPressureSys: newSys,
        bloodPressureDia: newDia,
        heartRate: newHr,
        lastUpdated: timeStr
      };
      saveVitals(updated);
      setIsMeasuringBluetooth(false);
      setMeasureStatus('');

      playVoiceSpeech(null, `Đo thành công! Huyết áp của Bác là ${newSys} trên ${newDia}, nhịp tim ${newHr}. Mọi chỉ số đều rất tốt ạ!`);
    }, 4500);
  };

  const handleSaveManual = () => {
    unlockAllAudio();
    playChimeSound();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Hôm nay`;

    let updated = { ...vitals, lastUpdated: timeStr };
    if (modalType === 'bp') {
      updated.bloodPressureSys = parseInt(inputSys) || 120;
      updated.bloodPressureDia = parseInt(inputDia) || 80;
    } else if (modalType === 'sugar') {
      updated.bloodSugar = inputSugar || '5.5';
    } else if (modalType === 'hr') {
      updated.heartRate = parseInt(inputHr) || 72;
    }

    saveVitals(updated);
    setIsModalOpen(false);

    playVoiceSpeech(null, 'Đã lưu thành công chỉ số mới của Bác và gửi báo cáo cho gia đình rồi ạ!');
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-space-md">
      {/* 1. Header Section: Friendly, warm greeting & timestamp */}
      <div className="flex flex-col gap-1 bg-surface-container-low p-space-md rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">favorite</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Chỉ số sức khỏe của Bác
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-[13px] flex items-center gap-1 font-semibold">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Trực tuyến
          </span>
        </div>
        <p className="font-body-md text-on-surface-variant flex items-center gap-1.5 mt-1">
          <span className="material-symbols-outlined text-outline text-[20px]">schedule</span>
          Cập nhật lúc <span className="font-bold text-on-surface">{vitals.lastUpdated}</span>
        </p>
      </div>

      {/* Thông báo nếu đang đo Bluetooth */}
      {isMeasuringBluetooth && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary-fixed text-on-secondary-fixed animate-pulse border-2 border-secondary shadow-md">
          <span className="material-symbols-outlined text-[32px] text-secondary">sensors</span>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">ĐANG KẾT NỐI MÁY ĐO</span>
            <span className="font-body-md text-body-md text-on-surface-variant">{measureStatus}</span>
          </div>
        </div>
      )}

      {/* 2. Primary Metric: HUYẾT ÁP (Omron-inspired bold display) */}
      <div className="flex flex-col bg-surface-container-lowest p-space-md rounded-2xl shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[26px]">vital_signs</span>
            </div>
            <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold">
              Huyết áp
            </span>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md flex items-center gap-1.5 shadow-sm font-bold">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            BÌNH THƯỜNG - TỐT
          </span>
        </div>

        {/* Massive Digital Readout */}
        <div className="mt-4 pt-2 flex items-baseline justify-between bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/20">
          <div className="flex items-baseline gap-2">
            <span className="font-display-stat text-[46px] leading-tight text-on-surface font-bold tracking-tight">
              {vitals.bloodPressureSys} <span className="text-outline font-normal text-[36px]">/</span> {vitals.bloodPressureDia}
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface-variant font-semibold">
              mmHg
            </span>
          </div>
          <span className="font-label-md text-[14px] text-outline font-medium">SYS / DIA</span>
        </div>

        {/* Reassuring Doctor / Caregiver Feedback Note */}
        <div className="mt-3.5 flex items-start gap-2.5 bg-primary/10 text-on-surface p-3 rounded-xl">
          <span className="material-symbols-outlined text-primary text-[24px] shrink-0 mt-0.5">thumb_up</span>
          <p className="font-body-md text-body-md leading-relaxed text-on-surface">
            Huyết áp của Bác đang rất ổn định, giữ mức này nhé Bác.
          </p>
        </div>
      </div>

      {/* 3. Metric 2: ĐƯỜNG HUYẾT */}
      <div className="flex flex-col bg-surface-container-lowest p-space-md rounded-2xl shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[26px]">water_drop</span>
            </div>
            <div>
              <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold block">
                Đường huyết
              </span>
              <span className="font-body-md text-[14px] text-outline">(Đo lúc đói)</span>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md flex items-center gap-1.5 shadow-sm font-bold">
            <span className="material-symbols-outlined text-[20px]">verified</span>
            MỨC AN TOÀN
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/20">
          <div className="flex items-baseline gap-2">
            <span className="font-display-stat text-[44px] leading-tight text-on-surface font-bold tracking-tight">
              {vitals.bloodSugar}
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface-variant font-semibold">
              mmol/L
            </span>
          </div>
          <span className="font-label-md text-[14px] text-primary-container font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">done_all</span> Đạt tiêu chuẩn
          </span>
        </div>
      </div>

      {/* 4. Metric 3: NHỊP TIM */}
      <div className="flex flex-col bg-surface-container-lowest p-space-md rounded-2xl shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[26px] animate-pulse">cardiology</span>
            </div>
            <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider font-bold">
              Nhịp tim
            </span>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-primary text-[20px]">health_and_safety</span>
            Đều đặn
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/20">
          <div className="flex items-baseline gap-2">
            <span className="font-display-stat text-[44px] leading-tight text-on-surface font-bold tracking-tight">
              {vitals.heartRate}
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface-variant font-semibold">
              nhịp/phút
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-tertiary">
            <span className="material-symbols-outlined text-[22px] animate-bounce">favorite</span>
            <span className="font-label-md text-[14px] font-bold">Bình thường</span>
          </div>
        </div>
      </div>

      {/* 5. Shared Notification Card (Family Connection) */}
      <div className="flex items-center gap-3 bg-secondary-fixed/40 p-space-md rounded-2xl shadow-sm text-on-secondary-fixed border border-secondary/20">
        <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary text-[28px]">mark_email_read</span>
        </div>
        <div className="flex flex-col">
          <span className="font-label-lg text-label-lg text-on-surface font-bold leading-tight">
            Đã thông báo cho người thân
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant leading-snug mt-0.5">
            Đã tự động gửi kết quả sáng nay cho <strong className="text-on-surface font-bold">Con gái Lan</strong> (Đã xem lúc 07:45).
          </p>
        </div>
      </div>

      {/* 6. Big Clear Action Buttons (Elderly-Friendly Touch Targets) */}
      <div className="flex flex-col gap-3.5 pt-2">
        {/* Primary CTA: Start Measurement via Bluetooth */}
        <button
          className="w-full min-h-[64px] py-3.5 px-4 rounded-2xl bg-primary text-on-primary shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform cursor-pointer"
          onClick={handleStartBluetoothMeasure}
          disabled={isMeasuringBluetooth}
          type="button"
        >
          <span className="material-symbols-outlined text-[32px]">sensors</span>
          <div className="flex flex-col text-left">
            <span className="font-headline-sm text-headline-sm font-bold text-on-primary uppercase leading-tight tracking-wide">
              {isMeasuringBluetooth ? 'Đang thực hiện đo...' : 'Bắt đầu đo mới'}
            </span>
            <span className="font-body-md text-[14px] text-on-primary-container leading-none">
              Kết nối máy đo tự động (Bluetooth)
            </span>
          </div>
        </button>

        {/* Secondary CTA: Manual Entry */}
        <button
          className="w-full min-h-[60px] py-3 px-4 rounded-2xl bg-surface-container-high text-on-surface shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-transform cursor-pointer border border-outline-variant/30"
          onClick={() => {
            setModalType('bp');
            setIsModalOpen(true);
          }}
          type="button"
        >
          <span className="material-symbols-outlined text-on-surface text-[28px]">dialpad</span>
          <div className="flex flex-col text-left">
            <span className="font-label-lg text-label-lg font-bold text-on-surface uppercase leading-tight">
              Tự nhập chỉ số bằng tay
            </span>
            <span className="font-body-md text-[14px] text-outline leading-none">
              Mở bàn phím số lớn
            </span>
          </div>
        </button>
      </div>

      {/* Modal nhập chỉ số tay cho người cao tuổi (Large NumPad Dialog) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border-2 border-primary space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-outline-variant/30">
              <span className="font-headline-md text-headline-md text-primary font-bold">
                Nhập chỉ số sức khỏe
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Chọn loại chỉ số */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setModalType('bp')}
                className={`py-2 px-1 rounded-xl text-center font-bold text-sm cursor-pointer ${
                  modalType === 'bp' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
                }`}
              >
                Huyết áp
              </button>
              <button
                type="button"
                onClick={() => setModalType('sugar')}
                className={`py-2 px-1 rounded-xl text-center font-bold text-sm cursor-pointer ${
                  modalType === 'sugar' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
                }`}
              >
                Đường huyết
              </button>
              <button
                type="button"
                onClick={() => setModalType('hr')}
                className={`py-2 px-1 rounded-xl text-center font-bold text-sm cursor-pointer ${
                  modalType === 'hr' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
                }`}
              >
                Nhịp tim
              </button>
            </div>

            {/* Inputs */}
            {modalType === 'bp' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Huyết áp Tâm thu (SYS - số lớn):</label>
                  <input
                    type="number"
                    value={inputSys}
                    onChange={(e) => setInputSys(e.target.value)}
                    className="w-full h-14 text-2xl font-bold px-4 rounded-xl border-2 border-primary bg-surface-container-low text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Huyết áp Tâm trương (DIA - số nhỏ):</label>
                  <input
                    type="number"
                    value={inputDia}
                    onChange={(e) => setInputDia(e.target.value)}
                    className="w-full h-14 text-2xl font-bold px-4 rounded-xl border-2 border-primary bg-surface-container-low text-on-surface"
                  />
                </div>
              </div>
            )}

            {modalType === 'sugar' && (
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-bold text-on-surface mb-1">Chỉ số Đường huyết (mmol/L):</label>
                <input
                  type="text"
                  value={inputSugar}
                  onChange={(e) => setInputSugar(e.target.value)}
                  className="w-full h-14 text-2xl font-bold px-4 rounded-xl border-2 border-primary bg-surface-container-low text-on-surface"
                />
              </div>
            )}

            {modalType === 'hr' && (
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-bold text-on-surface mb-1">Nhịp tim (nhịp/phút):</label>
                <input
                  type="number"
                  value={inputHr}
                  onChange={(e) => setInputHr(e.target.value)}
                  className="w-full h-14 text-2xl font-bold px-4 rounded-xl border-2 border-primary bg-surface-container-low text-on-surface"
                />
              </div>
            )}

            {/* Nút lưu */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveManual}
                className="w-full h-14 rounded-xl bg-primary text-on-primary font-bold text-lg shadow-md cursor-pointer active:scale-95 transition-transform"
              >
                LƯU CHỈ SỐ MỚI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
