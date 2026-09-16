"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { TriangleAlert } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, zonedNow } from "@/lib/schedule";
import { MEAL_KEYS, SIGNOFF_DEADLINE } from "@/lib/meals";
import type { MealKey } from "@/lib/content";
import type { MealAttendance } from "@/lib/types";
import { ModalShell } from "@/components/ConfirmModal";
import { BTN_PRIMARY } from "@/components/ui";

const DAYS_BACK = 7;

/**
 * Wer beim Essen gefehlt hat, obwohl er angemeldet war, muss die Meldung
 * bestätigen, bevor er die App weiter benutzen kann.
 */
export default function MissedMealNotice() {
  const { user } = useAuth();
  const { t, locale } = useSettings();
  const uid = user?.uid;
  const isAdmin = !!user?.isAdmin;
  const [entries, setEntries] = useState<Record<string, MealAttendance | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const today = zonedNow().date;

  useEffect(() => {
    if (!uid || isAdmin) return;
    const days = Array.from({ length: DAYS_BACK }, (_, i) => addDays(today, -i));
    const unsubs = days.map((date) =>
      onSnapshot(
        doc(db, "mealAttendance", `${date}_${uid}`),
        (snap) => setEntries((prev) => ({ ...prev, [date]: snap.exists() ? (snap.data() as MealAttendance) : null })),
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [uid, isAdmin, today]);

  if (!uid || isAdmin) return null;

  const pending: { date: string; meal: MealKey }[] = [];
  for (const entry of Object.values(entries)) {
    if (!entry) continue;
    for (const meal of MEAL_KEYS) {
      if (entry[`${meal}Checked`] === "missing" && !entry[`${meal}AckAt`]) {
        pending.push({ date: entry.date, meal });
      }
    }
  }
  if (pending.length === 0) return null;

  pending.sort((a, b) => a.date.localeCompare(b.date));
  const current = pending[0];

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/meals/acknowledge", { method: "POST", body: { date: current.date, meal: current.meal } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell tone="red" z="z-[900]">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
        <TriangleAlert size={28} strokeWidth={2.4} />
      </div>
      <h3 className="text-2xl font-black italic uppercase mb-3 text-red-500 tracking-tighter">{t("missed.title")}</h3>
      <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-2">
        {t("missed.text", {
          meal: t(current.meal === "lunch" ? "meals.lunch" : "meals.dinner"),
          date: formatDate(current.date, { weekday: "long", day: "2-digit", month: "long" }, locale),
        })}
      </p>
      <p className="text-[var(--text-dim)] text-xs leading-relaxed mb-8">{t("missed.hint", { time: SIGNOFF_DEADLINE })}</p>

      {error && <p className="text-red-500 text-[11px] font-bold mb-4">{error}</p>}

      <button onClick={confirm} disabled={busy} className={`${BTN_PRIMARY} w-full`}>
        {busy ? "..." : pending.length > 1 ? `${t("missed.confirm")} (${pending.length})` : t("missed.confirm")}
      </button>
    </ModalShell>
  );
}
