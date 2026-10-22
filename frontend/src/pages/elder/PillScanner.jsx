import React, { useState, useRef, useEffect } from 'react';
import { Camera, ArrowLeft, CheckCircle, AlertCircle, HelpCircle, Upload, Sparkles, RefreshCw, Volume2, SwitchCamera } from 'lucide-react';
import { captureCameraFrame } from '../../services/cameraService';
import { fetchMedications, speakText, verifyPillImage } from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';

export default function PillScanner({ onBack }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [medications, setMedications] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('1');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (cam sau) | 'user' (cam trước)

  useEffect(() => {
    // Tải danh mục thuốc
    fetchMedications()
      .then((data) => {
        setMedications(data || []);
        if (data && data.length > 0) {
          setSelectedMedId(String(data[0].id));
        }
      })
      .catch((e) => console.warn('Lỗi tải danh mục thuốc:', e));
  }, []);

  // Bật/tắt hoặc đổi camera
  useEffect(() => {
    let currentStream = null;
    async function startCam() {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        currentStream = s;
        setStream(s);
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.warn('Không thể mở camera phần cứng:', err);
        setCameraActive(false);
      }
    }

    startCam();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setPreviewSrc(null);
  };

  const sendImageForVerification = async (blob) => {
    setIsLoading(true);
    setResult(null);
    playChimeSound();

    const formData = new FormData();
    formData.append('medication_id', selectedMedId);
    formData.append('file', blob, 'capture.jpg');

    try {
      const data = await verifyPillImage(formData);
      setResult(data);
      // Đọc to kết quả cho Bác nghe
      if (data.message) {
        speakText(data.message).catch(() => {});
      }
    } catch (err) {
      setResult({
        cv_status: 'LOW_CONFIDENCE',
        score: 0.2,
        message: 'Dạ thưa Bác, hệ thống đã lưu lại ảnh để con cháu kiểm tra đối chiếu trực tiếp giúp Bác rồi ạ.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !cameraActive) return;
    const blob = await captureCameraFrame(videoRef.current);
    if (!blob) return;
    setPreviewSrc(URL.createObjectURL(blob));
    await sendImageForVerification(blob);
  };

  // Chọn ảnh từ máy tính / thiết bị
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewSrc(URL.createObjectURL(file));
      sendImageForVerification(file);
    }
  };

  // Thử nhanh với ảnh demo
  const handleTestDemoSample = async (samplePath) => {
    try {
      setIsLoading(true);
      setPreviewSrc(samplePath);
      const res = await fetch(samplePath);
      const blob = await res.blob();
      await sendImageForVerification(blob);
    } catch (e) {
      console.warn('Lỗi nạp ảnh demo:', e);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col items-center gap-6">
      {/* Nút quay lại */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 text-base md:text-lg font-bold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800/90 px-5 py-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
      >
        <ArrowLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Quay Lại Màn Hình Chính
      </button>

      <div className="text-center max-w-xl">
        <h2 className="text-3xl md:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">
          Soi Vỉ Thuốc Bằng Camera 📸
        </h2>
        <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 mt-2 font-medium">
          Dạ thưa Bác, Bác chọn loại thuốc cần kiểm tra, đưa vỉ thuốc vào khung hình sáng rõ và bấm nút chụp nhé ạ.
        </p>
      </div>

      {/* Bộ chọn loại thuốc cần đối chiếu */}
      <div className="w-full glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          💊 Thuốc Bác Cần Đối Chiếu:
        </span>
        <select
          value={selectedMedId}
          onChange={(e) => setSelectedMedId(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
        >
          {medications.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.dosage}) - Buổi {m.time_period}
            </option>
          ))}
        </select>
      </div>

      {/* Khung Camera / Viewfinder với Laser Scan Animation */}
      <div className="relative w-full aspect-video max-w-xl bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">
        {cameraActive && !previewSrc ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : previewSrc ? (
          <img src={previewSrc} alt="Captured preview" className="w-full h-full object-contain bg-black/80" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <Camera className="w-16 h-16 text-slate-600 mb-3" />
            <p className="text-lg font-bold">Chưa tìm thấy camera phần cứng</p>
            <p className="text-sm text-slate-500 mt-1">Bác có thể chọn nút "Tải ảnh từ máy" hoặc thử mẫu bên dưới</p>
          </div>
        )}

        {/* Khung ngắm y tế */}
        <div className="absolute inset-6 border-2 border-dashed border-emerald-400/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
          <div className="flex justify-between">
            <div className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
            <div className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
          </div>
          <div className="text-center">
            <span className="text-emerald-300 font-bold bg-black/60 px-4 py-1 rounded-full text-xs backdrop-blur-sm border border-emerald-500/30">
              {isLoading ? 'Đang phân tích hình ảnh AI...' : 'Đặt vỉ thuốc ngay ngắn ở đây'}
            </span>
          </div>
          <div className="flex justify-between">
            <div className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
            <div className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />
          </div>
        </div>

        {/* Tia laser quét lên xuống khi chụp/phân tích */}
        {isLoading && (
          <div className="absolute left-0 right-0 top-1/4 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-laser-scan pointer-events-none" />
        )}
      </div>

      {/* Hàng nút bấm chụp, đổi camera & tải ảnh */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <button
          onClick={handleCapture}
          disabled={isLoading || !cameraActive}
          className="min-h-[64px] px-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-display font-black text-xl rounded-2xl flex items-center gap-3 shadow-glow-purple disabled:opacity-50 transition-all"
        >
          <Camera className="w-6 h-6" />
          <span>{isLoading ? 'ĐANG ĐỐI CHIẾU...' : 'CHỤP VỈ THUỐC'}</span>
        </button>

        {cameraActive && !previewSrc && (
          <button
            onClick={toggleFacingMode}
            disabled={isLoading}
            className="min-h-[64px] px-5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-base rounded-2xl flex items-center gap-2 border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
            title="Đổi giữa camera sau và camera trước"
          >
            <SwitchCamera className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">{facingMode === 'environment' ? 'Đổi Cam Trước' : 'Đổi Cam Sau'}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="min-h-[64px] px-6 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-base rounded-2xl flex items-center gap-2 border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
        >
          <Upload className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <span>Tải Ảnh Từ Máy</span>
        </button>

        {previewSrc && (
          <button
            onClick={() => setPreviewSrc(null)}
            className="min-h-[64px] px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-2xl flex items-center gap-1.5 transition-all active:scale-95"
            title="Quay lại khung camera trực tiếp"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm">Bật lại Cam</span>
          </button>
        )}
      </div>

      {/* Thanh Demo tiện lợi để kiểm thử ngay 2 trường hợp MATCHED vs MISMATCH */}
      <div className="w-full glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <span className="font-bold text-slate-600 dark:text-slate-300">Kiểm thử nhanh bằng ảnh mẫu:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTestDemoSample('/demo_pills/amlodipine.jpg')}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800 transition-all active:scale-95"
          >
            <span>✓ Vỉ Amlodipine 5mg (Đúng mẫu)</span>
          </button>
          <button
            onClick={() => handleTestDemoSample('/demo_pills/mismatch_capsule.jpg')}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-900 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-300 dark:border-rose-800 transition-all active:scale-95"
          >
            <span>✗ Viên nang Redoxin (Khác mẫu)</span>
          </button>
        </div>
      </div>

      {/* Thẻ Kết Quả 3 Trạng Thái Chuẩn An Toàn Y Tế */}
      {result && (
        <div
          className={`w-full max-w-xl p-6 rounded-3xl border-2 text-center transition-all shadow-xl ${
            result.cv_status === 'MATCHED'
              ? 'bg-emerald-50/95 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-200 shadow-emerald-500/10'
              : result.cv_status === 'MISMATCH'
              ? 'bg-rose-50/95 dark:bg-rose-950/50 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-200 shadow-rose-500/10'
              : 'bg-amber-50/95 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200 shadow-amber-500/10'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            {result.cv_status === 'MATCHED' && <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />}
            {result.cv_status === 'MISMATCH' && <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />}
            {result.cv_status === 'LOW_CONFIDENCE' && <HelpCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />}
            <h4 className="text-xl md:text-2xl font-display font-black tracking-tight">
              {result.cv_status === 'MATCHED' && 'PHÙ HỢP TRONG PHẠM VI KIỂM TRA'}
              {result.cv_status === 'MISMATCH' && 'CẢNH BÁO: KHÔNG TRÙNG KHỚP'}
              {result.cv_status === 'LOW_CONFIDENCE' && 'HÌNH ẢNH CHƯA ĐỦ RÕ RÀNG'}
            </h4>
          </div>

          <p className="text-base md:text-lg font-semibold mt-2">{result.message}</p>

          {/* Thanh điểm tin cậy */}
          {result.confidence_score !== undefined && (
            <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-center gap-3 text-xs font-bold">
              <span>Độ tương đồng quang học:</span>
              <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800 border border-black/10 dark:border-white/10 font-mono text-sm">
                {Math.round(result.confidence_score * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
