"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error";
type ToastState = { text: string; type: ToastType };

const DURATION_MS = 3500;

/** Kurze Rückmeldung nach einer Aktion ("Gespeichert", Fehlermeldung) */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((text: string, type: ToastType = "success") => {
    clearTimeout(timer.current);
    setToast({ text, type });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, showToast };
}

/** `position` verschiebt die Meldung über eine feste Leiste am unteren Rand */
export function Toast({ toast, position = "bottom-10" }: { toast: ToastState | null; position?: string }) {
  if (!toast) return null;
  const tone =
    toast.type === "success" ? "border-[var(--accent)] text-[var(--accent-text)]" : "border-red-500 text-red-500";

  return (
    <div role="status" className={`fixed ${position} left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in`}>
      <div className={`p-5 rounded-2xl border bg-[var(--bg)] text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${tone}`}>
        {toast.text}
      </div>
    </div>
  );
}
