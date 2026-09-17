import type { ReactNode } from "react";

// Gemeinsame Optik für die ganze App
export const CARD = "rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5 sm:p-6";
export const INPUT = "w-full p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl outline-none focus:border-[var(--accent)] text-[var(--text)] font-medium transition-all placeholder:text-[var(--text-faint)]";
export const LABEL = "text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.3em] block mb-3";
export const HINT = "text-[11px] text-[var(--text-dim)] leading-relaxed";

const BTN = "py-4 px-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100";
export const BTN_PRIMARY = `${BTN} bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_10px_30px_var(--accent-20)]`;
export const BTN_GHOST = `${BTN} bg-[var(--surface-2)] text-[var(--text)]`;
export const BTN_OUTLINE = `${BTN} bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)]`;
export const PILL = "px-4 py-2.5 border rounded-full text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all";

const TONES = {
  lime: "border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)]",
  zinc: "border-[var(--border-strong)] text-[var(--text-muted)]",
  red: "border-red-500/30 bg-red-500/10 text-red-500",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest leading-none ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SectionTitle({ title, icon, action }: { title: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-3 px-1">
      <div className="flex items-center gap-2 text-[var(--text-dim)]">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">{title}</span>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-center text-[var(--text-faint)] text-xs py-8 leading-relaxed">{children}</p>;
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border-soft)] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)] pt-0.5 shrink-0">{label}</span>
      <span className="text-sm text-[var(--text)] text-right break-words min-w-0">{value}</span>
    </div>
  );
}

export function Loading({ text = "Lädt..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--accent-text)] font-black uppercase tracking-widest animate-pulse">
      {text}
    </div>
  );
}
