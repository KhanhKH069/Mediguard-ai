import React, { useState } from 'react';
import { playChimeSound } from '../../utils/soundEffects';
import { unlockAllAudio, playVoiceSpeech } from '../../services/voiceService';

export default function ElderEmergencyTab({ currentUser, onOpenVoice }) {
  const [safeToastVisible, setSafeToastVisible] = useState(false);
  const [safeBtnText, setSafeBtnText] = useState('Bác đang ở nhà an toàn (Gửi tin cho các con)');

  const handleSafePing = () => {
    unlockAllAudio();
    playChimeSound();
    setSafeToastVisible(true);
    setSafeBtnText('Đã gửi thông báo cho các con');

    playVoiceSpeech(null, 'Đã gửi tin nhắn an tâm kèm vị trí nhà cho con gái Lan và con trai Hùng rồi ạ!');

    setTimeout(() => {
      setSafeToastVisible(false);
      setSafeBtnText('Bác đang ở nhà an toàn (Gửi tin cho các con)');
    }, 4500);
  };

  const handleCallEmergency115 = () => {
    unlockAllAudio();
    playVoiceSpeech(null, 'Đang chuẩn bị kết nối cuộc gọi cấp cứu một một năm và phát tọa độ khẩn cấp!');
  };

  return (
    <div className="flex flex-col w-full gap-space-md pb-8">
      {/* 1. Status & Reassurance Header Capsule */}
      <div className="w-full bg-surface-container-high rounded-xl p-space-sm shadow-sm flex items-center justify-between border border-outline-variant/30">
        <div className="flex items-center gap-space-xs">
          <div className="w-3.5 h-3.5 rounded-full bg-primary animate-ping"></div>
          <span className="font-label-md text-label-md text-primary font-bold">
            Hệ thống trợ giúp đã sẵn sàng 24/7
          </span>
        </div>
        <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1 font-semibold">
          <span className="material-symbols-outlined text-[20px] text-primary">verified_user</span>
          GPS Chuẩn
        </span>
      </div>

      {/* 2. NÚT KHẨN CẤP SOS ĐỎ SIÊU TO */}
      <section className="w-full">
        <div className="w-full bg-tertiary text-on-tertiary rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm relative overflow-hidden">
          {/* Ambient alert glow */}
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-tertiary-container/30 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[36px] text-tertiary-fixed animate-bounce">
              e911_emergency
            </span>
            <div>
              <span className="font-headline-md text-headline-md font-bold tracking-tight block">
                KÊNH CỨU TRỢ KHẨN CẤP
              </span>
              <span className="font-label-md text-label-md text-tertiary-fixed opacity-95">
                Chạm vào đây khi Bác thấy mệt hoặc khó thở
              </span>
            </div>
          </div>

          {/* Action Button 115 */}
          <a
            className="w-full min-h-[72px] bg-surface-container-lowest text-tertiary rounded-xl p-space-sm flex items-center justify-center gap-space-sm shadow-lg active:scale-[0.98] transition-transform cursor-pointer"
            href="tel:115"
            id="btn-call-115"
            onClick={handleCallEmergency115}
          >
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-tertiary text-[32px]">call</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-headline-lg text-headline-lg font-black tracking-tight leading-none text-tertiary">
                BẤM GỌI CẤP CỨU 115
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant font-medium mt-1">
                Kết nối trực tiếp bệnh viện gần nhất
              </span>
            </div>
          </a>

          {/* Auto location broadcast note */}
          <div className="flex items-start gap-2 bg-on-tertiary/10 rounded-lg p-2.5">
            <span className="material-symbols-outlined text-[22px] text-tertiary-fixed shrink-0 mt-0.5">
              share_location
            </span>
            <p className="font-body-md text-body-md text-on-tertiary font-medium leading-snug">
              Khi bấm gọi, máy sẽ tự động gửi tọa độ nhà và bệnh án tim mạch của Bác cho đội y tế cấp cứu ngay lập tức.
            </p>
          </div>
        </div>
      </section>

      {/* 3. ĐỊA CHỈ NHÀ BÁC & BÁO AN TOÀN CHO CÁC CON */}
      <section className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-outline-variant/30">
        <div className="flex items-start gap-space-xs">
          <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-[32px]">home_pin</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-md text-label-md text-outline">Địa chỉ nhà cố định của Bác</span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface leading-tight mt-0.5">
              128 Nguyễn Trãi, Phường 3, Quận 5, TP.HCM
            </span>
          </div>
        </div>

        {/* Nút Bác an toàn */}
        <button
          className="w-full min-h-[58px] bg-primary-fixed text-on-primary-fixed rounded-xl px-space-md py-2 flex items-center justify-center gap-space-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          id="btn-safe-ping"
          onClick={handleSafePing}
          type="button"
        >
          <span className="material-symbols-outlined text-[28px] text-primary">volunteer_activism</span>
          <span className="font-label-lg text-label-lg font-bold text-on-primary-fixed-variant text-center">
            {safeBtnText}
          </span>
        </button>

        {safeToastVisible && (
          <div className="text-center py-2.5 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md animate-fade-in shadow-sm font-semibold">
            ✓ Đã gửi tin nhắn an tâm kèm vị trí đến con gái Lan và con trai Hùng!
          </div>
        )}
      </section>

      {/* 4. DANH BẠ NGƯỜI THÂN MỘT CHẠM */}
      <section className="w-full flex flex-col gap-space-md">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">contacts</span>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
              Người thân một chạm
            </h2>
          </div>
          <span className="font-label-md text-label-md text-on-surface-variant font-medium">
            Bấm là gọi ngay
          </span>
        </div>

        {/* LIÊN HỆ 1: CON GÁI LAN */}
        <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm relative border border-outline-variant/30">
          <div className="flex items-center gap-space-md">
            <div className="w-20 h-20 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-2xl shadow-sm shrink-0 border-2 border-primary/20">
              Lan
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  Con gái Lan
                </span>
                <span className="bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md px-2.5 py-0.5 rounded-full font-bold">
                  Chăm sóc chính
                </span>
              </div>
              <span className="font-display-stat text-[26px] font-bold text-primary tracking-wide leading-tight mt-0.5">
                0903 124 888
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
                <span className="font-body-md text-body-md text-on-surface-variant">
                  Đang rảnh • Đã xem nhật ký 10 phút trước
                </span>
              </div>
            </div>
          </div>
          <a
            className="w-full min-h-[64px] bg-primary text-on-primary rounded-xl px-space-md flex items-center justify-center gap-space-sm shadow-md active:scale-[0.98] transition-transform cursor-pointer"
            href="tel:0903124888"
          >
            <div className="w-10 h-10 rounded-full bg-on-primary/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px] text-on-primary">call</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-primary">
              GỌI ĐIỆN CHO CON GÁI
            </span>
          </a>
        </div>

        {/* LIÊN HỆ 2: BÁC SĨ NGUYỄN MINH */}
        <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-outline-variant/30">
          <div className="flex items-center gap-space-md">
            <div className="w-20 h-20 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center font-bold text-2xl shadow-sm shrink-0 border-2 border-secondary/20">
              Minh
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  BS. Nguyễn Minh
                </span>
                <span className="bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md px-2.5 py-0.5 rounded-full font-bold">
                  Bác sĩ riêng
                </span>
              </div>
              <span className="font-display-stat text-[26px] font-bold text-secondary tracking-wide leading-tight mt-0.5">
                0918 332 559
              </span>
              <span className="font-body-md text-body-md text-outline font-medium">
                Bệnh viện Đại học Y Dược TP.HCM
              </span>
            </div>
          </div>
          <a
            className="w-full min-h-[64px] bg-secondary text-on-secondary rounded-xl px-space-md flex items-center justify-center gap-space-sm shadow-md active:scale-[0.98] transition-transform cursor-pointer"
            href="tel:0918332559"
          >
            <div className="w-10 h-10 rounded-full bg-on-secondary/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px] text-on-secondary">medical_services</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-secondary">
              GỌI BÁC SĨ MINH (TIM MẠCH)
            </span>
          </a>
        </div>

        {/* LIÊN HỆ 3: CON TRAI HÙNG */}
        <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-outline-variant/30">
          <div className="flex items-center gap-space-md">
            <div className="w-20 h-20 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
              Hùng
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  Con trai Hùng
                </span>
                <span className="bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-2.5 py-0.5 rounded-full font-semibold">
                  Gia đình
                </span>
              </div>
              <span className="font-display-stat text-[26px] font-bold text-primary tracking-wide leading-tight mt-0.5">
                0987 654 321
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Nhà ở Quận 10 • Cách Bác 1.5 km
              </span>
            </div>
          </div>
          <a
            className="w-full min-h-[64px] bg-primary text-on-primary rounded-xl px-space-md flex items-center justify-center gap-space-sm shadow-md active:scale-[0.98] transition-transform cursor-pointer"
            href="tel:0987654321"
          >
            <div className="w-10 h-10 rounded-full bg-on-primary/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px] text-on-primary">call</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-primary">
              GỌI CHO CON TRAI HÙNG
            </span>
          </a>
        </div>
      </section>

      {/* 5. HƯỚNG DẪN GIỌNG NÓI & TRỢ GIÚP DỄ HIỂU CHO NGƯỜI LỚN TUỔI */}
      <section className="w-full bg-surface-container rounded-xl p-space-md shadow-sm flex items-center gap-space-sm border border-outline-variant/30">
        <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[30px]">mic</span>
        </div>
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
            Bác cũng có thể nói:
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            "Bấm phím <strong className="text-primary font-bold">Trợ lý AI</strong> ở dưới màn hình và nói: <span className="italic text-on-surface font-semibold">'Gọi cho con gái Lan'</span> hoặc <span className="italic text-on-surface font-semibold">'Gọi cấp cứu'</span> để máy tự gọi giúp Bác nhé."
          </p>
        </div>
      </section>
    </div>
  );
}
