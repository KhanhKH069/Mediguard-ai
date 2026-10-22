import React, { useState } from 'react';
import { HeartPulse, Settings, User, LogOut, ArrowLeft } from 'lucide-react';
import ElderHome from './pages/elder/ElderHome';
import VoiceDialogue from './pages/elder/VoiceDialogue';
import PillScanner from './pages/elder/PillScanner';

import Dashboard from './pages/caregiver/Dashboard';
import ScheduleManager from './pages/caregiver/ScheduleManager';
import MedicationList from './pages/caregiver/MedicationList';
import LogsView from './pages/caregiver/LogsView';
import PinModal from './components/PinModal';

export default function App() {
  const [mode, setMode] = useState('elder'); // 'elder' | 'caregiver'
  const [elderSubPage, setElderSubPage] = useState('home'); // 'home' | 'voice' | 'scan'
  const [caregiverTab, setCaregiverTab] = useState('dashboard'); // 'dashboard' | 'schedules' | 'medications' | 'logs'
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Chuyển sang màn hình người chăm sóc cần nhập mã PIN
  const handleRequestCaregiverMode = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
    setMode('caregiver');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-18 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                MEDIGUARD <span className="text-blue-600">AI</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">Trợ lý quản lý thuốc người cao tuổi</p>
            </div>
          </div>

          {/* Nút chuyển chế độ */}
          <div>
            {mode === 'elder' ? (
              <button
                onClick={handleRequestCaregiverMode}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors border border-slate-300"
              >
                <Settings className="w-4 h-4 text-blue-600" />
                <span>Chế Độ Người Thân</span>
              </button>
            ) : (
              <button
                onClick={() => setMode('elder')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Về Màn Hình Cụ Già</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="flex-1 pb-12">
        {mode === 'elder' ? (
          <div>
            {elderSubPage === 'home' && (
              <ElderHome
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
            {/* Thanh điều hướng Tab của Người chăm sóc */}
            <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <button
                onClick={() => setCaregiverTab('dashboard')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  caregiverTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tổng Quan 3 Trạng Thái
              </button>
              <button
                onClick={() => setCaregiverTab('schedules')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  caregiverTab === 'schedules'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Quản Lý Lịch Nhắc
              </button>
              <button
                onClick={() => setCaregiverTab('medications')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  caregiverTab === 'medications'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Danh Mục Thuốc & Ảnh Mẫu
              </button>
              <button
                onClick={() => setCaregiverTab('logs')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  caregiverTab === 'logs'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Biên Bản Kiểm Toán (Audit Log)
              </button>
            </div>

            {/* Nội dung từng tab */}
            {caregiverTab === 'dashboard' && <Dashboard />}
            {caregiverTab === 'schedules' && <ScheduleManager />}
            {caregiverTab === 'medications' && <MedicationList />}
            {caregiverTab === 'logs' && <LogsView />}
          </div>
        )}
      </main>

      {/* Modal bảo vệ mã PIN 4 số */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
