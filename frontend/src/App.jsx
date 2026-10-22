import React, { useState, useEffect } from 'react';
import { HeartPulse, Settings, User, LogOut, ArrowLeft, Activity, Calendar, Pill, History, Radio, Shield, Sun, Moon, Zap, Wifi } from 'lucide-react';
import ElderHome from './pages/elder/ElderHome';
import VoiceDialogue from './pages/elder/VoiceDialogue';
import PillScanner from './pages/elder/PillScanner';
import Login from './pages/auth/Login';

import Dashboard from './pages/caregiver/Dashboard';
import ScheduleManager from './pages/caregiver/ScheduleManager';
import MedicationList from './pages/caregiver/MedicationList';
import LogsView from './pages/caregiver/LogsView';
import PinModal from './components/PinModal';
import { fetchHealth, measurePing, subscribeLivePing, connectRealtimeUpdates, getStoredUser, clearStoredUser, fetchElders } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [mode, setMode] = useState(() => {
    const user = getStoredUser();
    return user?.role === 'CAREGIVER' ? 'caregiver' : 'elder';
  });
  const [elderSubPage, setElderSubPage] = useState('home'); // 'home' | 'voice' | 'scan'
  const [caregiverTab, setCaregiverTab] = useState('dashboard'); // 'dashboard' | 'schedules' | 'medications' | 'logs'
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [eldersList, setEldersList] = useState([]);
  const [caregiverElderId, setCaregiverElderId] = useState(1);
  
  // Theme state: Mặc định bật chế độ Tối (Dark Mode) siêu sắc nét theo yêu cầu
  const [theme, setTheme] = useState(() => localStorage.getItem('mediguard_theme') || 'dark');
  const [livePing, setLivePing] = useState(2);
  const [wsConnected, setWsConnected] = useState(true);

  // Áp dụng class 'dark' lên document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('mediguard_theme', theme);
  }, [theme]);

  // Giám sát Ping RTT thời gian thực qua WebSocket & REST
  useEffect(() => {
    // Đo ping ban đầu
    measurePing();

    // Lắng nghe cập nhật ping từ WebSocket heartbeat
    const unsubPing = subscribeLivePing((ms) => {
      setLivePing(ms);
    });

    // Kết nối WebSocket đồng bộ và đo Ping liên tục (Zero Latency)
    const disconnectWs = connectRealtimeUpdates(
      () => {},
      (status) => setWsConnected(status === 'connected'),
      (ms) => setLivePing(ms)
    );

    // Chu kỳ fallback kiểm tra kết nối mỗi 10 giây
    const timer = setInterval(() => {
      measurePing();
    }, 10000);

    return () => {
      unsubPing();
      disconnectWs();
      clearInterval(timer);
    };
  }, []);

  // Chuyển sang màn hình người chăm sóc cần nhập mã PIN
  const handleRequestCaregiverMode = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
    setMode('caregiver');
  };

  // Tải danh sách người cao tuổi để phân biệt dữ liệu giữa các tài khoản
  useEffect(() => {
    if (currentUser) {
      fetchElders().then((elders) => {
        if (elders && elders.length > 0) {
          setEldersList(elders);
          if (currentUser.role === 'CAREGIVER') {
            setCaregiverElderId((prev) => (elders.some((e) => e.id === prev) ? prev : elders[0].id));
          }
        }
      });
    }
  }, [currentUser]);

  const activeElderId = currentUser?.role === 'ELDER' ? currentUser.user_id : caregiverElderId;
  const currentElderProfile = eldersList.find((e) => e.id === activeElderId) || (eldersList.length > 0 ? eldersList[0] : null);

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
    setCurrentUser(null);
    setMode('elder');
    setElderSubPage('home');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Nếu chưa đăng nhập: Luôn hiển thị màn hình Đăng Nhập
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors selection:bg-blue-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-40 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-4 h-20 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-glow-blue">
              <HeartPulse className="w-7 h-7 stroke-[2.5] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-black tracking-tight text-slate-900 dark:text-white flex items-center">
                  MEDIGUARD <span className="text-blue-600 dark:text-blue-400 ml-1">AI</span>
                </h1>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold tracking-tight">
                Trợ lý AI an toàn dùng thuốc cho người cao tuổi
              </p>
            </div>
          </div>

          {/* Trạng thái Kết nối & Nút chuyển chế độ & Tài khoản */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Ping pill "Max Ping" */}
            <button
              onClick={measurePing}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border border-slate-200 dark:border-slate-700/80 text-xs font-mono font-bold transition-all shadow-sm active:scale-95"
              title="Bấm vào để kiểm tra lại Ping tức thời"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected ? 'bg-emerald-400 opacity-75' : 'bg-rose-400 opacity-75'}`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </span>
              <span className="text-slate-800 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-current text-amber-500" />
                <span>{livePing}ms</span>
              </span>
            </button>

            {/* Nút Chuyển Đổi Chế Độ Tối / Sáng */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 shadow-sm"
              title={theme === 'dark' ? 'Đổi sang giao diện Sáng' : 'Đổi sang giao diện Tối (Bảo vệ mắt ban đêm)'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Chuyển đổi giữa chế độ Người cao tuổi & Người chăm sóc */}
            {mode === 'elder' ? (
              <button
                onClick={handleRequestCaregiverMode}
                className="flex items-center gap-2 px-3 sm:px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"
                title="Mở khu vực quản lý người chăm sóc (Cần PIN)"
              >
                <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden md:inline">Khu Vực Người Chăm Sóc</span>
                <span className="md:hidden">Quản Lý</span>
              </button>
            ) : (
              <button
                onClick={() => setMode('elder')}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-glow-blue transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Giao Diện Dành Cho Bác</span>
              </button>
            )}

            {/* Thông tin tài khoản & Nút ĐĂNG XUẤT */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={currentUser?.full_name}>
                  {currentUser?.full_name || currentUser?.username}
                </span>
                <span className="text-[10px] text-blue-500 dark:text-blue-400 font-semibold">
                  {currentUser?.role === 'CAREGIVER' ? 'Người chăm sóc' : 'Người cao tuổi (Bác)'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Đăng xuất khỏi tài khoản để chuyển người dùng khác"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng Xuất</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="flex-1 pb-12">
        {mode === 'elder' ? (
          <div>
            {elderSubPage === 'home' && (
              <ElderHome
                currentUser={currentUser}
                onOpenVoice={() => setElderSubPage('voice')}
                onOpenScan={() => setElderSubPage('scan')}
              />
            )}
            {elderSubPage === 'voice' && (
              <VoiceDialogue onBack={() => setElderSubPage('home')} />
            )}
            {elderSubPage === 'scan' && (
              <PillScanner onBack={() => setElderSubPage('home')} />
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            {/* Thanh hiển thị & chuyển đổi hồ sơ Người cao tuổi đang chăm sóc */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-glow-blue shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400">
                    Hồ Sơ Y Tế Đang Theo Dõi (Dữ Liệu Độc Lập Riêng Biệt):
                  </span>
                  <div className="font-display font-black text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
                    <span>{currentElderProfile ? currentElderProfile.full_name : (currentUser?.role === 'ELDER' ? currentUser.full_name : 'Bác Ba (72 tuổi)')}</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                      Mã: #{activeElderId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nếu có nhiều người cao tuổi trong hệ thống thì hiện dropdown chọn nhanh */}
              {eldersList.length > 1 && currentUser?.role === 'CAREGIVER' && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Đổi hồ sơ Bác:</span>
                  <select
                    value={activeElderId}
                    onChange={(e) => setCaregiverElderId(Number(e.target.value))}
                    className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    {eldersList.map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.full_name} ({el.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Thanh điều hướng Tab Người chăm sóc */}
            <div className="flex flex-wrap gap-2 glass-card p-2 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
              {[
                { id: 'dashboard', label: 'Tổng Quan 3 Trạng Thái', icon: Activity },
                { id: 'schedules', label: 'Quản Lý Lịch Nhắc', icon: Calendar },
                { id: 'medications', label: 'Danh Mục Thuốc & Ảnh Mẫu', icon: Pill },
                { id: 'logs', label: 'Nhật Ký Kiểm Toán Y Tế', icon: History },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = caregiverTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCaregiverTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-display font-bold text-sm transition-all active:scale-95 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-glow-blue'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Nội dung từng tab - Dữ liệu riêng biệt theo activeElderId */}
            {caregiverTab === 'dashboard' && <Dashboard elderId={activeElderId} currentUser={currentUser} />}
            {caregiverTab === 'schedules' && <ScheduleManager elderId={activeElderId} currentUser={currentUser} />}
            {caregiverTab === 'medications' && <MedicationList elderId={activeElderId} currentUser={currentUser} />}
            {caregiverTab === 'logs' && <LogsView elderId={activeElderId} currentUser={currentUser} />}
          </div>
        )}
      </main>

      {/* Footer bản quyền & triết lý an toàn */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/70 py-4 text-center text-xs text-slate-500 dark:text-slate-500 font-medium">
        <p>MediGuard AI © 2026 • Trợ lý an toàn dùng thuốc người cao tuổi • Triết lý Append-Only Event Log • Max Ping Hub</p>
      </footer>

      {/* Modal bảo vệ mã PIN 4 số */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
