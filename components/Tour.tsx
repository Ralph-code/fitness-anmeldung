"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { TOURS, type TourId } from "@/lib/tours";

const BUBBLE_WIDTH = 300;
/** Platz, den die Sprechblase mindestens braucht (bei langen Texten) */
const BUBBLE_SPACE = 280;
const EDGE = 16;
const GAP = 14;
const PADDING = 6;
const START_DELAY_MS = 600;
const FIND_INTERVAL_MS = 150;
const FIND_ATTEMPTS = 20;

type Box = { top: number; left: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const sameBox = (a: Box | null, b: Box) =>
  !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * Einführung beim ersten Besuch einer Seite: hebt nacheinander Elemente mit
 * passendem data-tour-Attribut hervor und erklärt sie in einer Sprechblase.
 */
export default function Tour({ id }: { id: TourId }) {
  const { user } = useAuth();
  const { t, language } = useSettings();
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const steps = TOURS[id];
  const active = !!user && !dismissed && !(user.toursSeen ?? []).includes(id) && index < steps.length;

  const finish = useCallback(() => {
    setDismissed(true);
    apiFetch("/api/profile", { method: "PATCH", body: { action: "tourSeen", tour: id } }).catch(() => {});
  }, [id]);

  const next = useCallback(() => {
    if (index + 1 < steps.length) setIndex(index + 1);
    else finish();
  }, [index, steps.length, finish]);

  // Ziel-Element suchen und seine Position laufend verfolgen (Scrollen, Layout-Änderungen)
  useEffect(() => {
    if (!active) return;
    const selector = `[data-tour="${steps[index].target}"]`;
    let attempts = 0;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;

    const track = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const measured = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      setBox((prev) => (sameBox(prev, measured) ? prev : measured));
      frame = requestAnimationFrame(() => track(element));
    };

    const find = () => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        track(element);
      } else if (++attempts < FIND_ATTEMPTS) {
        timer = setTimeout(find, FIND_INTERVAL_MS);
      } else {
        // Element gibt es gerade nicht (z.B. noch keine Studenten) – Schritt überspringen
        next();
      }
    };

    timer = setTimeout(find, index === 0 ? START_DELAY_MS : 0);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [active, index, steps, next]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active || !box) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const width = Math.min(BUBBLE_WIDTH, viewportWidth - 2 * EDGE);
  const centerX = box.left + box.width / 2;
  const left = clamp(centerX - width / 2, EDGE, viewportWidth - width - EDGE);
  const arrowLeft = clamp(centerX - left, 20, width - 20);
  const spaceBelow = viewportHeight - (box.top + box.height + PADDING + GAP);
  const spaceAbove = box.top - PADDING - GAP;
  // Große Elemente (z.B. Formulare): Blase unten am Bildschirm fixieren, ohne Pfeil
  const placement =
    Math.max(spaceBelow, spaceAbove) < BUBBLE_SPACE ? "pinned" : spaceBelow >= spaceAbove ? "below" : "above";
  const position =
    placement === "below"
      ? { top: box.top + box.height + PADDING + GAP }
      : placement === "above"
        ? { bottom: viewportHeight - box.top + PADDING + GAP }
        : { bottom: EDGE };

  return createPortal(
    <div className="fixed inset-0 z-[900]" role="dialog" aria-modal="true" aria-label={step.title[language]}>
      {/* Abgedunkelter Hintergrund mit Aussparung um das erklärte Element */}
      <div
        className="fixed rounded-2xl outline-2 outline-[var(--accent)] transition-all duration-300 pointer-events-none"
        style={{
          top: box.top - PADDING,
          left: box.left - PADDING,
          width: box.width + 2 * PADDING,
          height: box.height + 2 * PADDING,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
        }}
      />

      <div
        className="fixed rounded-2xl border border-[var(--accent-40)] bg-[var(--surface)] text-[var(--text)] p-5 shadow-2xl animate-in fade-in zoom-in-95"
        style={{ left, width, ...position }}
      >
        {placement !== "pinned" && (
          <span
            className={`absolute w-3 h-3 rotate-45 bg-[var(--surface)] border-[var(--accent-40)] ${
              placement === "below" ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-r border-b"
            }`}
            style={{ left: arrowLeft - 6 }}
          />
        )}

        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-faint)] mb-2">
          {t("tour.step", { current: index + 1, total: steps.length })}
        </p>
        <p className="font-black italic uppercase tracking-tight text-[var(--accent-text)] mb-1.5">{step.title[language]}</p>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{step.text[language]}</p>

        <div className="flex items-center justify-between gap-3 mt-5">
          <button onClick={finish} className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] hover:text-[var(--text)] py-2">
            {t("tour.skip")}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex(index - 1)}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] active:scale-95 transition-all"
              >
                {t("tour.back")}
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              {isLast ? t("tour.done") : t("tour.next")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
