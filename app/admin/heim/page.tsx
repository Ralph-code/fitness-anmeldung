"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, Moon } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import { DEFAULT_PRESENCE, PRESENCE_LABELS, PRESENCE_STATUSES, presenceTone, type PresenceStatus } from "@/lib/presence";
import type { Presence, StudentRecord } from "@/lib/types";
import { CARD, EmptyState, HINT, INPUT, Loading } from "@/components/ui";

const TONE_CLASS = {
  lime: "border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent-text)]",
  zinc: "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)]",
  red: "border-red-500/40 bg-red-500/10 text-red-500",
};

export default function AdminPresence() {
  const { user, loading } = useAuth();
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [entries, setEntries] = useState<Record<string, Presence>>({});
  const [date, setDate] = useState(zonedNow().date);
  const [search, setSearch] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const today = zonedNow().date;

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 2500);
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
      query(collection(db, "presence"), where("date", "==", date)),
      (snap) => {
        const byUid: Record<string, Presence> = {};
        snap.docs.forEach((d) => {
          const entry = d.data() as Presence;
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
  }, [user?.isAdmin, date]);

  if (loading || !user?.isAdmin) return <Loading text="Admin Check..." />;

  const update = async (uid: string, changes: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    const previous = entries[uid];
    // Sofort anzeigen, der Server bestätigt im Hintergrund
    setEntries((prev) => ({ ...prev, [uid]: { ...(previous ?? { uid, date, status: DEFAULT_PRESENCE }), ...changes } as Presence }));
    try {
      await apiFetch("/api/admin/presence", { method: "PATCH", body: { uid, date, ...changes } });
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

  const statusOf = (uid: string) => (entries[uid]?.status as PresenceStatus) ?? DEFAULT_PRESENCE;
  const term = search.trim().toLowerCase();
  const list = (students ?? []).filter((s) => !term || [s.name, s.room, s.school].some((v) => v?.toLowerCase().includes(term)));
  const counts = PRESENCE_STATUSES.map((status) => ({ status, count: (students ?? []).filter((s) => statusOf(s.uid) === status).length }));
  const missingRoom = (students ?? []).filter((s) => entries[s.uid]?.roomCheck === "missing").length;
  const checkedRoom = (students ?? []).filter((s) => entries[s.uid]?.roomCheck).length;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-24 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Anwesenheit</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-6">Wer ist wo · Zimmerkontrolle</p>

        {/* Datum */}
        <div className="flex items-center justify-between mb-5 bg-[var(--surface)] border border-[var(--border)] p-2 rounded-2xl">
          <button onClick={() => setDate(addDays(date, -1))} className="w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl text-[var(--accent-text)] active:bg-[var(--surface-2)]">←</button>
          <div className="text-center">
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--accent-text)] block">{date === today ? "Heute" : formatDate(date, { weekday: "long" })}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)]">{formatDate(date, { day: "2-digit", month: "long" })}</span>
          </div>
          <button onClick={() => setDate(addDays(date, 1))} className="w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl text-[var(--accent-text)] active:bg-[var(--surface-2)]">→</button>
        </div>

        {blocked && (
          <div className={`${CARD} mb-5 border-[var(--danger-border)] bg-[var(--danger-soft)]`}>
            <p className="text-sm text-[var(--text)] leading-relaxed">
              Die Anwesenheit kann nicht gelesen werden. Bitte die Firestore-Regeln aus <code>firestore.rules</code> in der Firebase Console veröffentlichen – sonst bleiben Status und Zimmerkontrolle leer.
            </p>
          </div>
        )}

        {/* Überblick */}
        <div className={`${CARD} mb-5`}>
          <div className="flex flex-wrap gap-2">
            {counts.filter((c) => c.count > 0).map(({ status, count }) => (
              <span key={status} className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest ${TONE_CLASS[presenceTone(status)]}`}>
                {PRESENCE_LABELS[status]} {count}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border-soft)]">
            <Moon size={14} className="text-[var(--text-dim)]" />
            <span className={HINT}>
              Zimmerkontrolle: {checkedRoom} von {students?.length ?? 0} erledigt
              {missingRoom > 0 ? ` · ${missingRoom} nicht im Zimmer` : ""}
            </span>
          </div>
        </div>

        <input className={`${INPUT} mb-4`} placeholder="Suche: Name, Zimmer, Schule" value={search} onChange={(e) => setSearch(e.target.value)} />

        {students === null ? (
          <EmptyState>Lädt...</EmptyState>
        ) : list.length === 0 ? (
          <div className={CARD}><EmptyState>Keine Studenten</EmptyState></div>
        ) : (
          <div className="space-y-3">
            {list.map((s) => {
              const entry = entries[s.uid];
              const status = statusOf(s.uid);
              const roomCheck = entry?.roomCheck ?? null;
              return (
                <div key={s.uid} className={`${CARD} ${roomCheck === "missing" ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="font-bold text-[var(--text)] block truncate">{s.name ?? s.username}</span>
                      <span className={HINT}>Zimmer {s.room || "—"}{s.school ? ` · ${s.school}` : ""}</span>
                    </div>
                    <span className={`shrink-0 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${TONE_CLASS[presenceTone(status)]}`}>
                      {PRESENCE_LABELS[status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {PRESENCE_STATUSES.map((option) => (
                      <button
                        key={option}
                        onClick={() => update(s.uid, { status: option })}
                        className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all ${
                          status === option ? TONE_CLASS[presenceTone(option)] : "border-[var(--border)] text-[var(--text-dim)]"
                        }`}
                      >
                        {PRESENCE_LABELS[option]}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
                    <span className="text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2">Nachtrunde</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => update(s.uid, { roomCheck: roomCheck === "present" ? null : "present" })}
                        className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          roomCheck === "present" ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
                        }`}
                      >
                        Anwesend
                      </button>
                      <button
                        onClick={() => update(s.uid, { roomCheck: roomCheck === "missing" ? null : "missing" })}
                        className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          roomCheck === "missing" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--border)] text-[var(--text-dim)]"
                        }`}
                      >
                        Fehlt
                      </button>
                    </div>
                  </div>

                  <input
                    className={`${INPUT} mt-3 text-sm`}
                    placeholder="Notiz (z.B. bis 22:00 Ausgang)"
                    defaultValue={entry?.note ?? ""}
                    onBlur={(e) => {
                      if ((entry?.note ?? "") !== e.target.value) update(s.uid, { note: e.target.value });
                    }}
                    maxLength={200}
                  />
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
