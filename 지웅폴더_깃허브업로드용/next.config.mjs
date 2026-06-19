import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 상위 디렉터리(사용자 홈)에 다른 lockfile이 있어 Next가 워크스페이스 루트를
  // 잘못 추론하는 것을 방지한다. 이 프로젝트 디렉터리를 루트로 고정한다.
  outputFileTracingRoot: __dirname,
  // 서버 전용 비밀키가 클라이언트 번들에 포함되지 않도록 별도 노출 설정을 두지 않는다.
  // 공개 가능한 값만 NEXT_PUBLIC_ 접두어로 클라이언트에 전달된다.
  experimental: {
    serverActions: {
      // 영상 등 대용량 파일은 Cloud Storage로 직접 업로드하므로 Server Action 본문은 작게 유지한다.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
