import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },     // <- NÃO bloquear build por ESLint
  typescript: { ignoreBuildErrors: true },  // <- (opcional) NÃO bloquear por TS
};

export default nextConfig;
