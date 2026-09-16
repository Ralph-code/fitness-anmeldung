"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { CalendarDays, House, School } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { formatDate, zonedNow } from "@/lib/schedule";
import {
  DEFAULT_OPENING, dayStatus, normalizeOpening, weekdayOf, type CalendarEntry, type DayStatus, type Opening,
} from "@/lib/opening";
import AppShell from "@/components/AppShell";
import { Badge, CARD, EmptyState, HINT, SectionTitle } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");

export default function KalenderPage() {
  const { user } = useAuth();
  const { t, locale } = useSettings();
  const uid = user?.uid;

  const [opening, setOpening] = useState<Opening>(DEFAULT_OPENING);
  const [entries, setEntries] = useState<Record<string, CalendarEntry>>({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const today = zonedNow().date;

  // Wochentagsnamen in der gewählten Sprache
  const weekdayName = (weekday: number, style: "long" | "short") =>
    new Date(Date.UTC(2026, 8, 13 + weekday)).toLocaleDateString(locale, { weekday: style, timeZone: "UTC" });

  const describe = (status: DayStatus) => {
    if (status.state === "closed") return t("day.closed");
    if (status.state === "opens") return t("day.opensAt", { time: status.openTime ?? "" });
    if (status.state === "closes") return t("day.closesAt", { time: status.closeTime ?? "" });
    return t("day.open");
  };

  const month = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 + monthOffset, 1));
    const year = first.getUTCFullYear();
    const index = first.getUTCMonth();
    const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
    const firstDate = `${year}-${pad(index + 1)}-01`;
    return {
      year,
      index,
      days,
      firstDate,
      lastDate: `${year}-${pad(index + 1)}-${pad(days)}`,
      label: new Date(Date.UTC(year, index, 1)).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
      leading: (weekdayOf(firstDate) + 6) % 7, // Montag zuerst
    };
  }, [today, monthOffset, locale]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "settings", "opening"),
      (snap) => setOpening(snap.exists() ? normalizeOpening(snap.data()) : DEFAULT_OPENING),
      (err) => console.warn("Öffnungszeiten:", err.message)
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "calendar"), where("date", ">=", month.firstDate), where("date", "<=", month.lastDate)),
      (snap) => {
        const byDate: Record<string, CalendarEntry> = {};
        snap.docs.forEach((d) => (byDate[d.id] = d.data() as CalendarEntry));
        setEntries(byDate);
      },
      (err) => { console.warn("Kalender:", err.message); setEntries({}); }
    );
  }, [uid, month.firstDate, month.lastDate]);

  const days = Array.from({ length: month.days }, (_, i) => `${month.year}-${pad(month.index + 1)}-${pad(i + 1)}`);
  const selectedStatus = selected ? dayStatus(selected, opening, entries[selected]) : null;
  const upcoming = Object.values(entries)
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <AppShell title={t("calendar.title")} subtitle={t("calendar.subtitle")}>
      {/* Öffnungszeiten */}
      <div className={`${CARD} mb-6`}>
        <div className="flex items-start gap-3">
          <House size={18} className="text-[var(--accent-text)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-[var(--text)] mb-1">{t("calendar.openTitle")}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {t("calendar.openRange", {
                openDay: weekdayName(opening.openDay, "long"),
                openTime: opening.openTime,
                closeDay: weekdayName(opening.closeDay, "long"),
                closeTime: opening.closeTime,
              })}
            </p>
            <p className={`${HINT} mt-1`}>{t("calendar.openHint")}</p>
          </div>
        </div>
      </div>

      {/* Monat */}
      <div className="flex items-center justify-between mb-4 bg-[var(--surface)] border border-[var(--border)] p-2 rounded-2xl">
        <button onClick={() => setMonthOffset(monthOffset - 1)} className="w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl text-[var(--accent-text)] active:bg-[var(--surface-2)]">←</button>
        <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--accent-text)]">{month.label}</span>
        <button onClick={() => setMonthOffset(monthOffset + 1)} className="w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl text-[var(--accent-text)] active:bg-[var(--surface-2)]">→</button>
      </div>

      <div className={`${CARD} mb-4`}>
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <span key={wd} className="text-center text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">
              {weekdayName(wd, "short")}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: month.leading }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((date) => {
            const status = dayStatus(date, opening, entries[date]);
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <button
                key={date}
                onClick={() => setSelected(isSelected ? null : date)}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                  status.state === "closed"
                    ? "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-faint)]"
                    : status.state === "open"
                      ? "border-[var(--accent-20)] bg-[var(--accent-05)] text-[var(--text)]"
                      : "border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent-text)]"
                } ${isToday ? "ring-2 ring-[var(--accent)]" : ""} ${isSelected ? "border-[var(--text)]" : ""}`}
              >
                <span className="text-sm font-black">{Number(date.slice(8))}</span>
                <span className="flex gap-0.5 h-1.5 mt-0.5">
                  {status.schoolFree && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  {status.exception && !status.schoolFree && <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-[var(--border-soft)] text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[var(--accent-10)] border border-[var(--accent-40)]" /> {t("calendar.legendEdge")}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[var(--accent-05)] border border-[var(--accent-20)]" /> {t("calendar.legendOpen")}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[var(--surface)] border border-[var(--border)]" /> {t("calendar.legendClosed")}</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {t("calendar.legendSchoolFree")}</span>
        </div>
      </div>

      {/* Tagesdetails */}
      {selectedStatus && (
        <div className={`${CARD} mb-6 animate-in fade-in`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-text)]">
              {formatDate(selectedStatus.date, { weekday: "long", day: "2-digit", month: "long" }, locale)}
            </span>
            <div className="flex gap-1.5">
              {selectedStatus.schoolFree && <Badge tone="amber">{t("calendar.schoolFree")}</Badge>}
              <Badge tone={selectedStatus.state === "closed" ? "red" : "lime"}>{describe(selectedStatus)}</Badge>
            </div>
          </div>
          {selectedStatus.label && <p className="text-sm text-[var(--text)] font-bold">{selectedStatus.label}</p>}
          {selectedStatus.note && <p className="text-sm text-[var(--text-muted)] leading-relaxed mt-1">{selectedStatus.note}</p>}
          {!selectedStatus.label && !selectedStatus.note && <p className={HINT}>{t("calendar.noInfo")}</p>}
        </div>
      )}

      {/* Kommende Termine */}
      <SectionTitle title={t("calendar.upcoming")} icon={<CalendarDays size={14} />} />
      {upcoming.length === 0 ? (
        <div className={CARD}><EmptyState>{t("calendar.noEntries")}</EmptyState></div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((entry) => {
            const status = dayStatus(entry.date, opening, entry);
            return (
              <div key={entry.date} className={`${CARD} flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--text)] truncate">
                    {entry.label || (entry.schoolFree ? t("calendar.schoolFree") : describe(status))}
                  </p>
                  <p className={HINT}>
                    {formatDate(entry.date, { weekday: "short", day: "2-digit", month: "long" }, locale)}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {entry.schoolFree && <School size={14} className="text-amber-400" />}
                  <Badge tone={status.state === "closed" ? "red" : "lime"}>{describe(status)}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
