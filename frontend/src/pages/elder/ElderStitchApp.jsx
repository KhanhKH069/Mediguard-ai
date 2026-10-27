import React, { useState, useEffect } from 'react';
import ElderMedicationTab from './ElderMedicationTab';
import ElderVoiceAssistantTab from './ElderVoiceAssistantTab';
import ElderHealthVitalsTab from './ElderHealthVitalsTab';
import ElderEmergencyTab from './ElderEmergencyTab';

export default function ElderStitchApp({
  currentUser,
  elderId = null,
  onRequestCaregiverMode,
  onLogout,
  onOpenPillScanner,
  onOpenDrugLookup,
  onOpenSymptomReport,
  livePing = 2,
  wsConnected = true
}) {
  const [activeTab, setActiveTab] = useState('thuoc-uong');
  const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tên và tuổi người cao tuổi
  const elderDisplayName = currentUser?.full_name ? currentUser.full_name : 'Bác An';
  const elderShortName = elderDisplayName.split(' ').pop();
  const elderAge = currentUser?.age || 72;

  // Tiêu đề phụ tương ứng với từng Tab
  const getTabTitle = () => {
    switch (activeTab) {
      case 'thuoc-uong':
        return 'Thuốc Uống';
      case 'tro-ly-ai':
        return 'Trợ Lý AI';
      case 'suc-khoe':
        return 'Sức Khỏe';
      case 'nguoi-than':
        return 'Người Thân';
      default:
        return 'Thuốc Uống';
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* =================================================================== */}
      {/* 1. FIXED TOP HEADER (THIẾT KẾ STITCH CHUẨN)                         */}
      {/* =================================================================== */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_2px_12px_rgba(19,27,46,0.06)] pt-safe border-b border-outline-variant/30">
        <div className="h-20 px-space-md max-w-2xl mx-auto flex items-center justify-between gap-space-xs">
          {/* Logo & Tab Title */}
          <div className="flex items-center gap-space-xs cursor-pointer" onClick={() => setActiveTab('thuoc-uong')}>
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[26px]">favorite</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight leading-none font-bold">
                MediGuard AI
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-primary-container animate-pulse' : 'bg-tertiary'}`}></span>
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  {getTabTitle()}
                </span>
              </div>
            </div>
          </div>

          {/* Đồng hồ hiển thị thời gian thực cho Người cao tuổi */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface-container-high border border-outline-variant/40 text-primary shadow-xs" title="Giờ hiện tại">
            <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
            <span className="font-mono font-bold text-base sm:text-lg tracking-tight text-primary">
              {currentTime}
            </span>
          </div>

          {/* Top Actions: SOS Button & Profile */}
          <div className="flex items-center gap-2 sm:gap-space-sm">
            {/* SOS Button: Chuyển ngay đến Tab khẩn cấp */}
            <button
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-tertiary text-on-tertiary shadow-[0_2px_8px_rgba(171,0,15,0.3)] active:scale-95 transition-transform min-h-[48px] cursor-pointer"
              onClick={() => setActiveTab('nguoi-than')}
              title="Kênh cứu trợ khẩn cấp SOS"
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">emergency</span>
              <span className="font-headline-sm text-headline-sm font-bold tracking-wider">SOS</span>
            </button>

            {/* Profile pill */}
            <div className="flex items-center gap-2 pl-1">
              <div className="hidden xs:flex flex-col text-right">
                <span className="font-label-md text-label-md leading-tight text-on-surface font-bold">
                  Bác {elderShortName}
                </span>
                <span className="font-body-md text-[13px] text-outline leading-tight">
                  {elderAge} tuổi
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center ring-2 ring-primary/20 text-sm shadow-xs">
                {elderShortName[0]}
              </div>
            </div>

            {/* Chuyển sang Cổng Người Nhà (Caregiver Mode with PIN) */}
            <button
              onClick={onRequestCaregiverMode}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border border-outline-variant/40"
              title="Chuyển sang Cổng Quản lý Gia đình (Cần mã PIN)"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">manage_accounts</span>
            </button>

            {/* Đăng xuất / Đổi tài khoản */}
            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-surface-container hover:bg-error-container text-outline hover:text-tertiary transition-colors cursor-pointer border border-outline-variant/40"
              title="Đăng xuất"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. MAIN CONTENT CONTAINER (SINGLE-COLUMN FLUID ELDER LAYOUT)        */}
      {/* =================================================================== */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-space-md pt-24 pb-28 min-h-screen">
        {activeTab === 'thuoc-uong' && (
          <ElderMedicationTab
            currentUser={currentUser}
            elderId={targetElderId}
            onOpenVoice={() => setActiveTab('tro-ly-ai')}
            onOpenPillScanner={onOpenPillScanner}
            onOpenSOS={() => setActiveTab('nguoi-than')}
          />
        )}

        {activeTab === 'tro-ly-ai' && (
          <ElderVoiceAssistantTab
            currentUser={currentUser}
            elderId={targetElderId}
            onOpenSymptomReport={onOpenSymptomReport}
          />
        )}

        {activeTab === 'suc-khoe' && (
          <ElderHealthVitalsTab currentUser={currentUser} elderId={targetElderId} />
        )}

        {activeTab === 'nguoi-than' && (
          <ElderEmergencyTab
            currentUser={currentUser}
            elderId={targetElderId}
            onOpenVoice={() => setActiveTab('tro-ly-ai')}
          />
        )}
      </main>

      {/* =================================================================== */}
      {/* 3. FIXED BOTTOM NAVIGATION BAR (THIẾT KẾ STITCH CHUẨN 4 TABS)        */}
      {/* =================================================================== */}
      <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/95 backdrop-blur-xl shadow-[0_-4px_16px_rgba(19,27,46,0.08)] border-t border-outline-variant/30">
        <div className="flex justify-around items-center h-24 px-space-xs max-w-2xl mx-auto">
          {/* Tab 1: Thuốc uống */}
          <button
            onClick={() => setActiveTab('thuoc-uong')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[76px] min-h-[64px] py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'thuoc-uong' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            {activeTab === 'thuoc-uong' ? (
              <div className="px-4 py-1 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-xs">
                <span className="material-symbols-outlined text-[28px]">medication</span>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[30px]">medication</span>
            )}
            <span className={`font-label-md text-label-md text-center leading-tight ${activeTab === 'thuoc-uong' ? 'text-primary font-bold' : ''}`}>
              Thuốc uống
            </span>
          </button>

          {/* Tab 2: Trợ lý AI */}
          <button
            onClick={() => setActiveTab('tro-ly-ai')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[76px] min-h-[64px] py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'tro-ly-ai' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            {activeTab === 'tro-ly-ai' ? (
              <div className="px-4 py-1 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-xs">
                <span className="material-symbols-outlined text-[28px]">mic</span>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[30px]">mic</span>
            )}
            <span className={`font-label-md text-label-md text-center leading-tight ${activeTab === 'tro-ly-ai' ? 'text-primary font-bold' : ''}`}>
              Chị Google
            </span>
          </button>

          {/* Tab 3: Sức khỏe */}
          <button
            onClick={() => setActiveTab('suc-khoe')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[76px] min-h-[64px] py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'suc-khoe' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            {activeTab === 'suc-khoe' ? (
              <div className="px-4 py-1 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-xs">
                <span className="material-symbols-outlined text-[28px]">ecg_heart</span>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[30px]">ecg_heart</span>
            )}
            <span className={`font-label-md text-label-md text-center leading-tight ${activeTab === 'suc-khoe' ? 'text-primary font-bold' : ''}`}>
              Sức khỏe
            </span>
          </button>

          {/* Tab 4: Người thân */}
          <button
            onClick={() => setActiveTab('nguoi-than')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[76px] min-h-[64px] py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'nguoi-than' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            {activeTab === 'nguoi-than' ? (
              <div className="px-4 py-1 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-xs">
                <span className="material-symbols-outlined text-[28px]">contact_phone</span>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[30px]">contact_phone</span>
            )}
            <span className={`font-label-md text-label-md text-center leading-tight ${activeTab === 'nguoi-than' ? 'text-primary font-bold' : ''}`}>
              Người thân
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
