import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트(설치형 웹앱). app/manifest.ts 는 Next.js App Router 가
 * /manifest.webmanifest 로 자동 노출하고 <link rel="manifest"> 도 자동 주입한다.
 *   - name/short_name/색상은 사용자가 확정한 값.
 *   - 아이콘: 192/512(any) + 512-maskable(maskable).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "보험광고 법령 검증",
    short_name: "법령검증",
    description: "보험광고 콘텐츠의 법령 위반 여부를 검증하고 법령 준수 콘텐츠를 생성하는 웹앱",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFDFE",
    theme_color: "#515C9E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
