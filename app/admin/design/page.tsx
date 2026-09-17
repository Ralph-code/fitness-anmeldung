"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { ACCENT_PRESETS, DEFAULT_ACCENT, isValidAccent } from "@/lib/theme";
import AdminPage from "@/components/AdminPage";
import { Toast, useToast } from "@/components/Toast";
import Tour from "@/components/Tour";
import { BTN_GHOST, BTN_PRIMARY, CARD, HINT, INPUT, LABEL } from "@/components/ui";

export default function AdminDesign() {
  const { accent, theme } = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, showToast } = useToast();

  const value = draft ?? accent;
  const isDirty = value.toLowerCase() !== accent.toLowerCase();
  const valid = isValidAccent(value);

  const save = async () => {
    if (busy || !valid) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/theme", { method: "PUT", body: { accent: value } });
      setDraft(null);
      showToast("Farbe gespeichert");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage title="Design" subtitle="Farbe der App">
      {/* Auswahl */}
      <div className={`${CARD} mb-6`} data-tour="design-colors">
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
          <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-1" style={{ color: value }}>Fitness</p>
          <p className="text-2xl font-black italic uppercase tracking-tighter mb-4">Hallo Max</p>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: value, color: "var(--accent-contrast)" }}>
              Buchen
            </span>
            <span className="px-4 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest" style={{ borderColor: value, color: "var(--accent-text)" }}>
              Dein Slot
            </span>
            <span className="px-4 py-2.5 rounded-full border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-black uppercase tracking-widest">
              Voll
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3" data-tour="design-save">
        <button onClick={() => setDraft(null)} disabled={!isDirty || busy} className={`${BTN_GHOST} flex-1`}>Verwerfen</button>
        <button onClick={save} disabled={!isDirty || !valid || busy} className={`${BTN_PRIMARY} flex-[1.6] flex items-center justify-center gap-2`}>
          <Palette size={14} /> {busy ? "Speichert..." : "Speichern"}
        </button>
      </div>

      <Toast toast={toast} />
      <Tour id="design" />
    </AdminPage>
  );
}
