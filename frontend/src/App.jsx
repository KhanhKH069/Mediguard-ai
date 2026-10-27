import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Settings,
  Users,
  LogOut,
  LayoutDashboard,
  CalendarClock,
  ScanEye,
  History,
  Sun,
  Moon,
  AlertTriangle,
  X,
  Type,
  ShieldCheck,
  Menu,
  ChevronRight,
  Smartphone,
  Mic
} from 'lucide-react';
import ElderHome from './pages/elder/ElderHome';
import ElderStitchApp from './pages/elder/ElderStitchApp';
import VoiceDialogue from './pages/elder/VoiceDialogue';
import ElderDrugLookup from './pages/elder/ElderDrugLookup';
import ElderSymptomReport from './pages/elder/ElderSymptomReport';
import PillScanner from './pages/elder/PillScanner';
import Login from './pages/auth/Login';

import Dashboard from './pages/caregiver/Dashboard';
import RelativeManager from './pages/caregiver/RelativeManager';
import ScheduleManager from './pages/caregiver/ScheduleManager';
import DrugLookup from './pages/caregiver/DrugLookup';
import LogsView from './pages/caregiver/LogsView';
import SettingsView from './pages/caregiver/SettingsView';
import PinModal from './components/PinModal';
import ElderVoiceControl from './components/ElderVoiceControl';
import {
  measurePing,
  subscribeLivePing,
  connectRealtimeUpdates,
  getStoredUser,
  clearStoredUser,
  fetchElders
} from './services/api';
import { playChimeSound } from './utils/soundEffects';

