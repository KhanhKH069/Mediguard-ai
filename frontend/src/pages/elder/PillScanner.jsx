import React, { useState, useRef, useEffect } from 'react';
import { Camera, ArrowLeft, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { captureCameraFrame } from '../../services/cameraService';

export default function PillScanner({ onBack }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function startCam() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 640, height: 480 }
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.warn('Không thể mở camera:', err);
      }
    }
    startCam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setIsLoading(true);
    setResult(null);

    const blob = await captureCameraFrame(videoRef.current);
    if (!blob) {
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('medication_id', '1'); // Thuốc mặc định Amlodipine
    formData.append('file', blob, 'capture.jpg');

    try {
      const res = await fetch('/api/vision/verify', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        cv_status: 'LOW_CONFIDENCE',
        message: 'Lỗi kết nối khi gửi ảnh. Đã lưu lại ảnh để người thân kiểm tra sau.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 text-xl font-bold text-slate-600 hover:text-slate-900 bg-white px-5 py-3 rounded-2xl shadow-sm"
      >
        <ArrowLeft className="w-6 h-6" /> Quay lại
      </button>

      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-slate-800">Soi Vỉ Thuốc Trước Camera</h2>
        <p className="text-lg text-slate-500 mt-1">
          Bác vui lòng đưa vỉ thuốc vào khung hình sáng rõ và bấm chụp
        </p>
      </div>

      {/* Khung Camera */}
      <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex items-center justify-center">
          <span className="text-white/80 font-bold bg-black/40 px-4 py-1 rounded-full text-sm">
            Đặt vỉ thuốc ở đây
          </span>
        </div>
      </div>

      {/* Nút Chụp */}
      <button
        onClick={handleCapture}
        disabled={isLoading}
        className="h-16 px-8 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-2xl rounded-2xl flex items-center gap-3 shadow-lg shadow-purple-600/30 disabled:opacity-50"
      >
        <Camera className="w-8 h-8" />
        <span>{isLoading ? 'ĐANG KIỂM TRA...' : 'CHỤP VỈ THUỐC'}</span>
      </button>

      {/* Hiển thị 3 trạng thái kết quả */}
      {result && (
        <div
          className={`w-full p-6 rounded-3xl border-2 text-center mt-2 ${
            result.cv_status === 'MATCHED'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
              : result.cv_status === 'MISMATCH'
              ? 'bg-rose-50 border-rose-400 text-rose-900'
              : 'bg-amber-50 border-amber-400 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            {result.cv_status === 'MATCHED' && <CheckCircle className="w-8 h-8 text-emerald-600" />}
            {result.cv_status === 'MISMATCH' && <AlertCircle className="w-8 h-8 text-rose-600" />}
            {result.cv_status === 'LOW_CONFIDENCE' && <HelpCircle className="w-8 h-8 text-amber-600" />}
            <h4 className="text-2xl font-black">
              {result.cv_status === 'MATCHED' && 'PHÙ HỢP TRONG PHẠM VI KIỂM TRA'}
              {result.cv_status === 'MISMATCH' && 'KHÔNG KHỚP VỚI MẪU THUỐC'}
              {result.cv_status === 'LOW_CONFIDENCE' && 'CHƯA ĐỦ ĐỘ TIN CẬY'}
            </h4>
          </div>
          <p className="text-xl font-semibold">{result.message}</p>
        </div>
      )}
    </div>
  );
}
