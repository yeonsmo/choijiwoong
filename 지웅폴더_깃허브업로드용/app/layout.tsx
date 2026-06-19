import type { Metadata, Viewport } from "next";
import "./globals.css";
import LiquidBackground from "@/app/_components/LiquidBackground";
import UpdateLawPopup from "@/app/_components/UpdateLawPopup";

export const metadata: Metadata = {
  title: "보험광고 법령 검증",
  description:
    "보험광고 콘텐츠의 법령 위반 여부를 검증하고 법령 준수 콘텐츠를 생성하는 웹앱",
  // iOS 홈 화면 설치용 아이콘(apple-touch-icon). 파비콘은 app/icon.png 가 자동 처리.
  icons: {
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "법령검증",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#515C9E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <LiquidBackground />
        <div className="app-content">{children}</div>
        <UpdateLawPopup />
      </body>
    </html>
  );
}
