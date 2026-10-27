import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MediGuard Care | Clinical Voice AI & Post-Discharge Triage Dashboard',
  description: 'Nền tảng AI Voicebot theo dõi lâm sàng và hỗ trợ phân loại ưu tiên chăm sóc bệnh nhân sau xuất viện',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
