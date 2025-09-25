// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // (mantenha seu images.remotePatterns aqui, se já existir)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '<sua-instancia>.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  eslint: {
    // NÃO falhar o build por erros de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // (opcional) NÃO falhar o build por erros de TypeScript
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
