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
      if (res.ok) {
        setPin('');
        onSuccess();
      } else {
        setError('Mã PIN không đúng. Vui lòng thử lại.');
        setPin('');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickFill = () => {
    setPin('1234');
    verify('1234');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-500"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Mã PIN Người Chăm Sóc</h3>
          <p className="text-sm text-slate-500 mt-1">Bấm các phím số hoặc gõ bàn phím</p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-xl text-xs font-bold border border-blue-200">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Mã PIN mặc định: <b>1234</b></span>
          </div>
        </div>

        {/* 4 dấu chấm PIN */}
        <div className="flex justify-center gap-4 mb-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all ${
                idx < pin.length ? 'bg-blue-600 scale-125' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-rose-600 text-sm text-center font-bold mb-3">{error}</p>}
        {isVerifying && <p className="text-blue-600 text-sm text-center font-bold mb-3">Đang xác thực...</p>}

        {/* Bàn phím số cảm ứng lớn */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num.toString())}
              disabled={isVerifying}
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-blue-100 text-2xl font-bold text-slate-800 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleQuickFill}
            disabled={isVerifying}
            className="h-14 rounded-2xl bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 flex flex-col items-center justify-center transition-colors border border-blue-200"
            title="Điền nhanh 1234"
          >
            <span>Điền</span>
            <span>1234</span>
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={isVerifying}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-blue-100 text-2xl font-bold text-slate-800 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={isVerifying}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-rose-100 text-slate-600 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
