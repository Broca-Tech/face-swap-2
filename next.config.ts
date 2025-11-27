import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disabled to prevent double-init of Agora in dev
};

export default nextConfig;
