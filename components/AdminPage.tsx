"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { Loading } from "@/components/ui";

/** Rahmen der Verwaltungs-Unterseiten: Zugriffsschutz, Zurück-Link, Überschrift */
export default function AdminPage({
  title,
  subtitle,
  children,
  superAdminOnly = false,
  ready = true,
  className = "pb-24",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  superAdminOnly?: boolean;
  /** false, solange die Seite noch Daten lädt */
  ready?: boolean;
  /** Abstand unten, z.B. für eine feste Aktionsleiste */
  className?: string;
}) {
  const { user, loading } = useAuth();
  const { t } = useSettings();
  const router = useRouter();
  const allowed = !!user && (superAdminOnly ? user.isSuperAdmin : user.isAdmin);

  useEffect(() => {
    if (loading || allowed) return;
    router.replace(!user ? "/" : user.isAdmin ? "/admin" : "/fitness");
  }, [loading, allowed, user, router]);

  if (loading || !allowed || !ready) return <Loading text={t("app.loading")} />;

  return (
    <div className={`min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 ${className} font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]`}>
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link
          href="/admin"
          className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={14} /> {t("nav.admin")}
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">{title}</h1>
        {subtitle && <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-8">{subtitle}</p>}

        {children}
      </div>
    </div>
  );
}
