"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import { DEFAULT_OPENING, WEEKDAYS, dayStatus, describeDay, normalizeOpening, type CalendarEntry, type Opening } from "@/lib/opening";
import { Badge, BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, LABEL, Loading } from "@/components/ui";

const EMPTY_ENTRY = { closed: false, schoolFree: false, openTime: "", closeTime: "", label: "", note: "" };

type EntryValues = typeof EMPTY_ENTRY;

/** Gleichartige, aufeinanderfolgende Tage zu einem Zeitraum zusammenfassen */
function groupEntries(entries: CalendarEntry[]) {
  const key = (e: CalendarEntry) =>
    JSON.stringify([e.closed ?? false, e.schoolFree ?? false, e.openTime ?? "", e.closeTime ?? "", e.label ?? "", e.note ?? ""]);

  const groups: { from: string; to: string; entry: CalendarEntry }[] = [];
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const last = groups[groups.length - 1];
    if (last && key(last.entry) === key(entry) && addDays(last.to, 1) === entry.date) last.to = entry.date;
    else groups.push({ from: entry.date, to: entry.date, entry });
  }
  return groups;
}

export default function AdminCalendar() {
  const { user, loading } = useAuth();
  const [opening, setOpening] = useState<Opening>(DEFAULT_OPENING);
  const [draftOpening, setDraftOpening] = useState<Opening | null>(null);
  const [entries, setEntries] = useState<Record<string, CalendarEntry>>({});
  const [range, setRange] = useState({ from: zonedNow().date, to: zonedNow().date });
  const [values, setValues] = useState<EntryValues>(EMPTY_ENTRY);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const today = zonedNow().date;

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    return onSnapshot(doc(db, "settings", "opening"), (snap) => setOpening(snap.exists() ? normalizeOpening(snap.data()) : DEFAULT_OPENING));
  }, [user?.isAdmin]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    return onSnapshot(
      query(collection(db, "calendar"), where("date", ">=", addDays(today, -7))),
      (snap) => {
        const byDate: Record<string, CalendarEntry> = {};
        snap.docs.forEach((d) => (byDate[d.id] = d.data() as CalendarEntry));
        setEntries(byDate);
      },
      (err) => console.warn("Kalender:", err.message)
    );
  }, [user?.isAdmin, today]);

  if (loading || !user?.isAdmin) return <Loading text="Admin Check..." />;

  const current = draftOpening ?? opening;
  const openingDirty = JSON.stringify(current) !== JSON.stringify(opening);
  const rangeInvalid = range.to < range.from;
  const dayCount = rangeInvalid ? 0 : Math.round((Date.parse(`${range.to}T12:00:00Z`) - Date.parse(`${range.from}T12:00:00Z`)) / 86400000) + 1;

  const edit = (from: string, to: string, entry?: CalendarEntry) => {
    setRange({ from, to });
    setValues(
      entry
        ? {
            closed: entry.closed === true,
            schoolFree: entry.schoolFree === true,
            openTime: entry.openTime ?? "",
            closeTime: entry.closeTime ?? "",
            label: entry.label ?? "",
            note: entry.note ?? "",
          }
        : EMPTY_ENTRY
    );
  };

  const pickFrom = (from: string) => {
    const to = range.to < from ? from : range.to;
    setRange({ from, to });
    const existing = entries[from];
    if (existing && from === to) edit(from, to, existing);
  };

  const saveOpening = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/opening", { method: "PUT", body: current });
      setDraftOpening(null);
      showFeedback("Öffnungszeiten gespeichert");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async (entryValues = values, from = range.from, to = range.to) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ deleted?: boolean; days: number }>("/api/admin/calendar", {
        method: "PUT",
        body: { date: from, dateTo: to, ...entryValues },
      });
      showFeedback(res.deleted ? `${res.days} Tage entfernt` : `${res.days} ${res.days === 1 ? "Tag" : "Tage"} gespeichert`);
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const groups = groupEntries(Object.values(entries));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-24 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Kalender</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-8">Öffnungszeiten & schulfreie Tage</p>

        {/* Wöchentliche Öffnungszeiten */}
        <div className={`${CARD} mb-6`}>
          <span className={LABEL}>Wöchentliche Öffnung</span>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-1">Öffnet</span>
              <select
                value={current.openDay}
                onChange={(e) => setDraftOpening({ ...current, openDay: Number(e.target.value) })}
                className={`${INPUT} mb-2`}
              >
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <input type="time" value={current.openTime} onChange={(e) => setDraftOpening({ ...current, openTime: e.target.value })} className={INPUT} />
            </label>
            <label className="block">
              <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-1">Schließt</span>
              <select
                value={current.closeDay}
                onChange={(e) => setDraftOpening({ ...current, closeDay: Number(e.target.value) })}
                className={`${INPUT} mb-2`}
              >
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <input type="time" value={current.closeTime} onChange={(e) => setDraftOpening({ ...current, closeTime: e.target.value })} className={INPUT} />
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setDraftOpening(null)} disabled={!openingDirty || busy} className={`${BTN_GHOST} flex-1`}>Verwerfen</button>
            <button onClick={saveOpening} disabled={!openingDirty || busy} className={`${BTN_PRIMARY} flex-[1.6]`}>Speichern</button>
          </div>
        </div>

        {/* Ausnahme für einen Zeitraum */}
        <div className={`${CARD} mb-6`}>
          <span className={LABEL}>Ausnahme eintragen</span>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <label className="block">
              <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-1">Von</span>
              <input type="date" value={range.from} onChange={(e) => pickFrom(e.target.value)} className={INPUT} />
            </label>
            <label className="block">
              <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-1">Bis</span>
              <input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className={INPUT} />
            </label>
          </div>
          <p className={`${HINT} mb-4`}>
            {rangeInvalid
              ? "Das Enddatum liegt vor dem Startdatum."
              : dayCount === 1
                ? "Gilt für einen Tag. Für mehrere Tage einfach ein Enddatum wählen."
                : `Gilt für ${dayCount} Tage (${formatDate(range.from, { day: "2-digit", month: "2-digit" })} – ${formatDate(range.to, { day: "2-digit", month: "2-digit" })}).`}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setValues({ ...values, closed: !values.closed })}
              className={`py-3.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${values.closed ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"}`}
            >
              Geschlossen
            </button>
            <button
              onClick={() => setValues({ ...values, schoolFree: !values.schoolFree })}
              className={`py-3.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${values.schoolFree ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-[var(--border)] text-[var(--text-dim)]"}`}
            >
              Schulfrei
            </button>
          </div>

          {!values.closed && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-1">Öffnet (optional)</span>
                <input type="time" value={values.openTime} onChange={(e) => setValues({ ...values, openTime: e.target.value })} className={INPUT} />
              </label>
              <label className="block">
                <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-1">Schließt (optional)</span>
                <input type="time" value={values.closeTime} onChange={(e) => setValues({ ...values, closeTime: e.target.value })} className={INPUT} />
              </label>
            </div>
          )}

          <input className={`${INPUT} mb-3`} placeholder="Bezeichnung, z.B. Weihnachtsferien" value={values.label} onChange={(e) => setValues({ ...values, label: e.target.value })} maxLength={60} />
          <input className={`${INPUT} mb-4`} placeholder="Notiz für die Schüler (optional)" value={values.note} onChange={(e) => setValues({ ...values, note: e.target.value })} maxLength={200} />

          <p className={`${HINT} mb-4`}>Alles leer lassen und speichern löscht die Einträge im gewählten Zeitraum.</p>
          <button onClick={() => saveEntry()} disabled={busy || rangeInvalid} className={`${BTN_PRIMARY} w-full`}>
            {busy ? "Speichert..." : dayCount > 1 ? `${dayCount} Tage speichern` : "Eintrag speichern"}
          </button>
        </div>

        {/* Bestehende Einträge */}
        <span className={`${LABEL} px-1`}>Einträge</span>
        {groups.length === 0 ? (
          <div className={CARD}><EmptyState>Noch keine Ausnahmen eingetragen.</EmptyState></div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const status = dayStatus(group.from, opening, group.entry);
              const days = Math.round((Date.parse(`${group.to}T12:00:00Z`) - Date.parse(`${group.from}T12:00:00Z`)) / 86400000) + 1;
              return (
                <div key={group.from} className={`${CARD} flex items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text)] truncate">{group.entry.label || describeDay(status)}</p>
                    <p className={HINT}>
                      {days === 1
                        ? formatDate(group.from, { weekday: "short", day: "2-digit", month: "long", year: "numeric" })
                        : `${formatDate(group.from, { day: "2-digit", month: "long" })} – ${formatDate(group.to, { day: "2-digit", month: "long", year: "numeric" })} · ${days} Tage`}
                      {group.entry.note ? ` · ${group.entry.note}` : ""}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      {group.entry.schoolFree && <Badge tone="amber">Schulfrei</Badge>}
                      <Badge tone={status.state === "closed" ? "red" : "lime"}>{describeDay(status)}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => edit(group.from, group.to, group.entry)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest active:scale-95">
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => saveEntry(EMPTY_ENTRY, group.from, group.to)}
                      className="px-3 py-2 rounded-full border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest active:scale-95"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === "success" ? "bg-[var(--bg)] border-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg)] border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}
