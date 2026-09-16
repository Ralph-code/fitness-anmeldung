"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Check, CircleCheck, Utensils } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import { MEAL_KEYS, MEAL_TIMES, attendanceOf } from "@/lib/meals";
import type { MealKey } from "@/lib/content";
import type { Meal, MealAttendance, StudentRecord } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, LABEL, SectionTitle } from "@/components/ui";

const DAYS = 14;

type PlanValues = { lunch: string; dinner: string; note: string };

/** Für Admins: Essensplan eintragen und Anwesenheit kontrollieren – auf einer Seite */
export default function AdminEssenView() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [meals, setMeals] = useState<Record<string, Meal>>({});
  const [entries, setEntries] = useState<Record<string, MealAttendance>>({});
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [date, setDate] = useState(zonedNow().date);
  const [meal, setMeal] = useState<MealKey>("lunch");
  const [draft, setDraft] = useState<{ date: string; values: PlanValues } | null>(null);
  const [search, setSearch] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const today = zonedNow().date;
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(
      query(collection(db, "meals"), where("date", ">=", today), orderBy("date"), limit(30)),
      (snap) => {
        const byDate: Record<string, Meal> = {};
        snap.docs.forEach((d) => (byDate[d.id] = d.data() as Meal));
        setMeals(byDate);
      },
      (err) => console.warn("Essensplan:", err.message)
    );
  }, [isAdmin, today]);

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(
      query(collection(db, "mealAttendance"), where("date", "==", date)),
      (snap) => {
        const byUid: Record<string, MealAttendance> = {};
        snap.docs.forEach((d) => {
          const entry = d.data() as MealAttendance;
          byUid[entry.uid] = entry;
        });
        setEntries(byUid);
        setBlocked(false);
      },
      (err) => {
        console.warn("Anwesenheit:", err.message);
        setBlocked(err.code === "permission-denied");
      }
    );
  }, [isAdmin, date]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    apiFetch<{ students: StudentRecord[] }>("/api/admin/students").then(
      (data) => active && setStudents(data.students),
      (e: Error) => active && showFeedback(e.message, "error")
    );
    return () => { active = false; };
  }, [isAdmin, showFeedback]);

  const saved = {
    lunch: meals[date]?.lunch ?? "",
    dinner: meals[date]?.dinner ?? "",
    note: meals[date]?.note ?? "",
  };
  const values = draft?.date === date ? draft.values : saved;
  const isDirty = JSON.stringify(values) !== JSON.stringify(saved);
  const setValues = (next: PlanValues) => setDraft({ date, values: next });

  const savePlan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/meals", { method: "PUT", body: { date, ...values } });
      setDraft(null);
      showFeedback("Plan gespeichert");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const updateAttendance = async (uid: string, changes: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    const previous = entries[uid];
    // Sofort anzeigen, der Server bestätigt im Hintergrund
    setEntries((prev) => ({ ...prev, [uid]: { ...(previous ?? { uid, date }), ...changes } as MealAttendance }));
    try {
      await apiFetch("/api/admin/attendance", { method: "PATCH", body: { uid, date, ...changes } });
    } catch (e) {
      setEntries((prev) => {
        const next = { ...prev };
        if (previous) next[uid] = previous;
        else delete next[uid];
        return next;
      });
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const term = search.trim().toLowerCase();
  const list = (students ?? []).filter((s) => !term || [s.name, s.room, s.school].some((v) => v?.toLowerCase().includes(term)));
  const total = students?.length ?? 0;
  const out = (students ?? []).filter((s) => attendanceOf(entries[s.uid], meal) === "out").length;
  const checkedKey = `${meal}Checked` as "lunchChecked" | "dinnerChecked";
  const missing = (students ?? []).filter((s) => entries[s.uid]?.[checkedKey] === "missing").length;

  return (
    <AppShell title="Essen" subtitle="Plan eintragen und Anwesenheit kontrollieren">
      {/* Tage */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 -mx-1 px-1">
        {days.map((d) => {
          const filled = !!(meals[d]?.lunch || meals[d]?.dinner);
          const active = d === date;
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`shrink-0 w-16 py-3 rounded-2xl border transition-all ${
                active ? "border-[var(--accent)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)]"
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-widest">{formatDate(d, { weekday: "short" })}</span>
              <span className="block text-lg font-black italic tracking-tight">{d.slice(8)}</span>
              {filled ? <Check size={12} className="mx-auto text-[var(--accent-text)]" /> : <span className="block h-3" />}
            </button>
          );
        })}
      </div>

      {/* Essensplan */}
      <SectionTitle title="Essensplan" icon={<Utensils size={14} />} />
      <div className={`${CARD} mb-8`}>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-text)] mb-4">
          {date === today ? "Heute" : formatDate(date, { weekday: "long" })} · {formatDate(date, { day: "2-digit", month: "long" })}
        </p>
        <div className="space-y-4">
          <div>
            <span className={LABEL}>Mittagessen <span className="text-[var(--text-faint)]">{MEAL_TIMES.lunch.start}–{MEAL_TIMES.lunch.end}</span></span>
            <textarea className={`${INPUT} resize-y`} rows={3} value={values.lunch} onChange={(e) => setValues({ ...values, lunch: e.target.value })} placeholder={"z.B. Gemüsesuppe\nSpaghetti Bolognese"} maxLength={600} />
          </div>
          <div>
            <span className={LABEL}>Abendessen <span className="text-[var(--text-faint)]">{MEAL_TIMES.dinner.start}–{MEAL_TIMES.dinner.end}</span></span>
            <textarea className={`${INPUT} resize-y`} rows={3} value={values.dinner} onChange={(e) => setValues({ ...values, dinner: e.target.value })} placeholder="z.B. Aufschnitt, Käse, Brot" maxLength={600} />
          </div>
          <div>
            <span className={LABEL}>Notiz (optional)</span>
            <input className={INPUT} value={values.note} onChange={(e) => setValues({ ...values, note: e.target.value })} placeholder="z.B. vegetarische Alternative auf Anfrage" maxLength={300} />
          </div>
          <p className={HINT}>Leere Felder löschen den Eintrag für diesen Tag.</p>
          <div className="flex gap-3">
            <button onClick={() => setDraft(null)} disabled={!isDirty || busy} className={`${BTN_GHOST} flex-1`}>Zurücksetzen</button>
            <button onClick={savePlan} disabled={!isDirty || busy} className={`${BTN_PRIMARY} flex-[1.6]`}>{busy ? "Speichert..." : "Speichern"}</button>
          </div>
        </div>
      </div>

      {/* Anwesenheit */}
      <SectionTitle title="Anwesenheit" icon={<CircleCheck size={14} />} />
      {blocked && (
        <div className={`${CARD} mb-4 border-[var(--danger-border)] bg-[var(--danger-soft)]`}>
          <p className="text-sm text-[var(--text)] leading-relaxed">
            Die Anwesenheit kann nicht gelesen werden. Bitte die Firestore-Regeln aus <code>firestore.rules</code> in der Firebase Console veröffentlichen.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {MEAL_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setMeal(key)}
            className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              meal === key ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
            }`}
          >
            {MEAL_TIMES[key].label}
            <span className="block text-[9px] text-[var(--text-faint)] mt-1">{MEAL_TIMES[key].start}–{MEAL_TIMES[key].end}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className={`${CARD} text-center`}>
          <span className="text-3xl font-black italic tracking-tighter block text-[var(--accent-text)]">{total - out}</span>
          <span className="text-[var(--text-dim)] text-[9px] font-black uppercase tracking-[0.2em]">Essen mit</span>
        </div>
        <div className={`${CARD} text-center`}>
          <span className="text-3xl font-black italic tracking-tighter block">{out}</span>
          <span className="text-[var(--text-dim)] text-[9px] font-black uppercase tracking-[0.2em]">Abgemeldet</span>
        </div>
        <div className={`${CARD} text-center ${missing ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : ""}`}>
          <span className={`text-3xl font-black italic tracking-tighter block ${missing ? "text-red-500" : ""}`}>{missing}</span>
          <span className="text-[var(--text-dim)] text-[9px] font-black uppercase tracking-[0.2em]">Gefehlt</span>
        </div>
      </div>

      <input className={`${INPUT} mb-4`} placeholder="Suche: Name, Zimmer, Schule" value={search} onChange={(e) => setSearch(e.target.value)} />

      {students === null ? (
        <EmptyState>Lädt...</EmptyState>
      ) : list.length === 0 ? (
        <div className={CARD}><EmptyState>Keine Studenten</EmptyState></div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const entry = entries[s.uid];
            const status = attendanceOf(entry, meal);
            const checked = entry?.[checkedKey] ?? null;
            const acknowledged = !!entry?.[`${meal}AckAt` as "lunchAckAt" | "dinnerAckAt"];
            return (
              <div key={s.uid} className={`p-4 rounded-2xl border transition-all ${
                status === "out" ? "border-[var(--border-soft)] bg-[var(--surface-soft)] opacity-70" : checked === "missing" ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : "border-[var(--border-soft)] bg-[var(--surface-soft)]"
              }`}>
                <div className="min-w-0 mb-3">
                  <span className="font-bold text-[var(--text)] block truncate">{s.name ?? s.username}</span>
                  <span className={HINT}>
                    Zimmer {s.room || "—"}
                    {status === "out" && entry?.reason ? ` · ${entry.reason}` : ""}
                    {checked === "missing" ? (acknowledged ? " · Meldung gelesen" : " · Meldung offen") : ""}
                  </span>
                </div>

                <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2">Angemeldet?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAttendance(s.uid, { [meal]: "in" })}
                    className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      status === "in" ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    Dabei
                  </button>
                  <button
                    onClick={() => updateAttendance(s.uid, { [meal]: "out" })}
                    className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      status === "out" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    Abgemeldet
                  </button>
                </div>

                <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mt-4 mb-2">Kontrolle</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAttendance(s.uid, { [checkedKey]: checked === "present" ? null : "present" })}
                    className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      checked === "present" ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    War da
                  </button>
                  <button
                    onClick={() => updateAttendance(s.uid, { [checkedKey]: checked === "missing" ? null : "missing" })}
                    className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      checked === "missing" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    Gefehlt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className={`${HINT} text-center mt-6`}>
        Wer als „gefehlt“ markiert wird, obwohl er angemeldet war, muss die Meldung in der App bestätigen.
      </p>

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
