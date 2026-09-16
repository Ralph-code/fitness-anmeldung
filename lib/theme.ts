// Akzentfarbe (vom Admin gesetzt) und Hell/Dunkel (pro Benutzer)

export type ThemeMode = "dark" | "light";
export const THEME_MODES: ThemeMode[] = ["dark", "light"];
export const DEFAULT_ACCENT = "#deff9a";

export const ACCENT_PRESETS = [
  { value: "#deff9a", name: "Limette" },
  { value: "#7dd3fc", name: "Himmel" },
  { value: "#f9a8d4", name: "Rosé" },
  { value: "#fdba74", name: "Apricot" },
  { value: "#a5b4fc", name: "Lavendel" },
  { value: "#6ee7b7", name: "Minze" },
  { value: "#fca5a5", name: "Koralle" },
  { value: "#e4e4e7", name: "Schiefer" },
];

const HEX = /^#[0-9a-f]{6}$/i;

export const isValidAccent = (value: unknown): value is string => typeof value === "string" && HEX.test(value);

export const normalizeAccent = (value: unknown) => (isValidAccent(value) ? value.toLowerCase() : DEFAULT_ACCENT);

export const normalizeTheme = (value: unknown): ThemeMode => (value === "light" ? "light" : "dark");

/** Wahrgenommene Helligkeit 0–1 */
export function luminance(hex: string) {
  const c = normalizeAccent(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Schriftfarbe auf der Akzentfläche (schwarz auf hellen, weiß auf dunklen Farben) */
export const contrastOn = (accent: string) => (luminance(accent) > 0.45 ? "#000000" : "#ffffff");

/** Akzent als Textfarbe – im hellen Modus dunkler, damit er auf Weiß lesbar bleibt */
export function accentText(accent: string, mode: ThemeMode) {
  const value = normalizeAccent(accent);
  if (mode === "dark" || luminance(value) <= 0.35) return value;
  const mix = luminance(value) > 0.6 ? 0.55 : 0.35; // Anteil Schwarz
  const c = value.slice(1);
  const parts = [0, 2, 4].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - mix)));
  return `#${parts.map((p) => p.toString(16).padStart(2, "0")).join("")}`;
}

/** Setzt die Farben auf <html> – wird beim Laden und bei jeder Änderung aufgerufen */
export function applyTheme(mode: ThemeMode, accent: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const value = normalizeAccent(accent);
  root.dataset.theme = mode;
  root.style.setProperty("--accent", value);
  root.style.setProperty("--accent-text", accentText(value, mode));
  root.style.setProperty("--accent-contrast", contrastOn(value));
  root.style.colorScheme = mode;
}
