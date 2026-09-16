"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { BookOpen, Lock } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { useStudySchedule } from "@/lib/useStudySchedule";
import { canChooseStudy } from "@/lib/study";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import type { StudyBooking } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Badge, CARD, EmptyState, HINT, SectionTitle } from "@/components/ui";

const DAYS_AHEAD = 4;

export default function StudierzeitPage() {
  const { user } = useAuth();
  const { t, locale } = useSettings();
  const router = useRouter();
  const uid = user?.uid;
  const isAdmin = !!user?.isAdmin;
  const { schedule, ready } = useStudySchedule(!!uid);

  // Admins sind von der Studierzeit befreit – sie sehen die Kontrollliste
  useEffect(() => {
    if (isAdmin) router.replace("/admin/studierzeit");
  }, [isAdmin, router]);

  const [bookings, setBookings] = useState<Record<string, StudyBooking | null>>({});
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const now = zonedNow();
  const today = now.date;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const required = user?.studyRequired !== false;

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  useEffect(() => {
    if (!uid || isAdmin) return;
    const unsubs = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)).map((date) =>
      onSnapshot(
        doc(db, "studyBookings", `${date}_${uid}`),
        (snap) => setBookings((prev) => ({ ...prev, [date]: snap.exists() ? (snap.data() as StudyBooking) : null })),
        (err) => console.warn("Studierzeit:", err.message)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [uid, isAdmin, today]);

  const choose = async (date: string, slotId: string | null) => {
    if (busy) return;
    setBusy(true);
    const previous = bookings[date] ?? null;
    const slot = schedule.slots.find((s) => s.id === slotId);
    setBookings((prev) => ({
      ...prev,
      [date]: slotId && slot ? ({ uid: uid!, date, slotId: slot.id, slot: slot.label } as StudyBooking) : null,
    }));
    try {
      await apiFetch("/api/study/booking", { method: "POST", body: { date, slotId } });
      showFeedback(slotId ? t("study.saved") : t("study.removed"));
    } catch (e) {
      setBookings((prev) => ({ ...prev, [date]: previous }));
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title={t("study.title")} subtitle={t("study.subtitle")}>
      <div className={`${CARD} mb-6 ${required ? "border-[var(--accent-30)] bg-[var(--accent-05)]" : ""}`}>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={18} className="text-[var(--accent-text)] shrink-0" />
          <Badge tone={required ? "lime" : "zinc"}>{required ? t("study.required") : t("study.optional")}</Badge>
        </div>
        <p className={HINT}>{t("study.hint")}</p>
      </div>

      <SectionTitle title={t("study.title")} icon={<BookOpen size={14} />} />
      {!ready ? (
        <EmptyState>{t("app.loading")}</EmptyState>
      ) : schedule.slots.length === 0 ? (
        <div className={CARD}><EmptyState>{t("study.noSlots")}</EmptyState></div>
      ) : (
        <div className="space-y-3">
          {days.map((date) => {
            const booking = bookings[date] ?? null;
            const isToday = date === today;
            const missing = isToday && required && !booking;

            return (
              <div key={date} className={`${CARD} ${missing ? "border-[var(--danger-border)]" : isToday ? "border-[var(--accent-40)]" : ""}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isToday ? "text-[var(--accent-text)]" : "text-[var(--text-dim)]"}`}>
                    {isToday ? t("meals.today") : formatDate(date, { weekday: "long" }, locale)}
                  </span>
                  <span className="text-[10px] text-[var(--text-faint)]">{formatDate(date, { day: "2-digit", month: "2-digit" }, locale)}</span>
                </div>

                <div className="space-y-2">
                  {schedule.slots.map((slot) => {
                    const chosen = booking?.slotId === slot.id;
                    const open = canChooseStudy(date, slot.start, now);
                    const checked = chosen ? booking?.checked : null;
                    return (
                      <div
                        key={slot.id}
                        className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                          chosen ? "border-[var(--accent-40)] bg-[var(--accent-05)]" : "border-[var(--border-soft)]"
                        } ${!open && !chosen ? "opacity-50" : ""}`}
                      >
                        <div className="min-w-0">
                          <span className="text-lg font-black italic tracking-tight">{slot.label}</span>
                          {checked && (
                            <div className="mt-1">
                              <Badge tone={checked === "present" ? "lime" : "red"}>
                                {checked === "present" ? t("study.checkedPresent") : t("study.checkedMissing")}
                              </Badge>
                            </div>
                          )}
                        </div>
                        {chosen ? (
                          open ? (
                            <button
                              onClick={() => choose(date, null)}
                              disabled={busy}
                              className="shrink-0 px-4 py-2.5 rounded-full border border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent-text)] text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                            >
                              {t("study.chosen")}
                            </button>
                          ) : (
                            <span className="shrink-0 px-4 py-2.5 rounded-full border border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent-text)] text-[9px] font-black uppercase tracking-widest">
                              {t("study.chosen")}
                            </span>
                          )
                        ) : open ? (
                          <button
                            onClick={() => choose(date, slot.id)}
                            disabled={busy}
                            className="shrink-0 px-4 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                          >
                            {t("study.choose")}
                          </button>
                        ) : (
                          <span className="shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">
                            <Lock size={11} /> {t("study.started")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {missing && <p className="text-red-500 text-[11px] font-bold mt-3">{t("study.missingToday")}</p>}
              </div>
            );
          })}
        </div>
      )}

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
