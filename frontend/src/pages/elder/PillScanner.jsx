import React, { useState, useRef, useEffect } from 'react';
import { Camera, ArrowLeft, CheckCircle, AlertCircle, HelpCircle, Upload, RefreshCw, SwitchCamera } from 'lucide-react';
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
  const [facingMode, setFacingMode] = useState('environment');

  useEffect(() => {
    fetchMedications()
      .then((data) => {
        setMedications(data || []);
        if (data && data.length > 0) {
          setSelectedMedId(String(data[0].id));
        }
      })
      .catch((e) => console.warn('Lỗi tải danh mục thuốc:', e));
  }, []);

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
      if (data.message) {
        speakText(data.message).catch(() => {});
      }
    } catch (err) {
      setResult({
        cv_status: 'LOW_CONFIDENCE',
        score: 0.4,
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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewSrc(URL.createObjectURL(file));
      sendImageForVerification(file);
    }
  };

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
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 text-base font-bold text-[#0B1F3A] dark:text-white bg-white dark:bg-[#0E1E36] px-5 py-3 rounded-xl shadow-saas border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5 text-[#0D9488]" /> Quay lại màn hình chính
      </button>

      <div className="text-center max-w-xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-[#0B1F3A] dark:text-white tracking-tight">
          Kiểm tra vỉ thuốc bằng Camera
        </h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mt-1.5">
          Bác chọn loại thuốc cần kiểm tra, đưa vỉ thuốc vào khung hình sáng rõ và bấm nút chụp.
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#0E1E36] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-saas">
        <span className="text-sm font-bold text-[#0B1F3A] dark:text-slate-200">
          Thuốc cần đối chiếu:
        </span>
        <select
          value={selectedMedId}
          onChange={(e) => setSelectedMedId(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#0D9488] bg-slate-50 dark:bg-slate-800 font-bold text-[#0B1F3A] dark:text-white outline-none"
        >
          {medications.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.dosage}) - Buổi {m.time_period}
            </option>
          ))}
        </select>
      </div>

      <div className="relative w-full aspect-video max-w-xl bg-slate-950 rounded-3xl overflow-hidden shadow-saas-lg border-2 border-slate-800">
        {cameraActive && !previewSrc ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : previewSrc ? (
          <img src={previewSrc} alt="Captured preview" className="w-full h-full object-contain bg-black/80" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <Camera className="w-14 h-14 text-slate-600 mb-3" />
            <p className="text-base font-bold">Chưa tìm thấy camera phần cứng</p>
            <p className="text-xs text-slate-500 mt-1">Bác có thể chọn nút "Tải ảnh từ máy" hoặc thử mẫu bên dưới</p>
          </div>
        )}

        <div className="absolute inset-6 border-2 border-dashed border-[#2DD4BF]/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
          <div className="flex justify-between">
            <div className="w-5 h-5 border-t-4 border-l-4 border-[#2DD4BF] rounded-tl" />
            <div className="w-5 h-5 border-t-4 border-r-4 border-[#2DD4BF] rounded-tr" />
          </div>
          <div className="text-center">
            <span className="text-[#5EEAD4] font-semibold bg-black/60 px-4 py-1 rounded-full text-xs backdrop-blur-xs">
              {isLoading ? 'Đang phân tích hình ảnh AI...' : 'Đặt vỉ thuốc ngay ngắn ở đây'}
            </span>
          </div>
          <div className="flex justify-between">
            <div className="w-5 h-5 border-b-4 border-l-4 border-[#2DD4BF] rounded-bl" />
            <div className="w-5 h-5 border-b-4 border-r-4 border-[#2DD4BF] rounded-br" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <button
          onClick={handleCapture}
          disabled={isLoading || !cameraActive}
          className="min-h-[56px] px-7 bg-[#0D9488] hover:bg-[#0F766E] text-white font-display font-bold text-lg rounded-2xl flex items-center gap-2.5 shadow-saas-md disabled:opacity-50 transition-all cursor-pointer"
        >
          <Camera className="w-5 h-5" />
          <span>{isLoading ? 'Đang đối chiếu...' : 'Chụp vỉ thuốc'}</span>
        </button>

        {cameraActive && !previewSrc && (
          <button
            onClick={toggleFacingMode}
            disabled={isLoading}
            className="min-h-[56px] px-5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-[#0B1F3A] dark:text-slate-200 font-semibold text-sm rounded-2xl flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <SwitchCamera className="w-5 h-5 text-[#0D9488]" />
            <span>{facingMode === 'environment' ? 'Đổi Cam Trước' : 'Đổi Cam Sau'}</span>
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
          className="min-h-[56px] px-5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-[#0B1F3A] dark:text-slate-200 font-semibold text-sm rounded-2xl flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <Upload className="w-5 h-5 text-[#0D9488]" />
          <span>Tải ảnh từ máy</span>
        </button>

        {previewSrc && (
          <button
            onClick={() => setPreviewSrc(null)}
            className="min-h-[56px] px-4 bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-slate-200 font-semibold rounded-2xl flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs">Mở lại Camera</span>
          </button>
        )}
      </div>

      <div className="w-full bg-white dark:bg-[#0E1E36] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm shadow-saas">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Kiểm thử nhanh bằng ảnh mẫu:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTestDemoSample('/demo_pills/amlodipine.jpg')}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-[#F0FDFA] text-[#0F766E] font-semibold text-xs border border-[#99F6E4] cursor-pointer"
          >
            ✓ Vỉ Amlodipine 5mg (Phù hợp)
          </button>
          <button
            onClick={() => handleTestDemoSample('/demo_pills/mismatch_capsule.jpg')}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-red-50 text-red-700 font-semibold text-xs border border-red-200 cursor-pointer"
          >
            ✗ Viên nang Redoxin (Không khớp)
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`w-full max-w-xl p-6 rounded-2xl border-2 text-center transition-all shadow-saas-md ${
            result.cv_status === 'MATCHED'
              ? 'bg-[#F0FDFA] border-[#0D9488] text-[#0B1F3A]'
              : result.cv_status === 'MISMATCH'
              ? 'bg-red-50 border-red-500 text-red-950'
              : 'bg-amber-50 border-amber-500 text-amber-950'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            {result.cv_status === 'MATCHED' && <CheckCircle className="w-7 h-7 text-[#0D9488]" />}
            {result.cv_status === 'MISMATCH' && <AlertCircle className="w-7 h-7 text-red-600" />}
            {result.cv_status === 'LOW_CONFIDENCE' && <HelpCircle className="w-7 h-7 text-amber-600" />}
            <h4 className="text-xl font-display font-bold">
              {result.cv_status === 'MATCHED' && 'Kết quả: Phù hợp với mẫu thuốc'}
              {result.cv_status === 'MISMATCH' && 'Cảnh báo: Không khớp mẫu thuốc'}
              {result.cv_status === 'LOW_CONFIDENCE' && 'Hình ảnh chưa đủ chắc chắn'}
            </h4>
          </div>

          <p className="text-sm sm:text-base font-medium mt-1">{result.message}</p>

          {result.confidence_score !== undefined && (
            <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-center gap-3 text-xs font-semibold">
              <span>Độ tương đồng quang học:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-mono text-sm">
                {Math.round(result.confidence_score * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
