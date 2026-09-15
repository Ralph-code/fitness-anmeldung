"use client";

import type { ReactNode } from "react";

/** Gleicher Look wie die bisherigen Storno-Dialoge; tone="green" für neutrale Dialoge */
export function ModalShell({
  children,
  tone = "red",
  z = "z-[500]",
  padding = "p-12",
}: {
  children: ReactNode;
  tone?: "red" | "green";
  z?: string;
  padding?: string;
}) {
  const red = tone === "red";
  return (
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center ${z} p-4 text-center animate-in fade-in`}>
      <div
        className={`bg-zinc-900 border ${padding} rounded-[3.5rem] max-w-sm w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 relative ${
          red ? "border-red-900/30 shadow-[0_0_50px_rgba(127,29,29,0.2)]" : "border-zinc-800 shadow-[0_0_50px_rgba(222,255,154,0.08)]"
        }`}
      >
        {/* Pulsierender Hintergrund-Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {red ? (
            <div
              className="absolute -inset-[50%] opacity-40 animate-red-glow bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]"
              style={{ filter: "blur(60px)", borderRadius: "40%" }}
            ></div>
          ) : (
            <div
              className="absolute -inset-[100%] opacity-20 animate-slow-spin bg-[radial-gradient(ellipse_at_center,#deff9a_0%,transparent_70%)]"
              style={{ filter: "blur(60px)", borderRadius: "40%" }}
            ></div>
          )}
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

export default function ConfirmModal({
  title,
  text,
  confirmLabel,
  cancelLabel = "Nein",
  onConfirm,
  onCancel,
  busy = false,
  z,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  z?: string;
}) {
  return (
    <ModalShell z={z}>
      <h3 className="text-3xl font-black italic uppercase mb-3 text-red-500 tracking-tighter break-words">{title}</h3>
      <p className="text-zinc-500 mb-10 text-[10px] uppercase tracking-widest leading-relaxed">{text}</p>
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 animate-soft-pulse shadow-[0_10px_20px_rgba(220,38,38,0.3)] disabled:opacity-50"
        >
          {busy ? "..." : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
