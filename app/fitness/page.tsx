"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { useSchedule } from "@/lib/useSchedule";
import {
  addDays, formatDate, getBookingWindow, hasSlotStarted, canSeeSlot, slotIdOf, suspendedOn,
  type BookingWindow, type Slot,
} from "@/lib/schedule";
import type { Booking } from "@/lib/types";
import AppShell from "@/components/AppShell";
import ConfirmModal from "@/components/ConfirmModal";
import SuspendModal from "@/components/SuspendModal";
import { Badge, CARD, EmptyState } from "@/components/ui";

const ADMIN_HISTORY_DAYS = 30;

export default function FitnessPage() {
  const { user } = useAuth();
  const { t, locale } = useSettings();
  const uid = user?.uid;
  const isAdmin = !!user?.isAdmin;
  const { schedule, ready: scheduleReady } = useSchedule(!!uid);

  const [win, setWin] = useState<BookingWindow | null>(null);
  const [adminDate, setAdminDate] = useState<string | null>(null);
  const [dayCounts, setDayCounts] = useState<{ date: string; counts: Record<string, number> }>({ date: "", counts: {} });
  const [mine, setMine] = useState<{ date: string; booking: Booking | null }>({ date: "", booking: null });
  const [dayBookings, setDayBookings] = useState<{ date: string; items: Booking[] }>({ date: "", items: [] });
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [animatingSlot, setAnimatingSlot] = useState<{ slot: string; type: "book" | "cancel" } | null>(null);
  const [adminConfirmData, setAdminConfirmData] = useState<Booking | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ uid: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  // Zeit-Logik (Heim-Zeitzone): heute bis zum letzten Slot, Pause bis Buchungsstart, danach morgen
  useEffect(() => {
    const tick = () => setWin((prev) => {
      const next = getBookingWindow(schedule);
      return prev && prev.phase === next.phase && prev.date === next.date && prev.nowMinutes === next.nowMinutes ? prev : next;
    });
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [schedule]);

  const date = !win ? null : isAdmin ? adminDate ?? (win.phase === "tomorrow" ? win.date : win.today) : win.date;

  // Admin sieht alle Buchungen, Studenten nur Belegung + eigene Buchung
  useEffect(() => {
    if (!uid || !date) return;
    if (isAdmin) {
      return onSnapshot(
        query(collection(db, "bookings"), where("date", "==", date)),
        (snap) => setDayBookings({ date, items: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking) }),
        (err) => console.warn("Buchungen:", err.message)
      );
    }
    const unsubDay = onSnapshot(
      doc(db, "days", date),
      (snap) => setDayCounts({ date, counts: snap.data()?.counts ?? {} }),
      (err) => console.warn("Belegung:", err.message)
    );
    const unsubMine = onSnapshot(
      doc(db, "bookings", `${date}_${uid}`),
      (snap) => setMine({ date, booking: snap.exists() ? ({ id: snap.id, ...snap.data() } as Booking) : null }),
      (err) => console.warn("Eigene Buchung:", err.message)
    );
    return () => { unsubDay(); unsubMine(); };
  }, [uid, isAdmin, date]);

  const animate = (slot: string, type: "book" | "cancel") => {
    setAnimatingSlot({ slot, type });
    setTimeout(() => setAnimatingSlot(null), 1000);
  };
  const countsFor = (d: string) => (dayCounts.date === d ? dayCounts.counts : {});

  const handleBooking = async (slot: Slot) => {
    if (busy || !user || !date) return;
    setBusy(true);
    const previous = { mine, dayCounts };
    const counts = countsFor(date);

    // Sofort anzeigen – der Server bestätigt im Hintergrund, bei Fehler wird zurückgesetzt
    setMine({ date, booking: { id: `${date}_${user.uid}`, uid: user.uid, name: user.name, username: user.username, room: user.room ?? "", date, slotId: slot.id, slot: slot.label } });
    setDayCounts({ date, counts: { ...counts, [slot.id]: (counts[slot.id] ?? 0) + 1 } });
    animate(slot.id, "book");

    try {
      await apiFetch("/api/bookings", { method: "POST", body: { slotId: slot.id } });
      showFeedback(t("fitness.booked"));
    } catch (e) {
      setMine(previous.mine);
      setDayCounts(previous.dayCounts);
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = async (booking: Booking) => {
    if (busy) return;
    setBusy(true);
    const previous = { mine, dayCounts, dayBookings };
    const slotId = slotIdOf(schedule, booking);

    setShowConfirm(false);
    setAdminConfirmData(null);
    if (isAdmin) {
      setDayBookings({ date: dayBookings.date, items: dayBookings.items.filter((b) => b.id !== booking.id) });
    } else {
      const counts = countsFor(booking.date);
      setMine({ date: booking.date, booking: null });
      if (slotId) setDayCounts({ date: booking.date, counts: { ...counts, [slotId]: Math.max(0, (counts[slotId] ?? 1) - 1) } });
    }
    if (slotId) animate(slotId, "cancel");

    try {
      await apiFetch("/api/bookings", { method: "DELETE", body: { bookingId: booking.id } });
      showFeedback(isAdmin ? "Entfernt" : t("fitness.cancelled"), "error");
    } catch (e) {
      setMine(previous.mine);
      setDayCounts(previous.dayCounts);
      setDayBookings(previous.dayBookings);
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!user || !win || !date || !scheduleReady) {
    return <AppShell title={t("fitness.title")}><EmptyState>{t("app.loading")}</EmptyState></AppShell>;
  }

  const bookings = dayBookings.date === date ? dayBookings.items : [];
  const counts = countsFor(date);
  const myBooking = mine.date === date ? mine.booking : null;

  const isSuspended = !isAdmin && suspendedOn(user, date);
  const isPause = !isAdmin && win.phase === "pause";
  const isSystemLocked = isSuspended || isPause;
  const tomorrow = addDays(win.today, 1);
  const visibleSlots = isAdmin ? schedule.slots : schedule.slots.filter((s) => canSeeSlot(user, s, date));

  const statusLabel = isAdmin
    ? date === win.today ? t("fitness.today") : date === tomorrow ? t("fitness.tomorrow") : t("fitness.archive")
    : isSuspended ? t("fitness.blocked") : isPause ? t("fitness.pause") : win.phase === "tomorrow" ? t("fitness.tomorrow") : t("fitness.today");

  const statusChip = isSuspended
    ? t("fitness.blockedUntil", { date: formatDate(user.suspendedUntil!, { day: "2-digit", month: "long" }, locale) })
    : isPause
      ? t("fitness.bookingFrom", { time: schedule.opensAt })
      : formatDate(date, { day: "2-digit", month: "long", year: "numeric" }, locale);

  const minAdminDate = addDays(win.today, -ADMIN_HISTORY_DAYS);
  const shiftDate = (days: number) => {
    const next = addDays(date, days);
    if (next < minAdminDate || next > tomorrow) return;
    setAdminDate(next);
  };

  return (
    <AppShell title={t("fitness.title")} subtitle={isAdmin ? t("fitness.subtitleAdmin") : t("fitness.subtitleStudent")}>
      {/* Datum-Navigation für Admins */}
      {isAdmin && (
        <div className="flex items-center justify-between mb-5 bg-[var(--surface)] border border-[var(--border)] p-2 rounded-2xl">
          <button onClick={() => shiftDate(-1)} disabled={date <= minAdminDate} className={`w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl transition-all ${date <= minAdminDate ? "text-[var(--text-faint)]" : "text-[var(--accent-text)] active:bg-[var(--surface-2)]"}`}>←</button>
          <div className="text-center">
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--accent-text)] block mb-1">{formatDate(date, { weekday: "long" }, locale)}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)] block">{t("fitness.bookings", { count: bookings.length })}</span>
          </div>
          <button onClick={() => shiftDate(1)} disabled={date >= tomorrow} className={`w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl transition-all ${date >= tomorrow ? "text-[var(--text-faint)]" : "text-[var(--accent-text)] active:bg-[var(--surface-2)]"}`}>→</button>
        </div>
      )}

      {/* Status */}
      <div className={`mb-8 p-8 rounded-[2.5rem] border text-center relative overflow-hidden ${isSystemLocked ? "bg-[var(--danger-soft)] border-[var(--danger-border)]" : "bg-[var(--surface)] border-[var(--border)]"}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -inset-[100%] opacity-30 animate-slow-spin ${isSystemLocked ? "bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" : "bg-[radial-gradient(ellipse_at_center,var(--accent)_0%,transparent_70%)]"}`} style={{ filter: "blur(60px)", borderRadius: "40%" }}></div>
        </div>
        <div className="relative z-10">
          <p className="text-[var(--text-dim)] text-[10px] uppercase font-black tracking-[0.4em] mb-3 leading-none">{t("fitness.status")}</p>
          <h2 className={`text-5xl sm:text-6xl font-black italic uppercase tracking-tighter mb-5 ${isSystemLocked ? "text-red-500" : "text-[var(--text)]"}`}>{statusLabel}</h2>
          <div className="inline-block px-5 py-2 rounded-full bg-[var(--inset)] border border-[var(--accent-20)] text-[var(--accent-text)] text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
            {statusChip}
          </div>
          {isSuspended && user.suspendReason && (
            <p className="text-[var(--text-muted)] text-xs mt-5 leading-relaxed">{user.suspendReason}</p>
          )}
        </div>
      </div>

      {/* Slots */}
      <div className={`space-y-3 transition-all duration-500 ${isSystemLocked ? "opacity-20 grayscale pointer-events-none" : "opacity-100"}`}>
        {visibleSlots.length === 0 && (
          <div className={CARD}><EmptyState>{t("fitness.noSlots")}</EmptyState></div>
        )}
        {visibleSlots.map((slot) => {
          const slotBookings = bookings.filter((b) => slotIdOf(schedule, b) === slot.id);
          const count = isAdmin ? slotBookings.length : counts[slot.id] ?? 0;
          const isMySlot = !isAdmin && !!myBooking && slotIdOf(schedule, myBooking) === slot.id;
          const isAnimatingBook = animatingSlot?.slot === slot.id && animatingSlot.type === "book";
          const isAnimatingCancel = animatingSlot?.slot === slot.id && animatingSlot.type === "cancel";
          const isStarted = hasSlotStarted(win, date, slot);
          const isFull = count >= slot.capacity;

          return (
            <div key={slot.id} className={`flex flex-col p-5 rounded-3xl border transition-all duration-500 ${
              isMySlot ? "border-[var(--accent-50)] bg-[var(--accent-05)]" : "border-[var(--border-soft)] bg-[var(--surface-soft)]"
            } ${isAnimatingBook ? "shine-effect" : ""} ${isAnimatingCancel ? "shine-reverse-effect" : ""} ${isStarted && !isMySlot && !isAdmin ? "opacity-40" : ""}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-2xl sm:text-3xl font-black italic tracking-tighter">{slot.label}</span>
                    {slot.minAge && <Badge>{slot.minAge}+</Badge>}
                    {slot.requiresApproval && <Badge tone="lime">{t("fitness.approvalNeeded")}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {[...Array(slot.capacity)].map((_, i) => (
                        <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${i < count ? (isMySlot ? "bg-[var(--accent)]" : "bg-white") : "bg-[var(--surface-2)]"}`} />
                      ))}
                    </div>
                    <span className="text-sm text-[var(--text-dim)] font-black tracking-wider shrink-0">{count}/{slot.capacity}</span>
                  </div>
                </div>
                {!isAdmin && (
                  isMySlot ? (
                    isStarted ? (
                      <span className="shrink-0 px-5 py-4 bg-[var(--accent-10)] text-[var(--accent-text)] border border-[var(--accent-20)] rounded-2xl font-black text-[10px] uppercase tracking-widest">{t("fitness.mySlot")}</span>
                    ) : (
                      <button onClick={() => setShowConfirm(true)} disabled={busy} className="shrink-0 px-5 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all">{t("fitness.cancel")}</button>
                    )
                  ) : (
                    <button disabled={isFull || !!myBooking || isSystemLocked || isStarted || busy}
                      onClick={() => handleBooking(slot)}
                      className={`shrink-0 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        isFull || !!myBooking || isStarted ? "bg-[var(--surface-2)] text-[var(--text-faint)]" : "bg-[var(--accent)] text-[var(--accent-contrast)] active:scale-90"
                      }`}>{isStarted ? t("fitness.over") : isFull ? t("fitness.full") : t("fitness.book")}</button>
                  )
                )}
              </div>

              {/* Teilnehmerliste für Admins */}
              {isAdmin && slotBookings.length > 0 && (
                <div className="mt-5 pt-5 border-t border-[var(--border-soft)] grid grid-cols-1 gap-2">
                  {slotBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-3 bg-[var(--inset)] border border-[var(--border)] p-3.5 rounded-2xl">
                      <div className="min-w-0">
                        <span className="text-base font-black uppercase tracking-tight text-[var(--accent-text)] block truncate">{b.name ?? b.username}</span>
                        {b.room && <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Zimmer {b.room}</span>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {b.uid && (
                          <button onClick={() => setSuspendTarget({ uid: b.uid, name: b.name ?? b.username })} className="h-10 px-3 flex items-center justify-center bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text-muted)] rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-90 transition-all">Sperren</button>
                        )}
                        <button onClick={() => setAdminConfirmData(b)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black active:scale-90 transition-all">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adminConfirmData && (
        <ConfirmModal
          title={adminConfirmData.name ?? adminConfirmData.username}
          text="Aus dem Slot entfernen?"
          confirmLabel="Entfernen"
          busy={busy}
          onCancel={() => setAdminConfirmData(null)}
          onConfirm={() => cancelBooking(adminConfirmData)}
        />
      )}

      {showConfirm && myBooking && (
        <ConfirmModal
          title={t("fitness.cancelTitle")}
          text={t("fitness.cancelText")}
          confirmLabel={t("fitness.cancel")}
          busy={busy}
          z="z-[300]"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => cancelBooking(myBooking)}
        />
      )}

      {suspendTarget && (
        <SuspendModal student={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={showFeedback} />
      )}

      {statusMsg && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === "success" ? "bg-[var(--bg)] border-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg)] border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </AppShell>
  );
}
