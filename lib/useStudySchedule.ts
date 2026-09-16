"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_STUDY, normalizeStudySchedule, type StudySchedule } from "@/lib/study";

/** Studierzeiten in Echtzeit – Änderungen des Admins erscheinen sofort */
export function useStudySchedule(enabled: boolean) {
  const [state, setState] = useState<{ schedule: StudySchedule; ready: boolean }>({ schedule: DEFAULT_STUDY, ready: false });

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(db, "settings", "study"),
      (snap) => setState({ schedule: snap.exists() ? normalizeStudySchedule(snap.data()) : DEFAULT_STUDY, ready: true }),
      (err) => {
        console.warn("Studierzeiten:", err.message);
        setState((prev) => ({ ...prev, ready: true }));
      }
    );
  }, [enabled]);

  return state;
}
