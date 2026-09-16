"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { DEFAULT_ACCENT, applyTheme, normalizeAccent, normalizeTheme, type ThemeMode } from "@/lib/theme";
import { localeOf, normalizeLanguage, translate, type Language, type TranslationKey } from "@/lib/i18n";

const STORAGE = { theme: "heim.theme", language: "heim.language", accent: "heim.accent" };

// Kleiner Speicher-Store: die zuletzt genutzten Einstellungen gelten sofort beim Start
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Privater Modus: dann gilt die Einstellung nur für diese Sitzung */
  }
  listeners.forEach((l) => l());
};

function useStored(key: string) {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => readStored(key), [key]),
    () => null
  );
}

type SettingsValue = {
  theme: ThemeMode;
  language: Language;
  accent: string;
  locale: string;
  setTheme: (mode: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const SettingsContext = createContext<SettingsValue>({
  theme: "dark",
  language: "de",
  accent: DEFAULT_ACCENT,
  locale: "de-DE",
  setTheme: () => {},
  setLanguage: () => {},
  t: (key) => translate("de", key),
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [remoteAccent, setRemoteAccent] = useState<string | null>(null);

  const storedTheme = useStored(STORAGE.theme);
  const storedLanguage = useStored(STORAGE.language);
  const storedAccent = useStored(STORAGE.accent);

  // Das Profil gewinnt, solange es geladen ist – sonst die zuletzt genutzte Einstellung
  const theme = normalizeTheme(user?.theme ?? storedTheme);
  const language = normalizeLanguage(user?.language ?? storedLanguage);
  const accent = normalizeAccent(remoteAccent ?? storedAccent);

  // Akzentfarbe des Heims (vom Admin gesetzt)
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, "settings", "theme"),
      (snap) => {
        const value = normalizeAccent(snap.data()?.accent);
        setRemoteAccent(value);
        writeStored(STORAGE.accent, value);
      },
      () => {}
    );
  }, [user]);

  // Profil-Einstellungen für den nächsten Start merken
  useEffect(() => {
    if (user?.theme) writeStored(STORAGE.theme, normalizeTheme(user.theme));
    if (user?.language) writeStored(STORAGE.language, normalizeLanguage(user.language));
  }, [user?.theme, user?.language]);

  // Die Login-Seite ist immer dunkel, die persönliche Wahl gilt ab dem Login
  const appliedTheme = pathname === "/" ? "dark" : theme;

  useEffect(() => {
    applyTheme(appliedTheme, accent);
    document.documentElement.lang = language;
  }, [appliedTheme, accent, language]);

  const setTheme = useCallback((mode: ThemeMode) => {
    writeStored(STORAGE.theme, mode);
    apiFetch("/api/profile", { method: "PATCH", body: { action: "setTheme", theme: mode } }).catch(() => {});
  }, []);

  const setLanguage = useCallback((next: Language) => {
    writeStored(STORAGE.language, next);
    apiFetch("/api/profile", { method: "PATCH", body: { action: "setLanguage", language: next } }).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language]
  );

  return (
    <SettingsContext.Provider value={{ theme, language, accent, locale: localeOf(language), setTheme, setLanguage, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
