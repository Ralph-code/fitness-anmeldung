"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { BookOpen, Cigarette, CircleCheck, KeyRound, Languages, LogOut, Moon, Palette, School, Sparkles, Sun, TriangleAlert, User } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { ADULT_AGE, ageOn, formatDate, zonedNow } from "@/lib/schedule";
import { NIGHT_KEY_MIN_AGE } from "@/lib/content";
import { LANGUAGES } from "@/lib/i18n";
import { DEFAULT_PRESENCE, PRESENCE_LABELS, PRESENCE_LABELS_IT, presenceTone, type PresenceStatus } from "@/lib/presence";
import type { Note, Presence } from "@/lib/types";
import AppShell from "@/components/AppShell";
import PasswordCard from "@/components/PasswordCard";
import StatusBadges from "@/components/StatusBadges";
import Tutorial from "@/components/Tutorial";
import { BTN_OUTLINE, CARD, DataRow, EmptyState, HINT, LABEL, SectionTitle } from "@/components/ui";

export default function ProfilPage() {
  const { user } = useAuth();
  const { t, locale, theme, setTheme, language, setLanguage } = useSettings();
  const router = useRouter();
  const uid = user?.uid;

  const [notes, setNotes] = useState<Note[] | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const today = zonedNow().date;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "notes"), where("uid", "==", uid)),
      (snap) => setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Note).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      (err) => { console.warn("Vermerke:", err.message); setNotes([]); }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "presence", `${today}_${uid}`),
      (snap) => setPresence(snap.exists() ? (snap.data() as Presence) : null),
      () => setPresence(null)
    );
  }, [uid, today]);

  if (!user) return null;

  const age = ageOn(user, today);
  const permissions = [
    { icon: CircleCheck, label: t("profile.fitnessAge", { age: ADULT_AGE }), ok: age !== null && age >= ADULT_AGE, hint: age !== null ? t("profile.years", { age }) : t("profile.noBirthday") },
    { icon: Sparkles, label: t("profile.approvedSlots"), ok: user.approved === true, hint: user.approved ? t("profile.approved") : t("profile.notApproved") },
    { icon: KeyRound, label: t("profile.nightKey"), ok: user.nightKey === true, hint: user.nightKey ? t("profile.nightKeyYes") : t("profile.nightKeyFrom", { age: NIGHT_KEY_MIN_AGE }) },
    { icon: Cigarette, label: t("profile.smoker"), ok: user.smoker === true, hint: user.smoker ? t("profile.smokerYes") : t("profile.smokerNo") },
    { icon: BookOpen, label: t("study.title"), ok: user.studyRequired !== false, hint: user.studyRequired !== false ? t("study.required") : t("study.optional") },
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
          onClick={async () => { await auth.signOut(); router.replace("/"); }}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] active:text-[var(--text)] transition-all"
          aria-label={t("profile.logout")}
        >
          <LogOut size={17} />
        </button>
      }
    >
      <div className="mb-6">
        <StatusBadges profile={user} date={today} />
      </div>

      {/* Status heute */}
      {!user.isAdmin && (
        <div className={`${CARD} mb-6`}>
          <span className={LABEL}>{t("presence.today")}</span>
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const status = ((presence?.status as PresenceStatus) ?? DEFAULT_PRESENCE) as PresenceStatus;
              const labels = language === "it" ? PRESENCE_LABELS_IT : PRESENCE_LABELS;
              const tone = presenceTone(status);
              return (
                <span
                  className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                    tone === "lime"
                      ? "border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent-text)]"
                      : tone === "red"
                        ? "border-red-500/40 bg-red-500/10 text-red-500"
                        : "border-[var(--border-strong)] text-[var(--text-muted)]"
                  }`}
                >
                  {labels[status]}
                </span>
              );
            })()}
            <span className="px-3 py-2 rounded-full border border-[var(--border)] text-[var(--text-dim)] text-[9px] font-black uppercase tracking-widest">
              {t("presence.roomCheck")}:{" "}
              {presence?.roomCheck === "present"
                ? t("presence.roomPresent")
                : presence?.roomCheck === "missing"
                  ? t("presence.roomMissing")
                  : t("presence.roomOpen")}
            </span>
          </div>
          {presence?.note && <p className={`${HINT} mt-3`}>{presence.note}</p>}
        </div>
      )}

      {/* Darstellung */}
      <SectionTitle title={t("profile.appearance")} icon={<Palette size={14} />} />
      <div className={`${CARD} mb-6`}>
        <span className={LABEL}>{t("profile.theme")}</span>
        <div className="flex gap-3 mb-6">
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
        <div className="flex gap-3">
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
        <DataRow label={t("profile.roomLabel")} value={user.room || "—"} />
        <DataRow label={t("profile.birthday")} value={user.birthDate ? formatDate(user.birthDate, { day: "2-digit", month: "long", year: "numeric" }, locale) : "—"} />
        <DataRow label={t("profile.school")} value={user.school || "—"} />
        <DataRow label={t("profile.class")} value={user.schoolClass || "—"} />
        <DataRow label={t("profile.diet")} value={user.dietary || t("profile.dietNone")} />
      </div>
      <p className={`${HINT} px-2 -mt-4 mb-6`}>{t("profile.dataHint")}</p>

      {/* Erlaubnisse – nur für Studenten */}
      {!user.isAdmin && (
      <>
      <SectionTitle title={t("profile.permissions")} icon={<School size={14} />} />
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

      {/* Vermerke */}
      <SectionTitle title={t("profile.notes")} icon={<TriangleAlert size={14} />} />
      <div className="mb-6">
        {notes === null ? (
          <EmptyState>{t("app.loading")}</EmptyState>
        ) : notes.length === 0 ? (
          <div className={CARD}><EmptyState>{t("profile.noNotes")}</EmptyState></div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className={`${CARD} ${note.type === "verweis" ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : note.type === "lob" ? "border-[var(--accent-30)] bg-[var(--accent-05)]" : ""}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${note.type === "verweis" ? "text-red-500" : note.type === "lob" ? "text-[var(--accent-text)]" : "text-[var(--text-dim)]"}`}>
                    {t(note.type === "verweis" ? "note.verweis" : note.type === "lob" ? "note.lob" : "note.notiz")}
                  </span>
                  <span className="text-[10px] text-[var(--text-faint)]">{formatDate(note.createdAt.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" }, locale)}</span>
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed">{note.text}</p>
                <p className={`${HINT} mt-2`}>{t("profile.noteBy", { name: note.authorName })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Passwort */}
      <div className="mb-6">
        <PasswordCard onDone={(text, type = "success") => { setStatusMsg({ text, type }); setTimeout(() => setStatusMsg(null), 3500); }} />
      </div>

      {/* Hilfe */}
      <div className={`${CARD} mb-4`}>
        <span className={LABEL}>{t("profile.help")}</span>
        <button onClick={() => setShowTutorial(true)} className={`${BTN_OUTLINE} w-full flex items-center justify-center gap-2`}>
          <BookOpen size={14} /> {t("profile.showTutorial")}
        </button>
      </div>

      {showTutorial && <Tutorial open onClose={() => setShowTutorial(false)} />}

      {statusMsg && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === "success" ? "bg-[var(--bg)] border-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg)] border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </AppShell>
  );
}
