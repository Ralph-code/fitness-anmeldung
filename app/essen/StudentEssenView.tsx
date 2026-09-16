"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Clock, Lock, Utensils } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import { MEAL_KEYS, MEAL_TIMES, SIGNOFF_DEADLINE, attendanceOf, canChangeAttendance, signoffDeadlineDate } from "@/lib/meals";
import { SIGNOFF_REASONS, type MealKey } from "@/lib/content";
import type { Meal, MealAttendance } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { ModalShell } from "@/components/ConfirmModal";
import { Badge, BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, SectionTitle } from "@/components/ui";

const DAYS_AHEAD = 7;

type SignOff = { date: string; meals: MealKey[] };

export default function StudentEssenView() {
  const { user } = useAuth();
  const { t, locale } = useSettings();
  const uid = user?.uid;

  const [meals, setMeals] = useState<Record<string, Meal> | null>(null);
  const [attendance, setAttendance] = useState<Record<string, MealAttendance | null>>({});
  const [signOff, setSignOff] = useState<SignOff | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const today = zonedNow().date;
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)), [today]);
  const tomorrow = addDays(today, 1);
  const mealLabel = (key: MealKey) => t(key === "lunch" ? "meals.lunch" : "meals.dinner");

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "meals"), where("date", ">=", today), orderBy("date"), limit(14)),
      (snap) => {
        const byDate: Record<string, Meal> = {};
        snap.docs.forEach((d) => (byDate[d.id] = d.data() as Meal));
        setMeals(byDate);
      },
      (err) => { console.warn("Essensplan:", err.message); setMeals({}); }
    );
  }, [uid, today]);

  useEffect(() => {
    if (!uid) return;
    const unsubs = days.map((date) =>
      onSnapshot(
        doc(db, "mealAttendance", `${date}_${uid}`),
        (snap) => setAttendance((prev) => ({ ...prev, [date]: snap.exists() ? (snap.data() as MealAttendance) : null })),
        (err) => console.warn("Anwesenheit:", err.message)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [uid, days]);

  const save = async (date: string, changes: Record<string, unknown>, text: string) => {
    if (busy) return;
    setBusy(true);
    const previous = attendance[date] ?? null;
    setAttendance((prev) => ({ ...prev, [date]: { ...(previous ?? { uid: uid!, date }), ...changes } as MealAttendance }));
    try {
      await apiFetch("/api/meals/attendance", { method: "POST", body: { date, ...changes } });
      showFeedback(text);
    } catch (e) {
      setAttendance((prev) => ({ ...prev, [date]: previous }));
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOff = () => {
    if (!signOff) return;
    const changes: Record<string, unknown> = { reason: reason.trim() || null };
    signOff.meals.forEach((m) => (changes[m] = "out"));
    save(signOff.date, changes, signOff.meals.length > 1 ? t("meals.savedDayOut") : t("meals.savedOut"));
    setSignOff(null);
    setReason("");
  };

  const deadlineOpen = canChangeAttendance(tomorrow);

  return (
    <AppShell title={t("meals.title")} subtitle={t("meals.subtitle")}>
      {/* Essenszeiten */}
      <div className={`${CARD} mb-4`}>
        <div className="grid grid-cols-2 gap-4">
          {MEAL_KEYS.map((key) => (
            <div key={key}>
              <div className="flex items-center gap-2 text-[var(--accent-text)] mb-2">
                <Clock size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{mealLabel(key)}</span>
              </div>
              <p className="text-xl font-black italic tracking-tight">{MEAL_TIMES[key].start}–{MEAL_TIMES[key].end}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Frist-Hinweis */}
      <div className={`${CARD} mb-6 ${deadlineOpen ? "border-[var(--accent-40)] bg-[var(--accent-05)]" : ""}`}>
        <p className="text-sm text-[var(--text)] leading-relaxed">
          {deadlineOpen ? t("meals.deadlineOpen", { time: SIGNOFF_DEADLINE }) : t("meals.deadlineClosed")}
        </p>
        <p className={`${HINT} mt-1`}>{t("meals.autoIn")}</p>
      </div>

      <SectionTitle title={t("meals.planTitle")} icon={<Utensils size={14} />} />
      {meals === null ? (
        <EmptyState>{t("app.loading")}</EmptyState>
      ) : (
        <div className="space-y-3">
          {days.map((date) => {
            const meal = meals[date];
            const entry = attendance[date] ?? null;
            const isToday = date === today;
            const changeable = canChangeAttendance(date);
            const bothIn = MEAL_KEYS.every((m) => attendanceOf(entry, m) === "in");

            return (
              <div key={date} className={`${CARD} ${isToday ? "border-[var(--accent-40)]" : ""}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isToday ? "text-[var(--accent-text)]" : "text-[var(--text-dim)]"}`}>
                    {isToday ? t("meals.today") : formatDate(date, { weekday: "long" }, locale)}
                  </span>
                  <span className="text-[10px] text-[var(--text-faint)]">{formatDate(date, { day: "2-digit", month: "2-digit" }, locale)}</span>
                </div>

                <div className="space-y-4">
                  {MEAL_KEYS.map((key) => {
                    const status = attendanceOf(entry, key);
                    const text = key === "lunch" ? meal?.lunch : meal?.dinner;
                    const checked = key === "lunch" ? entry?.lunchChecked : entry?.dinnerChecked;
                    return (
                      <div key={key}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)]">{mealLabel(key)}</span>
                              {checked && (
                                <Badge tone={checked === "present" ? "lime" : "red"}>
                                  {checked === "present" ? t("meals.checkedPresent") : t("meals.checkedMissing")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-line">
                              {text || <span className="text-[var(--text-faint)]">{t("meals.notPlanned")}</span>}
                            </p>
                          </div>

                          <button
                            disabled={!changeable || busy}
                            onClick={() => {
                              if (status === "out") save(date, { [key]: "in" }, t("meals.savedIn"));
                              else { setSignOff({ date, meals: [key] }); setReason(""); }
                            }}
                            className={`shrink-0 px-4 py-2.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
                              status === "out"
                                ? "border-red-500/40 bg-red-500/10 text-red-500"
                                : "border-[var(--accent-40)] bg-[var(--accent-05)] text-[var(--accent-text)]"
                            } ${changeable ? "active:scale-95" : "opacity-60"}`}
                          >
                            {status === "out" ? t("meals.out") : t("meals.in")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {meal?.note && <p className={`${HINT} mt-3 italic`}>{meal.note}</p>}
                {entry?.reason && <p className={`${HINT} mt-3`}>{t("meals.reason", { reason: entry.reason })}</p>}

                <div className="mt-4 pt-4 border-t border-[var(--border-soft)] flex items-center justify-between gap-3">
                  {changeable ? (
                    bothIn ? (
                      <button
                        onClick={() => { setSignOff({ date, meals: [...MEAL_KEYS] }); setReason(""); }}
                        className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] active:text-[var(--text)]"
                      >
                        {t("meals.signOffDay")}
                      </button>
                    ) : (
                      <button
                        onClick={() => save(date, { lunch: "in", dinner: "in", reason: null }, t("meals.savedIn"))}
                        className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]"
                      >
                        {t("meals.signIn")}
                      </button>
                    )
                  ) : (
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-faint)]">
                      <Lock size={11} /> {t("meals.closed")}
                    </span>
                  )}
                  {changeable && (
                    <span className={HINT}>
                      {t("meals.until", {
                        date: formatDate(signoffDeadlineDate(date), { day: "2-digit", month: "2-digit" }, locale),
                        time: SIGNOFF_DEADLINE,
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Abmelde-Dialog */}
      {signOff && (
        <ModalShell tone="red">
          <h3 className="text-2xl font-black italic uppercase mb-2 tracking-tighter text-red-500">
            {signOff.meals.length > 1 ? t("meals.signOffDayTitle") : t("meals.signOffTitle", { meal: mealLabel(signOff.meals[0]) })}
          </h3>
          <p className="text-[var(--text-dim)] mb-6 text-[10px] uppercase tracking-widest">
            {formatDate(signOff.date, { weekday: "long", day: "2-digit", month: "long" }, locale)}
          </p>

          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {SIGNOFF_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r === "Anderes" ? "" : t(`reason.${r}` as const))}
                className={`px-3.5 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
                  reason === t(`reason.${r}` as const) ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"
                }`}
              >
                {t(`reason.${r}` as const)}
              </button>
            ))}
          </div>
          <input className={`${INPUT} mb-6`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("meals.reasonPlaceholder")} maxLength={120} />

          <div className="flex gap-3">
            <button onClick={() => setSignOff(null)} className={`${BTN_GHOST} flex-1`}>{t("meals.cancel")}</button>
            <button onClick={confirmSignOff} disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{t("meals.signOff")}</button>
          </div>
        </ModalShell>
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
