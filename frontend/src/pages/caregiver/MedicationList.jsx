import React, { useState, useEffect } from 'react';
import { Plus, Pill, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { fetchMedications } from '../../services/api';

export default function MedicationList() {
  const [medications, setMedications] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Thuốc Huyết Áp');
  const [dosage, setDosage] = useState('1 viên');
  const [instruction, setInstruction] = useState('Uống sau khi ăn 30 phút');
  const [timePeriod, setTimePeriod] = useState('Sáng');
  const [uploadingId, setUploadingId] = useState(null);

  const loadMeds = async () => {
    try {
      const data = await fetchMedications();
      setMedications(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMeds();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/medications/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elder_id: 1,
          name,
          category,
          dosage,
          instruction,
          time_period: timePeriod
        })
      });
      if (res.ok) {
        setName('');
        await loadMeds();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadImage = async (medId, file) => {
    if (!file) return;
    setUploadingId(medId);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/medications/${medId}/upload-reference-image`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert('Đã cập nhật ảnh mẫu tham chiếu cho thuốc thành công!');
        await loadMeds();
      }
    } catch (err) {
      alert('Lỗi tải ảnh');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form thêm thuốc */}
      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Plus className="w-6 h-6 text-blue-600" /> Thêm Thuốc Vào Danh Mục
        </h3>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tên Thuốc</label>
              <input
                type="text"
                placeholder="Ví dụ: Amlodipine 5mg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nhóm / Công Dụng</label>
              <input
                type="text"
                placeholder="Ví dụ: Thuốc Huyết Áp"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Liều Lượng</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Cữ Uống</label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-medium"
              >
                <option value="Sáng">Sáng</option>
                <option value="Trưa">Trưa</option>
                <option value="Tối">Tối</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Hướng Dẫn Uống</label>
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md"
          >
            LƯU THUỐC MỚI
          </button>
        </form>
      </div>

      {/* Danh sách thuốc */}
      <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200">
        <h4 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Pill className="w-6 h-6 text-blue-600" /> Danh Mục Thuốc Của Bác
        </h4>

        <div className="space-y-4">
          {medications.map((m) => (
            <div
              key={m.id}
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="text-lg font-bold text-slate-800">{m.name}</h5>
                  <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
                    {m.category}
                  </span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                    Cữ {m.time_period}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Liều dùng: <span className="font-semibold text-slate-800">{m.dosage}</span> • {m.instruction}
                </p>
                {m.reference_image && (
                  <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã có ảnh vỉ mẫu đối chiếu
                  </p>
                )}
              </div>

              {/* Upload ảnh vỉ mẫu */}
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl border border-slate-300 shadow-sm transition-colors">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>{uploadingId === m.id ? 'Đang tải...' : 'Tải Ảnh Vỉ Mẫu'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadImage(m.id, e.target.files[0])}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
