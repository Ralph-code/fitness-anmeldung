"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import { ModalShell } from "@/components/ConfirmModal";

const PRESETS = [
  { label: "1 Tag", days: 1 },
  { label: "3 Tage", days: 3 },
  { label: "1 Woche", days: 7 },
  { label: "2 Wochen", days: 14 },
  { label: "1 Monat", days: 30 },
];

export default function SuspendModal({
  student,
  onClose,
  onDone,
}: {
  student: { uid: string; name: string };
  onClose: () => void;
  onDone: (message: string, type?: "success" | "error") => void;
}) {
  const today = zonedNow().date;
  const [until, setUntil] = useState(addDays(today, 7));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ removed: number }>(`/api/admin/students/${student.uid}`, {
        method: "PATCH",
        body: { action: "suspend", until, reason },
      });
      onDone(res.removed ? `Gesperrt · ${res.removed} Buchung entfernt` : "Gesperrt");
      onClose();
    } catch (e) {
      onDone((e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <ModalShell z="z-[600]" padding="p-8 sm:p-12">
      <h3 className="text-3xl font-black italic uppercase mb-3 text-red-500 tracking-tighter break-words">{student.name}</h3>
      <p className="text-[var(--text-dim)] mb-8 text-[10px] uppercase tracking-widest leading-relaxed">Sperren bis einschließlich</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {PRESETS.map((p) => {
          const date = addDays(today, p.days);
          return (
            <button
              key={p.days}
              onClick={() => setUntil(date)}
              className={`py-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all ${
                until === date ? "border-red-500 text-red-500 bg-red-500/10" : "border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <input
        type="date"
        value={until}
        min={today}
        onChange={(e) => setUntil(e.target.value)}
        className="w-full p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl outline-none focus:border-red-500/50 text-red-500 font-black transition-all [color-scheme:dark] mb-3"
      />
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Grund (optional)"
        maxLength={200}
        className="w-full p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl outline-none focus:border-red-500/50 text-[var(--text)] font-bold transition-all placeholder:text-[var(--text-faint)] mb-3"
      />
      <p className="text-[9px] text-[var(--text-faint)] mb-8 leading-relaxed uppercase font-bold italic">
        Bis {until ? formatDate(until, { weekday: "short", day: "2-digit", month: "long" }) : "?"} · offene Buchungen werden entfernt
      </p>

      <div className="flex gap-4">
        <button onClick={onClose} className="flex-1 py-4 bg-[var(--surface-2)] text-[var(--text)] rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
          Abbrechen
        </button>
        <button
          onClick={submit}
          disabled={busy || !until || until < today}
          className="flex-1 py-4 bg-red-600 text-[var(--text)] rounded-2xl font-black uppercase text-[10px] active:scale-95 animate-soft-pulse shadow-[0_10px_20px_rgba(220,38,38,0.3)] disabled:opacity-50"
        >
          {busy ? "..." : "Sperren"}
        </button>
      </div>
    </ModalShell>
  );
}
