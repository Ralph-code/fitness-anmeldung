"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, HelpCircle, Languages, LogOut, Moon, Palette, ShieldCheck, Sparkles, Sun, User } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { ADULT_AGE, ageOn, formatDate, zonedNow } from "@/lib/schedule";
import { LANGUAGES } from "@/lib/i18n";
import AppShell from "@/components/AppShell";
import PasswordCard from "@/components/PasswordCard";
import StatusBadges from "@/components/StatusBadges";
import { Toast, useToast } from "@/components/Toast";
import Tour from "@/components/Tour";
import { BTN_OUTLINE, CARD, DataRow, HINT, LABEL, SectionTitle } from "@/components/ui";

export default function ProfilPage() {
  const { user } = useAuth();
  const { t, locale, theme, setTheme, language, setLanguage } = useSettings();
  const router = useRouter();
  const { toast, showToast } = useToast();

  if (!user) return null;

  const showToursAgain = async () => {
    try {
      await apiFetch("/api/profile", { method: "PATCH", body: { action: "resetTours" } });
      router.push("/fitness");
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const today = zonedNow().date;
  const age = ageOn(user, today);
  const permissions = [
    { icon: CircleCheck, label: t("profile.fitnessAge", { age: ADULT_AGE }), ok: age !== null && age >= ADULT_AGE, hint: age !== null ? t("profile.years", { age }) : t("profile.noBirthday") },
    { icon: Sparkles, label: t("profile.approvedSlots"), ok: user.approved === true, hint: user.approved ? t("profile.approved") : t("profile.notApproved") },
  ];

  const toggleClass = (active: boolean) =>
    `flex-1 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
      active ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
    }`;

  return (
    <AppShell
      title={t("profile.title")}
      subtitle={<>{user.name}{user.room ? ` · ${t("profile.room", { room: user.room })}` : ""}</>}
      action={
        <button
          data-tour="profile-logout"
          onClick={async () => { await auth.signOut(); router.replace("/"); }}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] active:text-[var(--text)] transition-all"
          aria-label={t("profile.logout")}
        >
          <LogOut size={17} />
        </button>
      }
    >
      {!user.isAdmin && (
        <div className="mb-6">
          <StatusBadges profile={user} date={today} />
        </div>
      )}

      {/* Darstellung */}
      <SectionTitle title={t("profile.appearance")} icon={<Palette size={14} />} />
      <div className={`${CARD} mb-6`}>
        <span className={LABEL}>{t("profile.theme")}</span>
        <div className="flex gap-3 mb-6" data-tour="profile-theme">
          <button onClick={() => setTheme("dark")} className={toggleClass(theme === "dark")}>
            <Moon size={14} /> {t("profile.themeDark")}
          </button>
          <button onClick={() => setTheme("light")} className={toggleClass(theme === "light")}>
            <Sun size={14} /> {t("profile.themeLight")}
          </button>
        </div>

        <span className={LABEL}>
          <span className="inline-flex items-center gap-2"><Languages size={12} /> {t("profile.language")}</span>
        </span>
        <div className="flex gap-3" data-tour="profile-language">
          {LANGUAGES.map((l) => (
            <button key={l.value} onClick={() => setLanguage(l.value)} className={toggleClass(language === l.value)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meine Daten */}
      <SectionTitle title={t("profile.myData")} icon={<User size={14} />} />
      <div className={`${CARD} mb-6`}>
        <DataRow label={t("profile.name")} value={user.name} />
        <DataRow label={t("profile.username")} value={user.username} />
        {!user.isAdmin && (
          <>
            <DataRow label={t("profile.roomLabel")} value={user.room || "—"} />
            <DataRow label={t("profile.birthday")} value={user.birthDate ? formatDate(user.birthDate, { day: "2-digit", month: "long", year: "numeric" }, locale) : "—"} />
          </>
        )}
      </div>
      {!user.isAdmin && <p className={`${HINT} px-2 -mt-4 mb-6`}>{t("profile.dataHint")}</p>}

      {/* Erlaubnisse – nur für Studenten */}
      {!user.isAdmin && (
        <>
          <SectionTitle title={t("profile.permissions")} icon={<ShieldCheck size={14} />} />
          <div className={`${CARD} mb-6 space-y-3`}>
            {permissions.map(({ icon: Icon, label, ok, hint }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={16} className={ok ? "text-[var(--accent-text)] shrink-0" : "text-[var(--text-faint)] shrink-0"} />
                  <span className="text-sm text-[var(--text)] truncate">{label}</span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${ok ? "text-[var(--accent-text)]" : "text-[var(--text-faint)]"}`}>{hint}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Passwort */}
      <div className="mb-6" data-tour="profile-password">
        <PasswordCard onDone={showToast} />
      </div>

      {/* Hilfe */}
      <div className={`${CARD} mb-6`} data-tour="profile-tours">
        <span className={LABEL}>{t("profile.help")}</span>
        <button onClick={showToursAgain} className={`${BTN_OUTLINE} w-full flex items-center justify-center gap-2`}>
          <HelpCircle size={14} /> {t("profile.showTours")}
        </button>
      </div>

      <Toast toast={toast} position="bottom-28" />
      <Tour id="profile" />
    </AppShell>
  );
}
