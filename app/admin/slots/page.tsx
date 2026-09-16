"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useSchedule } from "@/lib/useSchedule";
import {
  ADULT_AGE, DEFAULT_SCHEDULE, MAX_SLOTS, MAX_SLOT_CAPACITY, fromMinutes, toMinutes, validateSchedule,
  type Schedule, type SlotConfig,
} from "@/lib/schedule";
import ConfirmModal from "@/components/ConfirmModal";

type Draft = { opensAt: string; slots: SlotConfig[] };

const toDraft = (s: Schedule): Draft => ({
  opensAt: s.opensAt,
  slots: s.slots.map(({ id, start, end, capacity, minAge, requiresApproval }) => ({
    id, start, end, capacity, minAge, requiresApproval,
  })),
});

const newSlotId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const cardClass = "bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden";
const labelClass = "text-[var(--text-dim)] text-[9px] font-black uppercase tracking-[0.4em] block mb-4";
const timeClass = "w-full min-w-0 bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-2 py-3 sm:p-4 text-lg sm:text-2xl text-center font-black italic tracking-tighter text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all [color-scheme:dark]";
const stepClass = "w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--accent-text)] font-black text-xl active:scale-90 transition-all disabled:text-[var(--text-faint)]";
const toggleClass = (on: boolean) =>
  `px-3 sm:px-4 py-2.5 rounded-full border text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all ${
    on ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
  }`;

