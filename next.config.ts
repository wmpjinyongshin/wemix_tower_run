import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Cloudflare Pages 정적 배포: out/ 로 정적 export
  output: "export",
  images: { unoptimized: true },
  // 상위 폴더의 lockfile로 인한 워크스페이스 루트 오탐 방지
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
