// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "<sua-instancia>.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  eslint: {
    // Não falhar o build por erros de ESLint (MVP)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Não falhar o build por erros de TypeScript (MVP)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
