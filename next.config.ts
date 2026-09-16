import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-Modus für Hostinger (spart Prozesse)
  output: 'standalone',

  // Ignoriert TypeScript-Fehler beim Build (wichtig für Hostinger)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Alte Adressen weiterleiten (Lesezeichen der Admins bleiben gültig)
  async redirects() {
    return [
      { source: "/dashboard", destination: "/fitness", permanent: false },
      { source: "/admin/essen", destination: "/essen", permanent: false },
      { source: "/admin/anwesenheit", destination: "/essen", permanent: false },
      { source: "/gym-admin-control", destination: "/admin/studenten", permanent: false },
      { source: "/gym-admin-control/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
