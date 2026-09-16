"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Palette } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { ACCENT_PRESETS, DEFAULT_ACCENT, isValidAccent } from "@/lib/theme";
import { BTN_GHOST, BTN_PRIMARY, CARD, HINT, INPUT, LABEL, Loading } from "@/components/ui";

export default function AdminDesign() {
  const { user, loading } = useAuth();
  const { accent, theme } = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  if (loading || !user?.isAdmin) return <Loading text="Admin Check..." />;

  const value = draft ?? accent;
  const isDirty = value.toLowerCase() !== accent.toLowerCase();
  const valid = isValidAccent(value);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const save = async () => {
    if (busy || !valid) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/theme", { method: "PUT", body: { accent: value } });
      setDraft(null);
      showFeedback("Farbe gespeichert");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-24 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Design</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-8">Farbe der App</p>

        {/* Auswahl */}
        <div className={`${CARD} mb-6`}>
          <span className={LABEL}>Akzentfarbe</span>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDraft(preset.value)}
                title={preset.name}
                className={`aspect-square rounded-2xl border-2 flex items-center justify-center transition-all active:scale-95 ${
                  value.toLowerCase() === preset.value ? "border-[var(--text)]" : "border-[var(--border)]"
                }`}
                style={{ backgroundColor: preset.value }}
              >
                {value.toLowerCase() === preset.value && <Check size={18} className="text-black" />}
              </button>
            ))}
          </div>

          <span className={LABEL}>Eigene Farbe</span>
          <div className="flex gap-3">
            <input
              type="color"
              value={valid ? value : DEFAULT_ACCENT}
              onChange={(e) => setDraft(e.target.value)}
              className="w-16 h-14 rounded-2xl bg-[var(--bg)] border border-[var(--border)] cursor-pointer"
              aria-label="Farbe wählen"
            />
            <input
              className={`${INPUT} font-mono`}
              value={value}
              onChange={(e) => setDraft(e.target.value.trim())}
              placeholder="#deff9a"
              maxLength={7}
            />
          </div>
          {!valid && <p className="text-red-500 text-[11px] font-bold mt-2 px-1">Bitte einen Farbcode wie #deff9a eingeben.</p>}
          <p className={`${HINT} mt-4`}>
            Die Farbe gilt für alle Benutzer. Hell oder Dunkel wählt jeder selbst im Profil.
          </p>
        </div>

        {/* Vorschau */}
        <div className={`${CARD} mb-6`}>
          <span className={LABEL}>Vorschau ({theme === "dark" ? "dunkel" : "hell"})</span>
          <div className="rounded-2xl border border-[var(--border)] p-5" style={{ background: "var(--surface)" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-1" style={{ color: value }}>Heim</p>
            <p className="text-2xl font-black italic uppercase tracking-tighter mb-4">Guten Morgen</p>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: value, color: "var(--accent-contrast)" }}>
                Buchen
              </span>
              <span className="px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest" style={{ borderColor: value, color: "var(--accent-text)" }}>
                Dabei
              </span>
              <span className="px-4 py-2.5 rounded-full border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-black uppercase tracking-widest">
                Abgemeldet
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setDraft(null)} disabled={!isDirty || busy} className={`${BTN_GHOST} flex-1`}>Verwerfen</button>
          <button onClick={save} disabled={!isDirty || !valid || busy} className={`${BTN_PRIMARY} flex-[1.6] flex items-center justify-center gap-2`}>
            <Palette size={14} /> {busy ? "Speichert..." : "Speichern"}
          </button>
        </div>
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
