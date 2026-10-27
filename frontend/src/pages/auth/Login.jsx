import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Activity,
  Camera,
  Mic
} from 'lucide-react';
import { loginUser, registerUser, fetchUsers, setStoredUser } from '../../services/api';

export default function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('CAREGIVER'); // 'ELDER' | 'CAREGIVER'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);

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
        setSuccessMessage('Đăng nhập thành công. Đang mở hệ thống MediGuard AI...');
        setTimeout(() => {
          onLoginSuccess(result);
        }, 350);
      } else {
        if (!fullName.trim()) {
          setErrorMessage('Vui lòng nhập họ và tên người dùng.');
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
        setSuccessMessage('Đã khởi tạo hồ sơ mới thành công.');
        setTimeout(() => {
          onLoginSuccess(result);
        }, 450);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B1F3A] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl border border-slate-200 shadow-saas-lg overflow-hidden">
        
        {/* Cột trái: Nền Navy lâm sàng & Chọn nhanh tài khoản Demo */}
        <div className="lg:col-span-6 bg-[#0B1F3A] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <div className="inline-flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0D9488] flex items-center justify-center shadow-sm">
                <HeartPulse className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#5EEAD4] block">
                  Nền tảng Y tế Gia đình Thông minh
                </span>
                <span className="font-display font-bold text-xl tracking-tight text-white">
                  MediGuard AI
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold leading-tight tracking-tight text-white">
                An tâm từng cữ thuốc của người thân mỗi ngày
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Hệ thống giám sát tuân thủ điều trị đa tầng kết hợp giọng nói tiếng Việt, thị giác máy tính đối chiếu thuốc và cổng quản trị gia đình thời gian thực.
              </p>
            </div>

            {/* 3 trụ cột công nghệ */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 text-[#5EEAD4] flex items-center justify-center shrink-0 mt-0.5">
                  <Mic className="w-4 h-4" />
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  <strong className="text-white">Trợ lý giọng nói tự nhiên:</strong> Nhắc cữ uống rõ ràng và lắng nghe phản hồi, triệu chứng của người cao tuổi.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 text-[#5EEAD4] flex items-center justify-center shrink-0 mt-0.5">
                  <Camera className="w-4 h-4" />
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  <strong className="text-white">Kiểm tra hình ảnh thuốc bằng AI:</strong> Đối chiếu vỉ thuốc và ngăn thuốc với mẫu chuẩn, cảnh báo sai lệch tức thời.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 text-[#5EEAD4] flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  <strong className="text-white">Xác thực chéo 3 lớp độc lập:</strong> Kết nối người cao tuổi, thiết bị tại nhà và người chăm sóc từ xa.
                </p>
              </div>
            </div>
          </div>

          {/* Chọn nhanh tài khoản Demo thuyết trình */}
          <div className="mt-8 pt-6 border-t border-white/10 space-y-3 relative z-10">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold">Tài khoản Demo thuyết trình (Chạm để điền nhanh):</span>
              <span className="font-mono text-[#5EEAD4]">MK: 123456</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  handleQuickLogin({ username: 'anh_nam' });
                }}
                className="p-3.5 rounded-xl bg-[#16325B]/90 hover:bg-[#1E4072] border border-[#0D9488]/50 text-left transition-all cursor-pointer group"
              >
                <div className="text-[11px] font-semibold text-[#5EEAD4]">
                  Dashboard Gia Đình (Caregiver)
                </div>
                <div className="text-sm font-display font-bold text-white mt-0.5">
                  Anh Nam (Người chăm sóc)
                </div>
                <div className="text-xs text-slate-300 font-mono mt-0.5">ID: anh_nam</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  handleQuickLogin({ username: 'ong_ba' });
                }}
                className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-left transition-all cursor-pointer group"
              >
                <div className="text-[11px] font-semibold text-amber-300">
                  Màn Hình Người Cao Tuổi
                </div>
                <div className="text-sm font-display font-bold text-white mt-0.5">
                  Bác Nguyễn Văn Ba
                </div>
                <div className="text-xs text-slate-300 font-mono mt-0.5">ID: ong_ba</div>
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải: Biểu mẫu Đăng nhập / Mở hồ sơ */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 mb-7">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setErrorMessage(''); setSuccessMessage(''); }}
                className={`py-2.5 rounded-lg font-sans font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setErrorMessage(''); setSuccessMessage(''); }}
                className={`py-2.5 rounded-lg font-sans font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Tạo tài khoản</span>
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-display font-bold text-[#0B1F3A]">
                {activeTab === 'login' ? 'Đăng nhập hệ thống MediGuard' : 'Khởi tạo hồ sơ gia đình'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {activeTab === 'login'
                  ? 'Chọn nhanh tài khoản mẫu bên trái hoặc nhập thông tin tài khoản của bạn.'
                  : 'Thiết lập tài khoản mới cho người chăm sóc hoặc người thân lớn tuổi.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Họ và tên đầy đủ
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn Nam"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#0D9488] focus:bg-white text-[#0B1F3A] placeholder-slate-400 text-sm font-medium outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Vai trò sử dụng
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRole('CAREGIVER')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                          role === 'CAREGIVER'
                            ? 'bg-[#F0FDFA] border-[#0D9488] text-[#0F766E]'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="font-display text-sm">Người chăm sóc</div>
                        <div className="text-[11px] font-normal opacity-80 mt-0.5">Quản lý lịch & giám sát từ xa</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('ELDER')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                          role === 'ELDER'
                            ? 'bg-[#F0FDFA] border-[#0D9488] text-[#0F766E]'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="font-display text-sm">Người cao tuổi</div>
                        <div className="text-[11px] font-normal opacity-80 mt-0.5">Chữ lớn, nghe nhắc thuốc</div>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="anh_nam hoặc ong_ba"
                    autoCapitalize="none"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#0D9488] focus:bg-white text-[#0B1F3A] placeholder-slate-400 text-sm outline-none transition-colors font-mono"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#0D9488] focus:bg-white text-[#0B1F3A] placeholder-slate-400 text-sm outline-none transition-colors font-mono"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-[#0B1F3A] absolute right-3 top-1/2 -translate-y-1/2 rounded-lg transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0D9488]"
                  />
                  <span className="text-xs text-slate-600 font-medium">Duy trì đăng nhập trên thiết bị này</span>
                </label>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.99] text-white font-display font-bold text-sm sm:text-base shadow-saas-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <span>Đang xác thực...</span>
                ) : activeTab === 'login' ? (
                  <>
                    <span>Truy cập Hệ thống</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Hoàn tất Đăng ký</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
              <span>Mã hóa & bảo mật hồ sơ sức khỏe gia đình</span>
            </span>
            <span className="font-mono">MediGuard AI v2.4</span>
          </div>
        </div>

      </div>
    </div>
  );
}
