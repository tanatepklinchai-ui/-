import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "พร้อมฉีด (Prom Chid) - ระบบติดตามการฉีดวัคซีน",
  description:
    "พร้อมฉีดช่วยบันทึกและติดตามประวัติการฉีดวัคซีนเด็ก จัดการนัดหมายกับโรงพยาบาล และรับการแจ้งเตือนวันนัดได้สะดวก",
  keywords: ["พร้อมฉีด", "Prom Chid", "วัคซีนเด็ก", "นัดหมายวัคซีน", "แจ้งเตือนวัคซีน"],
  verification: {
    google: "DA03QkBA3A2V76dR_KEcIz3vQFpD3LNHvPoDVT1QFHg",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}