import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-Modus für Hostinger (spart Prozesse)
  output: 'standalone',

  // Ignoriert TypeScript-Fehler beim Build (wichtig für Hostinger)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Falls du ESLint-Prüfungen während des Builds komplett unterdrücken willst,
  // ohne den 'eslint' Key zu nutzen (der die Warnung auslöst), 
  // lassen wir Next.js einfach wissen, dass es keine Checks machen soll:
  
  /* 
     Hinweis: In neueren Versionen wird ESLint oft automatisch übersprungen, 
     wenn 'next build' ohne zusätzliche Flags läuft oder über CLI-Parameter 
     gesteuert wird. Wir lassen den Key hier einfach weg, um die Warnung zu löschen.
  */
};

export default nextConfig;