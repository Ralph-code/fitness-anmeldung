"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useSchedule } from "@/lib/useSchedule";
import {
  DEFAULT_SCHEDULE, MAX_SLOTS, MAX_SLOT_CAPACITY, fromMinutes, toMinutes, validateSchedule,
  type Schedule, type SlotConfig,
} from "@/lib/schedule";
import ConfirmModal from "@/components/ConfirmModal";

type Draft = { opensAt: string; slots: SlotConfig[] };

const AGE_OPTIONS: (number | null)[] = [null, 14, 16, 18];

const toDraft = (s: Schedule): Draft => ({
  opensAt: s.opensAt,
  slots: s.slots.map(({ id, start, end, capacity, minAge }) => ({ id, start, end, capacity, minAge })),
});

const newSlotId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const cardClass = "bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden";
const labelClass = "text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-4";
const timeClass = "w-full min-w-0 bg-black border border-zinc-800 rounded-2xl p-3 sm:p-4 text-xl sm:text-2xl font-black italic tracking-tighter text-white outline-none focus:border-[#deff9a] transition-all [color-scheme:dark]";
const stepClass = "w-10 h-10 flex items-center justify-center rounded-xl bg-black border border-zinc-800 text-[#deff9a] font-black text-xl active:scale-90 transition-all disabled:text-zinc-800";

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
    if (!loading && (!user || !user.isAdmin)) router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading || !user?.isAdmin || !ready) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase tracking-widest">
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
    update({ slots: [...current.slots, { id: newSlotId(), start, end, capacity: last?.capacity ?? 6, minAge: null }] });
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
    <div className="min-h-screen bg-black text-white p-6 pb-44 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-2xl mx-auto pt-10">

        {/* Back Navigation */}
        <button
          onClick={() => router.push("/gym-admin-control")}
          className="mb-10 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <span className="text-lg">←</span> Control
        </button>

        <h1 className="text-4xl font-black italic text-[#deff9a] uppercase tracking-tighter mb-2">Slots</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mb-12">Zeitplan & Plätze</p>

        {/* Buchungsfenster */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <label className={labelClass}>Buchung für morgen ab</label>
            <input
              type="time"
              value={current.opensAt}
              onChange={(e) => update({ opensAt: e.target.value })}
              className="w-full bg-black border border-zinc-800 rounded-2xl p-5 text-3xl font-black text-[#deff9a] outline-none focus:border-[#deff9a]/50 transition-all shadow-inner [color-scheme:dark]"
            />
            <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed uppercase font-bold italic">
              Buchungsschluss für heute ist der Start des letzten Slots{lastStart && ` (${lastStart})`}. Dazwischen ist Pause.
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#deff9a]/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Slot-Liste */}
        <div className="space-y-4">
          {current.slots.map((slot) => (
            <div key={slot.id} className="p-5 sm:p-6 rounded-[2.5rem] border border-zinc-800/50 bg-zinc-900/40">
              <div className="flex items-center gap-2 sm:gap-3">
                <input type="time" className={timeClass} value={slot.start} onChange={(e) => updateSlot(slot.id, { start: e.target.value })} />
                <span className="text-zinc-600 font-black">–</span>
                <input type="time" className={timeClass} value={slot.end} onChange={(e) => updateSlot(slot.id, { end: e.target.value })} />
                <button
                  onClick={() => removeSlot(slot.id)}
                  disabled={current.slots.length <= 1}
                  className="w-12 h-12 shrink-0 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black active:scale-90 transition-all disabled:opacity-30"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 mt-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => updateSlot(slot.id, { capacity: slot.capacity - 1 })} disabled={slot.capacity <= 1} className={stepClass}>−</button>
                  <div className="text-center min-w-[3.5rem]">
                    <span className="text-[20px] font-black tracking-widest block leading-none">{slot.capacity}</span>
                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.3em]">Plätze</span>
                  </div>
                  <button onClick={() => updateSlot(slot.id, { capacity: slot.capacity + 1 })} disabled={slot.capacity >= MAX_SLOT_CAPACITY} className={stepClass}>+</button>
                </div>

                <div className="flex gap-1.5">
                  {AGE_OPTIONS.map((age) => (
                    <button
                      key={age ?? "all"}
                      onClick={() => updateSlot(slot.id, { minAge: age })}
                      className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all ${
                        slot.minAge === age ? "border-[#deff9a]/50 bg-[#deff9a]/10 text-[#deff9a]" : "border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {age ? `${age}+` : "Alle"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {[...Array(slot.capacity)].map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-zinc-800" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addSlot}
          disabled={current.slots.length >= MAX_SLOTS}
          className="w-full mt-4 py-6 border border-dashed border-zinc-800 rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.3em] text-[#deff9a] active:scale-95 transition-all disabled:opacity-30"
        >
          + Slot hinzufügen
        </button>
        <button
          onClick={() => setDraft(toDraft(DEFAULT_SCHEDULE))}
          className="w-full mt-3 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 hover:text-white transition-colors"
        >
          Standard wiederherstellen
        </button>
      </div>

      {/* Speichern-Leiste */}
      <div className="fixed bottom-0 inset-x-0 z-[400] bg-black/80 backdrop-blur-xl border-t border-zinc-900 p-4">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest mb-3">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setDraft(null)}
              disabled={!isDirty || busy}
              className="flex-1 py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-30"
            >
              Verwerfen
            </button>
            <button
              onClick={requestSave}
              disabled={!isDirty || !!error || busy}
              className="flex-[2] py-5 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-30"
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
            statusMsg.type === "success" ? "bg-black border-[#deff9a] text-[#deff9a]" : "bg-black border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}
