import React, { useState, useEffect } from 'react';
import { Lock, X, Delete, KeyRound } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function PinModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError('');
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin]);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        verify(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const verify = async (pinToTest) => {
    setIsVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToTest })
      });
      if (res.ok || pinToTest === '1234') {
        setPin('');
        onSuccess();
      } else {
        setError('Mã PIN chưa chính xác. Vui lòng thử lại.');
        setPin('');
      }
    } catch (err) {
      if (pinToTest === '1234') {
        setPin('');
        onSuccess();
      } else {
        setError('Không thể kết nối máy chủ');
        setPin('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickFill = () => {
    setPin('1234');
    verify('1234');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-sm w-full p-6 shadow-saas-lg relative border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-[#F0FDFA] dark:bg-[#0D9488]/15 text-[#0D9488] dark:text-[#2DD4BF] rounded-xl flex items-center justify-center mx-auto mb-3 border border-[#99F6E4] dark:border-[#0D9488]/30">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
            Mở Cổng Quản Trị Gia Đình
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Nhập mã PIN 4 chữ số dành cho người chăm sóc
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-slate-200 px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
            <KeyRound className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Mã PIN demo: <strong className="font-mono text-[#0D9488]">1234</strong></span>
          </div>
        </div>

        <div className="flex justify-center gap-3 mb-5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center font-mono text-xl font-bold transition-all ${
                idx < pin.length
                  ? 'border-[#0D9488] bg-[#F0FDFA] text-[#0D9488] dark:border-[#2DD4BF] dark:bg-[#0D9488]/20 dark:text-[#2DD4BF]'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              {idx < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-xs text-center font-semibold mb-3">{error}</p>}
        {isVerifying && <p className="text-[#0D9488] dark:text-[#2DD4BF] text-xs text-center font-semibold mb-3">Đang xác thực...</p>}

        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num.toString())}
              disabled={isVerifying}
              className="h-13 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-lg font-mono font-bold text-[#0B1F3A] dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleQuickFill}
            disabled={isVerifying}
            className="h-13 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 hover:bg-[#CCFBF1] text-xs font-bold text-[#0F766E] dark:text-[#5EEAD4] flex flex-col items-center justify-center transition-colors border border-[#99F6E4] dark:border-[#0D9488]/40 cursor-pointer"
            title="Điền nhanh 1234"
          >
            <span>Điền nhanh</span>
            <span className="font-mono">1234</span>
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={isVerifying}
            className="h-13 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-lg font-mono font-bold text-[#0B1F3A] dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={isVerifying}
            className="h-13 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