export default function SlotsAdmin() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { schedule, ready } = useSchedule(!!user?.isAdmin);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemoved, setConfirmRemoved] = useState<SlotConfig[] | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  }, []);

  // Sicherheits-Check: Nur Admins dürfen hier sein
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) router.replace("/start");
  }, [user, loading, router]);

  if (loading || !user?.isAdmin || !ready) return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--accent-text)] font-black uppercase tracking-widest">
      Admin Check...
    </div>
  );

  const saved = toDraft(schedule);
  const current = draft ?? saved;
  const isDirty = JSON.stringify(current) !== JSON.stringify(saved);
  let error = "";
  try {
    validateSchedule(current);
  } catch (e) {
    error = (e as Error).message;
  }
  const lastStart = [...current.slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)).at(-1)?.start;

  const update = (next: Partial<Draft>) => setDraft({ ...current, ...next });
  const updateSlot = (id: string, patch: Partial<SlotConfig>) =>
    update({ slots: current.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSlot = (id: string) => update({ slots: current.slots.filter((s) => s.id !== id) });

  const addSlot = () => {
    const last = [...current.slots].sort((a, b) => toMinutes(b.end) - toMinutes(a.end))[0];
    const start = fromMinutes(Math.min(last ? toMinutes(last.end) : 6 * 60, 22 * 60 + 58));
    const end = fromMinutes(Math.min(toMinutes(start) + 60, 23 * 60 + 59));
    update({
      slots: [...current.slots, { id: newSlotId(), start, end, capacity: last?.capacity ?? 6, minAge: null, requiresApproval: false }],
    });
  };

  const save = async () => {
    setConfirmRemoved(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ removed: number }>("/api/admin/schedule", { method: "PUT", body: current });
      setDraft(toDraft(validateSchedule(current)));
      showFeedback(res.removed ? `Gespeichert · ${res.removed} Buchungen storniert` : "Gespeichert");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const requestSave = () => {
    const removed = saved.slots.filter((s) => !current.slots.some((d) => d.id === s.id));
    if (removed.length) setConfirmRemoved(removed);
    else save();
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-44 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">

        {/* Back Navigation */}
        <button
          onClick={() => router.push("/admin")}
          className="mb-8 sm:mb-10 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <span className="text-lg">←</span> Control
        </button>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Slots</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-10 sm:mb-12">Zeitplan & Plätze</p>

        {/* Buchungsfenster */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <span className={labelClass}>Buchung für morgen ab</span>
            <input
              type="time"
              value={current.opensAt}
              onChange={(e) => update({ opensAt: e.target.value })}
              className="w-full min-h-[4.5rem] bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 text-3xl font-black text-[var(--accent-text)] outline-none focus:border-[var(--accent-50)] transition-all shadow-inner [color-scheme:dark]"
            />
            <p className="text-[9px] text-[var(--text-faint)] mt-3 leading-relaxed uppercase font-bold italic">
              Buchungsschluss für heute ist der Start des letzten Slots{lastStart && ` (${lastStart})`}. Dazwischen ist Pause.
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[var(--accent-05)] blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        <p className="text-[9px] text-[var(--text-faint)] mb-4 px-2 leading-relaxed uppercase font-bold italic">
          {ADULT_AGE}+: nur Studenten ab {ADULT_AGE} sehen den Slot · Mit Bestätigung: nur bestätigte Studenten sehen den Slot
        </p>

        {/* Slot-Liste */}
        <div className="space-y-4">
          {current.slots.map((slot) => (
            <div key={slot.id} className="p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-[var(--border-soft)] bg-[var(--surface-soft)]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                <input type="time" aria-label="Start" className={timeClass} value={slot.start} onChange={(e) => updateSlot(slot.id, { start: e.target.value })} />
                <span className="text-[var(--text-faint)] font-black">–</span>
                <input type="time" aria-label="Ende" className={timeClass} value={slot.end} onChange={(e) => updateSlot(slot.id, { end: e.target.value })} />
                <button
                  onClick={() => removeSlot(slot.id)}
                  disabled={current.slots.length <= 1}
                  aria-label="Slot löschen"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black active:scale-90 transition-all disabled:opacity-30"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mt-4 sm:mt-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => updateSlot(slot.id, { capacity: slot.capacity - 1 })} disabled={slot.capacity <= 1} className={stepClass}>−</button>
                  <div className="text-center min-w-[3.5rem]">
                    <span className="text-[20px] font-black tracking-widest block leading-none">{slot.capacity}</span>
                    <span className="text-[8px] text-[var(--text-dim)] font-black uppercase tracking-[0.3em]">Plätze</span>
                  </div>
                  <button onClick={() => updateSlot(slot.id, { capacity: slot.capacity + 1 })} disabled={slot.capacity >= MAX_SLOT_CAPACITY} className={stepClass}>+</button>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => updateSlot(slot.id, { minAge: slot.minAge ? null : ADULT_AGE })} className={toggleClass(!!slot.minAge)}>
                    {ADULT_AGE}+
                  </button>
                  <button onClick={() => updateSlot(slot.id, { requiresApproval: !slot.requiresApproval })} className={toggleClass(slot.requiresApproval)}>
                    Mit Bestätigung
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {[...Array(slot.capacity)].map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-[var(--surface-2)]" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addSlot}
          disabled={current.slots.length >= MAX_SLOTS}
          className="w-full mt-4 py-6 border border-dashed border-[var(--border)] rounded-[2rem] sm:rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-text)] active:scale-95 transition-all disabled:opacity-30"
        >
          + Slot hinzufügen
        </button>
        <button
          onClick={() => setDraft(toDraft(DEFAULT_SCHEDULE))}
          className="w-full mt-3 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
        >
          Standard wiederherstellen
        </button>
      </div>

      {/* Speichern-Leiste */}
      <div className="fixed bottom-0 inset-x-0 z-[400] bg-[var(--overlay)] backdrop-blur-xl border-t border-[var(--border)] p-4">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest mb-3">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setDraft(null)}
              disabled={!isDirty || busy}
              className="flex-1 py-5 bg-[var(--surface-2)] text-[var(--text)] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-30"
            >
              Verwerfen
            </button>
            <button
              onClick={requestSave}
              disabled={!isDirty || !!error || busy}
              className="flex-[2] py-5 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_var(--accent-20)] disabled:opacity-30"
            >
              {busy ? "Speichere..." : "Speichern"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Slots entfernen */}
      {confirmRemoved && (
        <ConfirmModal
          title={`${confirmRemoved.length} Slot${confirmRemoved.length > 1 ? "s" : ""} löschen?`}
          text={`Offene Buchungen in ${confirmRemoved.map((s) => `${s.start}-${s.end}`).join(", ")} werden storniert.`}
          confirmLabel="Speichern"
          busy={busy}
          onCancel={() => setConfirmRemoved(null)}
          onConfirm={save}
        />
      )}

      {statusMsg && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
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
