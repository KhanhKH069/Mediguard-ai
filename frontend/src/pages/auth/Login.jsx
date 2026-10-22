import React, { useState, useEffect } from 'react';
import { HeartPulse, Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, UserPlus, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { loginUser, registerUser, fetchUsers, setStoredUser } from '../../services/api';

export default function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('ELDER'); // 'ELDER' | 'CAREGIVER'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // Mặc định không ghi nhớ để mỗi khi vào phải đăng nhập

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);

  // Tải danh sách người dùng mẫu có sẵn trong hệ thống
  useEffect(() => {
    let isMounted = true;
    fetchUsers().then((users) => {
      if (isMounted && users && users.length > 0) {
        setAvailableUsers(users);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const handleQuickLogin = (u) => {
    setUsername(u.username);
    setPassword('123456');
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        const result = await loginUser(username.trim(), password);
        setStoredUser(result, rememberMe);
        setSuccessMessage('Đăng nhập thành công! Đang chuyển hướng...');
        setTimeout(() => {
          onLoginSuccess(result);
        }, 500);
      } else {
        // Đăng ký mới
        if (!fullName.trim()) {
          setErrorMessage('Vui lòng nhập họ và tên của cụ hoặc người thân.');
          setIsLoading(false);
          return;
        }

        const result = await registerUser({
          username: username.trim(),
          password,
          full_name: fullName.trim(),
          role,
          phone_number: phoneNumber.trim() || null
        });

        setStoredUser(result, rememberMe);
        setSuccessMessage('Tạo tài khoản thành công! Đang khởi động hệ thống...');
        setTimeout(() => {
          onLoginSuccess(result);
        }, 600);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-[#070b14] flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Background glowing ambient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 shadow-glow-blue text-white ring-4 ring-blue-500/20 animate-pulse">
            <HeartPulse className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              MEDIGUARD <span className="text-blue-400">AI</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Trợ lý AI quản lý lịch dùng thuốc người cao tuổi Việt Nam
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/80 rounded-2xl border border-slate-700/60 mb-6">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'bg-blue-600 text-white shadow-glow-blue'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Đăng Nhập</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'register'
                  ? 'bg-blue-600 text-white shadow-glow-blue'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Tạo Hồ Sơ Mới</span>
            </button>
          </div>

          {/* Quick Demo Select (Khi ở tab Đăng nhập) */}
          {activeTab === 'login' && (
            <div className="mb-6 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/70 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5 text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Bấm chọn nhanh tài khoản mẫu:
                </span>
                <span className="text-[11px] text-slate-500">Mật khẩu: 123456</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin({ username: 'ong_ba' })}
                  className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 text-left transition-all active:scale-95 group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-blue-300">
                    👴 Bác Ba (72 tuổi)
                  </div>
                  <div className="text-[10px] text-slate-400">Tài khoản Bác (ong_ba)</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin({ username: 'anh_nam' })}
                  className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500/50 text-left transition-all active:scale-95 group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                    👨‍⚕️ Anh Nam (Con trai)
                  </div>
                  <div className="text-[10px] text-slate-400">Con trai / Người chăm sóc (anh_nam)</div>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nếu đang đăng ký mới */}
            {activeTab === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Họ Và Tên Của Bác Hoặc Con Cháu:
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ví dụ: Bác Nguyễn Văn Ba hoặc Anh Nam"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Vai Trò Trong Gia Đình:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('ELDER')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        role === 'ELDER'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      👴 Người cao tuổi (Bác)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('CAREGIVER')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        role === 'CAREGIVER'
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      👨‍⚕️ Người chăm sóc (Con/Cháu)
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Tên đăng nhập */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tên Đăng Nhập (Username):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  autoCapitalize="none"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all font-mono"
                />
                <User className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Mật Khẩu:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full pl-11 pr-11 py-3 rounded-2xl bg-slate-900/90 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all font-mono"
                />
                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-white absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Tùy chọn: Ghi nhớ đăng nhập */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-400 font-medium">Ghi nhớ đăng nhập trên máy này</span>
              </label>
            </div>

            {/* Báo lỗi / Thành công */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Nút bấm Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-display font-black text-base shadow-glow-blue transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : activeTab === 'login' ? (
                <>
                  <span>Đăng Nhập Vào Hệ Thống</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Hoàn Tất & Tạo Hồ Sơ</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Footer Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Bảo mật dữ liệu sức khỏe • Phân quyền thông minh cho gia đình</span>
        </div>
      </div>
    </div>
  );
}
