import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

// Konfiguration der modernen Inter-Schriftart
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness Heim | Anmeldung",
  description: "Modernes Buchungssystem für das Fitness Heim",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="bg-black">
      <body className={`${inter.className} antialiased bg-black text-white`}>
        {/* 
            Der AuthProvider umschließt die gesamte App. 
            Dadurch können alle Komponenten (wie dein Dashboard) 
            auf den eingeloggten User zugreifen.
        */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}