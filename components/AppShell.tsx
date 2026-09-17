"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dumbbell, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { Loading } from "@/components/ui";

const STUDENT_NAV = [
  { href: "/fitness", key: "nav.fitness", icon: Dumbbell },
  { href: "/profil", key: "nav.profile", icon: User },
] as const;

const ADMIN_NAV = [
  { href: "/fitness", key: "nav.fitness", icon: Dumbbell },
  { href: "/admin", key: "nav.admin", icon: ShieldCheck },
  { href: "/profil", key: "nav.profile", icon: User },
] as const;

/** Rahmen für alle eingeloggten Seiten: Kopfzeile, Navigation unten, Zugriffsschutz */
export default function AppShell({
  title,
  subtitle,
  action,
  children,
  adminOnly = false,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  const { t } = useSettings();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (adminOnly && !user.isAdmin) router.replace("/fitness");
  }, [user, loading, adminOnly, router]);

  if (loading || !user || (adminOnly && !user.isAdmin)) return <Loading text={t("app.loading")} />;

  const items = user.isAdmin ? ADMIN_NAV : STUDENT_NAV;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-28 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[var(--accent-text)] text-[10px] font-black uppercase tracking-[0.4em]">{t("app.brand")}</p>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter mt-1 break-words">{title}</h1>
            {subtitle && <div className="text-[var(--text-dim)] text-xs mt-2 leading-relaxed">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {action}
          </div>
        </header>
        {children}
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-[400] bg-[var(--overlay)] backdrop-blur-xl border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex">
          {items.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                data-tour={key.replace(".", "-")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 transition-colors ${active ? "text-[var(--accent-text)]" : "text-[var(--text-faint)] active:text-[var(--text-muted)]"}`}
              >
                <Icon size={20} strokeWidth={active ? 2.6 : 2} />
                <span className="text-[9px] font-black uppercase tracking-widest">{t(key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