const SAAS_NAV_ITEMS = [
  {
    id: 'dashboard',
    step: '01',
    label: 'Dashboard gia đình',
    shortLabel: 'Tổng quan',
    sublabel: 'Lịch hôm nay, trạng thái & cảnh báo',
    icon: LayoutDashboard
  },
  {
    id: 'relatives',
    step: '02',
    label: 'Quản lý người thân',
    shortLabel: 'Người thân',
    sublabel: 'Hồ sơ, đơn thuốc & lịch sử theo dõi',
    icon: Users
  },
  {
    id: 'schedules',
    step: '03',
    label: 'Theo dõi thuốc',
    shortLabel: 'Lịch thuốc',
    sublabel: 'Lịch nhắc, giờ xác nhận & chờ duyệt',
    icon: CalendarClock
  },
  {
    id: 'vision_check',
    step: '04',
    label: 'Kiểm tra hình ảnh thuốc',
    shortLabel: 'Kiểm tra ảnh',
    sublabel: 'Phù hợp • Không khớp • Chưa chắc chắn',
    icon: ScanEye
  },
  {
    id: 'logs',
    step: '05',
    label: 'Nhật ký theo dõi',
    shortLabel: 'Nhật ký',
    sublabel: 'Lịch sử giọng nói & sự kiện y khoa',
    icon: History
  },
  {
    id: 'settings',
    step: '06',
    label: 'Cài đặt',
    shortLabel: 'Cài đặt',
    sublabel: 'Tài khoản, người chăm sóc & thông báo',
    icon: Settings
  }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get('preview');
      if (preview === 'caregiver') {
        return { user_id: 2, username: 'anh_nam', full_name: 'Nguyễn Văn Nam (Con trai)', role: 'CAREGIVER' };
      }
      if (preview === 'elder') {
        return { user_id: 1, username: 'ong_ba', full_name: 'Bác Nguyễn Văn Ba', role: 'ELDER' };
      }
    }
    return getStoredUser();
  });
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get('preview');
      if (preview === 'caregiver') return 'caregiver';
      if (preview === 'elder') return 'elder';
    }
    const user = getStoredUser();
    return user?.role === 'CAREGIVER' ? 'caregiver' : 'elder';
  });
  const [elderSubPage, setElderSubPage] = useState('home');
  const [scannerSchedule, setScannerSchedule] = useState(null);
  const [isVoiceControlOpen, setIsVoiceControlOpen] = useState(false);
  const [caregiverTab, setCaregiverTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && SAAS_NAV_ITEMS.some((item) => item.id === tab)) {
        return tab;
      }
    }
    return 'dashboard';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [eldersList, setEldersList] = useState([]);
  const [caregiverElderId, setCaregiverElderId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('mediguard_selected_elder_id');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return null;
  });
  const [liveSymptomToast, setLiveSymptomToast] = useState(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('mediguard_theme_v2') || 'light');
  const [fontScale, setFontScale] = useState(() => localStorage.getItem('mediguard_font_scale') || 'normal');
  const [livePing, setLivePing] = useState(2);
  const [wsConnected, setWsConnected] = useState(true);

  const handleNavigateCaregiverTab = (target) => {
    if (target === 'medication_tracking') {
      setCaregiverTab('schedules');
    } else {
      setCaregiverTab(target);
    }
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('mediguard_theme_v2', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.remove('font-scale-large', 'font-scale-xlarge');
    if (fontScale === 'large') {
      document.documentElement.classList.add('font-scale-large');
    } else if (fontScale === 'xlarge') {
      document.documentElement.classList.add('font-scale-xlarge');
    }
    localStorage.setItem('mediguard_font_scale', fontScale);
  }, [fontScale]);

  useEffect(() => {
    measurePing();

    const unsubPing = subscribeLivePing((ms) => {
      setLivePing(ms);
    });

    const disconnectWs = connectRealtimeUpdates(
      (msg) => {
        if (msg && msg.type === 'symptom_alert') {
          playChimeSound();
          setLiveSymptomToast(msg.data?.message || 'Bác vừa ghi nhận triệu chứng sức khỏe mới.');
        }
      },
      (status) => setWsConnected(status === 'connected'),
      (ms) => setLivePing(ms)
    );

    const timer = setInterval(() => {
      measurePing();
    }, 10000);

    return () => {
      unsubPing();
      disconnectWs();
      clearInterval(timer);
    };
  }, []);

  const handleRequestCaregiverMode = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
    setMode('caregiver');
  };

  const handleSelectElder = (id) => {
    const numId = id ? Number(id) : null;
    setCaregiverElderId(numId);
    if (numId) {
      sessionStorage.setItem('mediguard_selected_elder_id', String(numId));
    } else {
      sessionStorage.removeItem('mediguard_selected_elder_id');
    }
  };

  const loadEldersList = async () => {
    try {
      const elders = await fetchElders();
      if (elders && elders.length > 0) {
        setEldersList(elders);
        if (currentUser?.role === 'CAREGIVER') {
          setCaregiverElderId((prev) => (elders.some((e) => e.id === prev) ? prev : null));
        }
      } else {
        setEldersList([]);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (currentUser) {
      loadEldersList();
    }
  }, [currentUser]);

  const activeElderId = currentUser?.role === 'ELDER'
    ? (currentUser.user_id || currentUser.id)
    : (caregiverElderId || null);
  const currentElderProfile = activeElderId
    ? (eldersList.find((e) => e.id === activeElderId) || null)
    : null;

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'CAREGIVER') {
      setMode('caregiver');
    } else {
      setMode('elder');
    }
  };

  const handleLogout = () => {
    clearStoredUser();
    sessionStorage.removeItem('mediguard_selected_elder_id');
    setCaregiverElderId(null);
    setCurrentUser(null);
    setMode('elder');
    setElderSubPage('home');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const activeNavMeta =
    SAAS_NAV_ITEMS.find((item) => item.id === caregiverTab) || SAAS_NAV_ITEMS[0];

  // ============================================================================
  // CHẾ ĐỘ NGƯỜI CAO TUỔI (ELDER INTERFACE - THIẾT KẾ STITCH CHUẨN)
  // ============================================================================
  if (mode === 'elder') {
    if (elderSubPage === 'pill_scanner') {
      return (
        <div className="min-h-screen bg-surface font-body-md text-on-surface">
          <PillScanner
            onBack={() => setElderSubPage('home')}
            scheduleId={scannerSchedule?.id || 1}
            scheduleTitle={scannerSchedule ? `Cữ ${scannerSchedule.time_period} (${scannerSchedule.target_time})` : 'Cữ Sáng'}
            expectedMeds={scannerSchedule?.medications || []}
          />
        </div>
      );
    }
    if (elderSubPage === 'drug_lookup') {
      return (
        <div className="min-h-screen bg-surface font-body-md text-on-surface">
          <ElderDrugLookup onBack={() => setElderSubPage('home')} currentUser={currentUser} elderId={activeElderId} />
        </div>
      );
    }
    if (elderSubPage === 'symptom_report') {
      return (
        <div className="min-h-screen bg-surface font-body-md text-on-surface">
          <ElderSymptomReport onBack={() => setElderSubPage('home')} currentUser={currentUser} elderId={activeElderId} />
        </div>
      );
    }
    if (elderSubPage === 'voice') {
      return (
        <div className="min-h-screen bg-surface font-body-md text-on-surface">
          <VoiceDialogue onBack={() => setElderSubPage('home')} currentUser={currentUser} elderId={activeElderId} />
        </div>
      );
    }

    return (
      <>
        <ElderStitchApp
          currentUser={currentUser}
          elderId={activeElderId}
          onRequestCaregiverMode={handleRequestCaregiverMode}
          onLogout={handleLogout}
          onOpenPillScanner={(sch) => {
            setScannerSchedule(sch);
            setElderSubPage('pill_scanner');
          }}
          onOpenDrugLookup={() => setElderSubPage('drug_lookup')}
          onOpenSymptomReport={() => setElderSubPage('symptom_report')}
          livePing={livePing}
          wsConnected={wsConnected}
        />

        <PinModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={handlePinSuccess}
        />
      </>
    );
  }

  // ============================================================================
  // CHẾ ĐỘ HEALTHCARE SAAS (CAREGIVER / FAMILY PORTAL)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex font-sans text-[#0B1F3A] dark:text-slate-100 transition-colors selection:bg-[#0D9488] selection:text-white">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR ĐIỀU HƯỚNG (DEEP CLINICAL NAVY #0B1F3A) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-68 bg-[#0B1F3A] text-white flex flex-col justify-between border-r border-slate-800/80 transition-transform duration-200 ease-out shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center shadow-xs">
                <HeartPulse className="w-5 h-5 text-white stroke-[2.25]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base tracking-tight text-white">
                    MediGuard AI
                  </span>
                  <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-500/20 text-[#2DD4BF] border border-teal-400/30">
                    Clinical
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                  Medication Care SaaS
                </p>
              </div>
            </div>

            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Patient Context Selector inside Sidebar */}
          <div className="px-3.5 pt-3.5 pb-2">
            <div className="p-3 rounded-xl bg-white/[0.05] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Hồ sơ người thân
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Đang giám sát
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0D9488]/30 border border-[#2DD4BF]/40 flex items-center justify-center font-display font-bold text-xs text-[#2DD4BF] shrink-0">
                  {currentElderProfile ? currentElderProfile.full_name.charAt(0) : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {currentElderProfile
                      ? currentElderProfile.full_name
                      : currentUser?.role === 'ELDER'
                      ? (currentUser.full_name || 'Hồ sơ người cao tuổi')
                      : 'Chưa chọn người thân'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {activeElderId ? `ID #${activeElderId}` : 'Vui lòng chọn hồ sơ'}
                  </div>
                </div>
              </div>

              {currentUser?.role === 'CAREGIVER' && eldersList.length > 0 && (
                <select
                  value={activeElderId || ''}
                  onChange={(e) => handleSelectElder(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/15 text-xs font-medium text-slate-200 outline-none focus:border-[#2DD4BF] cursor-pointer"
                >
                  <option value="">-- Chọn hồ sơ người thân --</option>
                  {eldersList.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.full_name} (@{el.username})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 6 Main Navigation Screens */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Điều hướng chính">
            <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              Phân hệ quản lý
            </div>
            {SAAS_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = caregiverTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigateCaregiverTab(item.id)}
                  className={`w-full group flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#2DD4BF] group-hover:text-white'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-[13px] font-semibold truncate">
                        {item.label}
                      </div>
                      <p
                        className={`text-[11px] truncate ${
                          isActive ? 'text-teal-100/90' : 'text-slate-400'
                        }`}
                      >
                        {item.sublabel}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isActive ? 'text-white translate-x-0.5' : 'text-slate-500 opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Switch to Elder Screen */}
        <div className="p-3.5 border-t border-white/10 space-y-2.5 shrink-0 bg-slate-950/30">
          <button
            onClick={() => setMode('elder')}
            className="w-full py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-[#2DD4BF]" />
            <span>Màn Hình Của Bác (Senior UI)</span>
          </button>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span>3-Layer Clinical Auth</span>
            </span>
            <span className="font-mono text-[10px] text-teal-300">v2.5</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* TOP HEADER */}
        <header className="h-16 bg-white/95 dark:bg-[#0E1E36]/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[#0B1F3A] dark:text-white hover:bg-slate-100 cursor-pointer"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-display font-bold text-[#0B1F3A] dark:text-white truncate">
                    {activeNavMeta.label}
                  </h1>
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                    <span>
                      {currentElderProfile
                        ? currentElderProfile.full_name
                        : activeElderId
                        ? `Người thân #${activeElderId}`
                        : 'Chưa chọn hồ sơ'}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                  {activeNavMeta.sublabel}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Connection / Latency Pill */}
            <button
              onClick={measurePing}
              className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Kiểm tra độ trễ kết nối thời gian thực"
            >
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span>{wsConnected ? 'Đồng bộ' : 'Ngoại tuyến'}</span>
              <span className="font-mono text-[11px] text-[#0D9488] dark:text-[#2DD4BF] tabular-nums">
                {livePing}ms
              </span>
            </button>

            {/* Font size scaler */}
            <button
              onClick={() => {
                setFontScale((prev) => (prev === 'normal' ? 'large' : prev === 'large' ? 'xlarge' : 'normal'));
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              title="Tăng giảm cỡ chữ hiển thị"
            >
              <Type className="w-3.5 h-3.5 text-[#0D9488]" />
              <span className="hidden sm:inline">
                {fontScale === 'normal' ? 'Chữ vừa' : fontScale === 'large' ? 'Chữ lớn' : 'Rất lớn'}
              </span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-amber-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Account & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-[#0B1F3A] dark:text-white truncate max-w-[130px]">
                  {currentUser?.full_name || currentUser?.username}
                </span>
                <span className="text-[10px] text-[#0D9488] dark:text-[#2DD4BF] font-medium">
                  {currentUser?.role === 'CAREGIVER' ? 'Người chăm sóc' : 'Hồ sơ gia đình'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-700 dark:bg-slate-800 dark:hover:bg-red-950/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Đăng xuất tài khoản"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thoát</span>
              </button>
            </div>
          </div>
        </header>

        {/* Live Symptom Alert Toast */}
        {liveSymptomToast && (
          <div className="bg-red-600 text-white px-4 sm:px-8 py-2.5 border-b border-red-700 z-30">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">{liveSymptomToast}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleNavigateCaregiverTab('logs');
                    setLiveSymptomToast(null);
                  }}
                  className="px-3 py-1 rounded-lg bg-white text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer"
                >
                  Kiểm tra ngay
                </button>
                <button
                  onClick={() => setLiveSymptomToast(null)}
                  className="p-1 rounded-lg hover:bg-white/15 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE BODY */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-7xl w-full mx-auto">
          {caregiverTab === 'dashboard' && (
            <Dashboard
              elderId={activeElderId}
              currentUser={currentUser}
              onNavigate={handleNavigateCaregiverTab}
            />
          )}

          {caregiverTab === 'relatives' && (
            <RelativeManager
              elderId={activeElderId}
              eldersList={eldersList}
              onSelectElder={handleSelectElder}
              onEldersUpdated={loadEldersList}
              onNavigate={handleNavigateCaregiverTab}
              currentUser={currentUser}
            />
          )}

          {caregiverTab === 'schedules' && (
            <ScheduleManager elderId={activeElderId} currentUser={currentUser} />
          )}

          {caregiverTab === 'vision_check' && (
            <DrugLookup elderId={activeElderId} currentUser={currentUser} />
          )}

          {caregiverTab === 'logs' && (
            <LogsView elderId={activeElderId} currentUser={currentUser} />
          )}

          {caregiverTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              elderId={activeElderId}
              isDarkMode={theme === 'dark'}
              onToggleTheme={toggleTheme}
              fontScale={fontScale}
              onChangeFontScale={setFontScale}
            />
          )}
        </main>

        {/* SAAS FOOTER */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#0E1E36]/80 py-3.5 px-4 sm:px-8 text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-display font-semibold text-[#0B1F3A] dark:text-white">
              MediGuard AI — Nền tảng Quản lý Tuân thủ Thuốc & Đối chiếu Thị giác Y khoa
            </span>
            <span className="flex items-center gap-1.5 text-[#0D9488] dark:text-[#2DD4BF] font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Chuẩn xác thực 3 lớp (Voice • Vision • Caregiver)</span>
            </span>
          </div>
        </footer>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Hiển thị trên màn hình < 1024px) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0E1E36]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 py-1.5 grid grid-cols-6 gap-0.5"
        aria-label="Điều hướng di động"
      >
        {SAAS_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = caregiverTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigateCaregiverTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#0D9488] dark:text-[#2DD4BF] bg-teal-50/70 dark:bg-teal-950/40 font-bold'
                  : 'text-slate-500 dark:text-slate-400 font-medium'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] leading-tight mt-1 truncate max-w-full">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
