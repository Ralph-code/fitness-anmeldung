"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useStudySchedule } from "@/lib/useStudySchedule";
import { DEFAULT_STUDY, MAX_STUDY_SLOTS, validateStudySchedule, type StudySlot } from "@/lib/study";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import type { StudyBooking, StudentRecord } from "@/lib/types";
import { BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, Loading, SectionTitle } from "@/components/ui";

type Draft = { slots: { id: string; start: string; end: string }[] };

const toDraft = (slots: StudySlot[]): Draft => ({ slots: slots.map(({ id, start, end }) => ({ id, start, end })) });
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export default function AdminStudy() {
  const { user, loading } = useAuth();
  const { schedule, ready } = useStudySchedule(!!user?.isAdmin);

  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [bookings, setBookings] = useState<Record<string, StudyBooking>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [date, setDate] = useState(zonedNow().date);
  const [search, setSearch] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const today = zonedNow().date;

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    apiFetch<{ students: StudentRecord[] }>("/api/admin/students").then(
      (data) => active && setStudents(data.students),
      (e: Error) => active && showFeedback(e.message, "error")
    );
    return () => { active = false; };
  }, [user?.isAdmin, showFeedback]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    return onSnapshot(
      query(collection(db, "studyBookings"), where("date", "==", date)),
      (snap) => {
        const byUid: Record<string, StudyBooking> = {};
        snap.docs.forEach((d) => {
          const entry = d.data() as StudyBooking;
          byUid[entry.uid] = entry;
        });
        setBookings(byUid);
        setBlocked(false);
      },
      (err) => {
        console.warn("Studierzeiten:", err.message);
        setBlocked(err.code === "permission-denied");
      }
    );
  }, [user?.isAdmin, date]);

  if (loading || !user?.isAdmin || !ready) return <Loading text="Admin Check..." />;

  const saved = toDraft(schedule.slots);
  const current = draft ?? saved;
  const isDirty = JSON.stringify(current) !== JSON.stringify(saved);
  let error = "";
  try {
    validateStudySchedule(current);
  } catch (e) {
    error = (e as Error).message;
  }

  const saveSlots = async () => {
    if (busy || error) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/study", { method: "PUT", body: current });
      setDraft(null);
      showFeedback("Zeiten gespeichert");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const update = async (uid: string, changes: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    const previous = bookings[uid];
    // Sofort anzeigen, der Server bestätigt im Hintergrund
    setBookings((prev) => {
      const next = { ...prev };
      if (changes.slotId === null) delete next[uid];
      else next[uid] = { ...(previous ?? { uid, date, slotId: "", slot: "" }), ...changes } as StudyBooking;
      return next;
    });
    try {
      await apiFetch("/api/admin/study/attendance", { method: "PATCH", body: { uid, date, ...changes } });
    } catch (e) {
      setBookings((prev) => {
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
  const requiredStudents = (students ?? []).filter((s) => s.studyRequired !== false);
  const withoutEntry = requiredStudents.filter((s) => !bookings[s.uid]).length;
  const perSlot = schedule.slots.map((slot) => ({ slot, count: (students ?? []).filter((s) => bookings[s.uid]?.slotId === slot.id).length }));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-24 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Studierzeit</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-8">Zeiten & Anwesenheit</p>

        {/* Zeiten */}
        <SectionTitle title="Zeiten" icon={<BookOpen size={14} />} />
        <div className={`${CARD} mb-8`}>
          <div className="space-y-3">
            {current.slots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-2 sm:gap-3">
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => setDraft({ slots: current.slots.map((s) => (s.id === slot.id ? { ...s, start: e.target.value } : s)) })}
                  className={`${INPUT} text-lg font-black italic text-center`}
                />
                <span className="text-[var(--text-faint)] font-black">–</span>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => setDraft({ slots: current.slots.map((s) => (s.id === slot.id ? { ...s, end: e.target.value } : s)) })}
                  className={`${INPUT} text-lg font-black italic text-center`}
                />
                <button
                  onClick={() => setDraft({ slots: current.slots.filter((s) => s.id !== slot.id) })}
                  disabled={current.slots.length <= 1}
                  className="w-11 h-11 shrink-0 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black active:scale-90 transition-all disabled:opacity-30"
                  aria-label="Studierzeit entfernen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setDraft({ slots: [...current.slots, { id: newId(), start: "18:00", end: "19:00" }] })}
            disabled={current.slots.length >= MAX_STUDY_SLOTS}
            className="w-full mt-4 py-4 border border-dashed border-[var(--border)] rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-text)] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Studierzeit hinzufügen
          </button>

          {error && <p className="text-red-500 text-[11px] font-bold mt-3 px-1">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setDraft(null)} disabled={!isDirty || busy} className={`${BTN_GHOST} flex-1`}>Verwerfen</button>
            <button onClick={saveSlots} disabled={!isDirty || !!error || busy} className={`${BTN_PRIMARY} flex-[1.6]`}>
              {busy ? "Speichert..." : "Speichern"}
            </button>
          </div>
          <button onClick={() => setDraft(toDraft(DEFAULT_STUDY.slots))} className="w-full mt-3 py-3 text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">
            Standard wiederherstellen
          </button>
        </div>

        {/* Anwesenheit */}
        <SectionTitle title="Anwesenheit" icon={<BookOpen size={14} />} />
        {blocked && (
          <div className={`${CARD} mb-4 border-[var(--danger-border)] bg-[var(--danger-soft)]`}>
            <p className="text-sm text-[var(--text)] leading-relaxed">
              Die Einträge können nicht gelesen werden. Bitte die Firestore-Regeln aus <code>firestore.rules</code> in der Firebase Console veröffentlichen.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between mb-4 bg-[var(--surface)] border border-[var(--border)] p-2 rounded-2xl">
          <button onClick={() => setDate(addDays(date, -1))} className="w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl text-[var(--accent-text)] active:bg-[var(--surface-2)]">←</button>
          <div className="text-center">
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--accent-text)] block">{date === today ? "Heute" : formatDate(date, { weekday: "long" })}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)]">{formatDate(date, { day: "2-digit", month: "long" })}</span>
          </div>
          <button onClick={() => setDate(addDays(date, 1))} className="w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl text-[var(--accent-text)] active:bg-[var(--surface-2)]">→</button>
        </div>

        <div className={`${CARD} mb-4`}>
          <div className="flex flex-wrap gap-2">
            {perSlot.map(({ slot, count }) => (
              <span key={slot.id} className="px-3 py-2 rounded-full border border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)] text-[9px] font-black uppercase tracking-widest">
                {slot.label}: {count}
              </span>
            ))}
            <span className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest ${withoutEntry ? "border-red-500/40 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"}`}>
              Ohne Eintrag: {withoutEntry}
            </span>
          </div>
          <p className={`${HINT} mt-3`}>„Ohne Eintrag“ zählt nur Studenten mit Studierzeit-Pflicht.</p>
        </div>

        <input className={`${INPUT} mb-4`} placeholder="Suche: Name, Zimmer, Schule" value={search} onChange={(e) => setSearch(e.target.value)} />

        {students === null ? (
          <EmptyState>Lädt...</EmptyState>
        ) : list.length === 0 ? (
          <div className={CARD}><EmptyState>Keine Studenten</EmptyState></div>
        ) : (
          <div className="space-y-3">
            {list.map((s) => {
              const booking = bookings[s.uid];
              const required = s.studyRequired !== false;
              const missing = required && !booking;
              return (
                <div key={s.uid} className={`${CARD} ${missing ? "border-[var(--danger-border)]" : booking?.checked === "missing" ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="font-bold text-[var(--text)] block truncate">{s.name ?? s.username}</span>
                      <span className={HINT}>
                        Zimmer {s.room || "—"}
                        {required ? "" : " · keine Pflicht"}
                      </span>
                    </div>
                    {missing && <span className="shrink-0 text-red-500 text-[9px] font-black uppercase tracking-widest">Kein Eintrag</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {schedule.slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => update(s.uid, { slotId: booking?.slotId === slot.id ? null : slot.id })}
                        className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all ${
                          booking?.slotId === slot.id ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>

                  {booking && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-soft)]">
                      <button
                        onClick={() => update(s.uid, { checked: booking.checked === "present" ? null : "present" })}
                        className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          booking.checked === "present" ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
                        }`}
                      >
                        War da
                      </button>
                      <button
                        onClick={() => update(s.uid, { checked: booking.checked === "missing" ? null : "missing" })}
                        className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          booking.checked === "missing" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"
                        }`}
                      >
                        Gefehlt
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className={`${HINT} text-center mt-6`}>Die Pflicht stellst du pro Student unter Verwaltung → Studenten → Bearbeiten ein.</p>
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
