import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-Modus für Hostinger (spart Prozesse)
  output: "standalone",

  // Alte Adressen weiterleiten (Lesezeichen bleiben gültig)
  async redirects() {
    return [
      { source: "/dashboard", destination: "/fitness", permanent: false },
      { source: "/start", destination: "/fitness", permanent: false },
      { source: "/essen", destination: "/fitness", permanent: false },
      { source: "/studierzeit", destination: "/fitness", permanent: false },
      { source: "/kalender", destination: "/fitness", permanent: false },
      { source: "/gym-admin-control", destination: "/admin/studenten", permanent: false },
      { source: "/gym-admin-control/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
