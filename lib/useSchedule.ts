"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SCHEDULE, normalizeSchedule, type Schedule } from "@/lib/schedule";

/** Zeitplan in Echtzeit – Änderungen des Admins erscheinen sofort bei allen */
export function useSchedule(enabled: boolean) {
  const [state, setState] = useState<{ schedule: Schedule; ready: boolean }>({
    schedule: DEFAULT_SCHEDULE,
    ready: false,
  });

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(db, "settings", "schedule"),
      (snap) => setState({ schedule: snap.exists() ? normalizeSchedule(snap.data()) : DEFAULT_SCHEDULE, ready: true }),
      (err) => {
        console.warn("Zeitplan:", err.message);
        setState((prev) => ({ ...prev, ready: true }));
      }
    );
  }, [enabled]);

  return state;
}
