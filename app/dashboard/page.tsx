"use client";

import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSchedule } from "@/lib/useSchedule";
import {
  addDays, canSeeSlot, formatDate, getBookingWindow, hasSlotStarted, slotIdOf, suspendedOn,
  type BookingWindow, type Slot,
} from "@/lib/schedule";
import type { Booking } from "@/lib/types";
import ConfirmModal from "@/components/ConfirmModal";
import SuspendModal from "@/components/SuspendModal";
import StatusBadges from "@/components/StatusBadges";

const ADMIN_HISTORY_DAYS = 30;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  const isAdmin = !!user?.isAdmin;
  const { schedule, ready: scheduleReady } = useSchedule(!!uid);

  // States
  const [win, setWin] = useState<BookingWindow | null>(null);
  const [adminDate, setAdminDate] = useState<string | null>(null);
  const [dayCounts, setDayCounts] = useState<{ date: string; counts: Record<string, number> }>({ date: "", counts: {} });
  const [mine, setMine] = useState<{ date: string; booking: Booking | null }>({ date: "", booking: null });
  const [dayBookings, setDayBookings] = useState<{ date: string; items: Booking[] }>({ date: "", items: [] });
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [animatingSlot, setAnimatingSlot] = useState<{ slot: string; type: 'book' | 'cancel' } | null>(null);
  const [adminConfirmData, setAdminConfirmData] = useState<Booking | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ uid: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const showFeedback = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  // 1. Auth Guard Redirect
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  // 2. Zeit-Logik (Heim-Zeitzone): heute bis zum letzten Slot, Pause bis Buchungsstart, danach morgen
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

  // 3. Buchungs-Listener: Admin sieht alle Buchungen, Studenten nur Belegung + eigene Buchung
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

  const animate = (slot: string, type: 'book' | 'cancel') => {
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
    animate(slot.id, 'book');

    try {
      await apiFetch("/api/bookings", { method: "POST", body: { slotId: slot.id } });
      showFeedback("Gebucht");
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
    if (slotId) animate(slotId, 'cancel');

    try {
      await apiFetch("/api/bookings", { method: "DELETE", body: { bookingId: booking.id } });
      showFeedback(isAdmin ? "User entfernt" : "Storniert", "error");
    } catch (e) {
      setMine(previous.mine);
      setDayCounts(previous.dayCounts);
      setDayBookings(previous.dayBookings);
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase animate-pulse">Auth Check...</div>;
  if (!user) return null;
  if (!win || !date || !scheduleReady) return <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase animate-pulse">Auth Check...</div>;

  const bookings = dayBookings.date === date ? dayBookings.items : [];
  const counts = countsFor(date);
  const myBooking = mine.date === date ? mine.booking : null;

  const isSuspended = !isAdmin && suspendedOn(user, date);
  const isPause = !isAdmin && win.phase === "pause";
  const isSystemLocked = isSuspended || isPause;
  const tomorrow = addDays(win.today, 1);
  // Studenten sehen nur Slots, die sie buchen dürfen (16+, Mit Bestätigung)
  const visibleSlots = isAdmin ? schedule.slots : schedule.slots.filter((s) => canSeeSlot(user, s, date));

  const targetDateLabel = isAdmin
    ? date === win.today ? "HEUTE" : date === tomorrow ? "MORGEN" : "ARCHIV"
    : isSuspended ? "GESPERRT" : isPause ? "PAUSE" : win.phase === "tomorrow" ? "MORGEN" : "HEUTE";

  const statusChip = isSuspended
    ? `Bis ${formatDate(user.suspendedUntil!, { day: '2-digit', month: 'long' })}`
    : isPause
      ? `Ab ${schedule.opensAt} für morgen`
      : formatDate(date, { day: '2-digit', month: 'long', year: 'numeric' });

  const minAdminDate = addDays(win.today, -ADMIN_HISTORY_DAYS);
  const shiftDate = (days: number) => {
    const next = addDays(date, days);
    if (next < minAdminDate || next > tomorrow) return;
    setAdminDate(next);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <header className="flex justify-between items-start gap-4 mb-10 sm:mb-12 pt-4 relative z-50">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] sm:text-3xl font-black italic tracking-tighter text-[#deff9a] whitespace-nowrap">GYM LOG</h1>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1 truncate">
                {isAdmin ? (user.isSuperAdmin ? "Superadmin-Konsole" : "Admin-Konsole") : `${user.name}${user.room ? ` · ${user.room}` : ""}`}
            </p>
            {!isAdmin && (
              <div className="mt-2">
                <StatusBadges profile={user} date={win.today} />
              </div>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3 shrink-0 pt-1">
            {isAdmin && (
              <button onClick={() => router.push("/gym-admin-control")} className="px-3.5 sm:px-5 py-2.5 border border-[#deff9a]/30 bg-[#deff9a]/5 rounded-full text-[10px] font-black text-[#deff9a] active:scale-95 transition-all uppercase tracking-wider sm:tracking-widest">Verwaltung</button>
            )}
            <button onClick={async () => { await auth.signOut(); router.replace("/"); }} className="px-3.5 sm:px-5 py-2.5 border border-zinc-800 rounded-full text-[10px] font-black text-zinc-400 active:text-white uppercase transition-all">Logout</button>
          </div>
        </header>

        {/* Date Navigator */}
        {isAdmin && (
          <div className="flex items-center justify-between mb-6 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl shadow-xl">
            <button onClick={() => shiftDate(-1)} disabled={date <= minAdminDate} className={`w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl transition-all ${date <= minAdminDate ? 'text-zinc-800' : 'text-[#deff9a] active:bg-zinc-800'}`}>←</button>
            <div className="text-center">
              <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[#deff9a] block mb-1">{formatDate(date, { weekday: 'long' })}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 block">{bookings.length} Buchungen</span>
            </div>
            <button onClick={() => shiftDate(1)} disabled={date >= tomorrow} className={`w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl transition-all ${date >= tomorrow ? 'text-zinc-800' : 'text-[#deff9a] active:bg-zinc-800'}`}>→</button>
          </div>
        )}

        {/* Status Card */}
        <div className={`mb-8 sm:mb-10 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] border transition-all duration-700 text-center relative overflow-hidden shadow-2xl ${
          isSystemLocked ? "bg-red-950/20 border-red-900/50" : "bg-zinc-900 border-zinc-800"
        }`}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute -inset-[100%] opacity-30 animate-slow-spin ${isSystemLocked ? "bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" : "bg-[radial-gradient(ellipse_at_center,#deff9a_0%,transparent_70%)]"}`} style={{ filter: 'blur(60px)', borderRadius: '40%' }}></div>
          </div>
          <div className="relative z-10">
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.4em] mb-3 leading-none">Status</p>
            <h2 className={`${targetDateLabel.length > 6 ? "text-5xl sm:text-6xl" : "text-6xl"} font-black italic uppercase tracking-tighter mb-5 transition-colors ${isSystemLocked ? "text-red-500" : "text-white"}`}>{targetDateLabel}</h2>
            <div className="inline-block px-5 py-2 rounded-full bg-black/40 border border-[#deff9a]/20 text-[#deff9a] text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                {statusChip}
            </div>
            {isSuspended && user.suspendReason && (
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-5 leading-relaxed">{user.suspendReason}</p>
            )}
          </div>
        </div>

        {/* Slots */}
        <div className={`space-y-4 transition-all duration-500 ${isSystemLocked ? "opacity-20 grayscale pointer-events-none" : "opacity-100"}`}>
          {visibleSlots.length === 0 && (
            <p className="text-center text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] py-10">Keine Slots verfügbar</p>
          )}
          {visibleSlots.map((slot) => {
            const slotBookings = bookings.filter((b) => slotIdOf(schedule, b) === slot.id);
            const count = isAdmin ? slotBookings.length : counts[slot.id] ?? 0;
            const isMySlot = !isAdmin && !!myBooking && slotIdOf(schedule, myBooking) === slot.id;
            const isAnimatingBook = animatingSlot?.slot === slot.id && animatingSlot.type === 'book';
            const isAnimatingCancel = animatingSlot?.slot === slot.id && animatingSlot.type === 'cancel';
            const isStarted = hasSlotStarted(win, date, slot);
            const isFull = count >= slot.capacity;

            return (
              <div key={slot.id} className={`flex flex-col p-5 sm:p-6 rounded-[2.5rem] border transition-all duration-500 ${
                isMySlot ? "border-[#deff9a]/50 bg-[#deff9a]/5 shadow-xl" : "border-zinc-800/50 bg-zinc-900/40"
              } ${isAnimatingBook ? "shine-effect" : ""} ${isAnimatingCancel ? "shine-reverse-effect" : ""} ${isStarted && !isMySlot && !isAdmin ? "opacity-40" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="text-2xl sm:text-3xl font-black italic tracking-tighter block">{slot.label}</span>
                      {slot.minAge && (
                        <span className="px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-500 text-[9px] font-black uppercase tracking-widest">{slot.minAge}+</span>
                      )}
                      {slot.requiresApproval && (
                        <span className="px-2.5 py-1 rounded-full border border-[#deff9a]/30 text-[#deff9a] text-[9px] font-black uppercase tracking-widest">Bestätigung</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex flex-wrap gap-1.5">
                        {[...Array(slot.capacity)].map((_, i) => (
                          <div key={i} className={`w-3 h-3 rounded-full transition-colors duration-500 ${i < count ? (isMySlot ? "bg-[#deff9a]" : "bg-white") : "bg-zinc-800"}`} />
                        ))}
                      </div>
                      <span className="text-lg sm:text-[20px] uppercase text-zinc-500 font-black tracking-widest shrink-0">{count}/{slot.capacity}</span>
                    </div>
                  </div>
                  {!isAdmin && (
                    isMySlot ? (
                      isStarted ? (
                        <span className="shrink-0 px-5 sm:px-6 py-4 bg-[#deff9a]/10 text-[#deff9a] border border-[#deff9a]/20 rounded-2xl font-black text-[10px] uppercase tracking-widest">Dein Slot</span>
                      ) : (
                        <button onClick={() => setShowConfirm(true)} disabled={busy} className="shrink-0 px-5 sm:px-6 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-[10px] uppercase active:scale-95 outline-none transition-all">Storno</button>
                      )
                    ) : (
                      <button disabled={isFull || !!myBooking || isSystemLocked || isStarted || busy}
                        onClick={() => handleBooking(slot)}
                        className={`shrink-0 px-6 sm:px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all outline-none ${
                          isFull || !!myBooking || isStarted ? "bg-zinc-800 text-zinc-600" : "bg-[#deff9a] text-black active:scale-90 shadow-lg"
                        }`}>{isStarted ? "Vorbei" : isFull ? "FULL" : "Buchen"}</button>
                    )
                  )}
                </div>

                {/* Admin-Info: Teilnehmerliste */}
                {isAdmin && slotBookings.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-zinc-800/50 space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                            {slotBookings.map((b) => (
                                <div key={b.id} className="flex items-center justify-between gap-3 bg-black/40 border border-zinc-800 p-4 rounded-2xl">
                                    <div className="min-w-0">
                                      <span className="text-lg font-black uppercase tracking-tight text-[#deff9a] block truncate">{b.name ?? b.username}</span>
                                      {b.room && <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Zimmer {b.room}</span>}
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      {b.uid && (
                                        <button onClick={() => setSuspendTarget({ uid: b.uid, name: b.name ?? b.username })} className="h-10 px-3 flex items-center justify-center bg-zinc-800/60 border border-zinc-700 text-zinc-400 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-90 transition-all">Sperren</button>
                                      )}
                                      <button onClick={() => setAdminConfirmData(b)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black active:scale-90 transition-all">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Admin Bestätigung */}
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

      {/* Modal: User Storno */}
      {showConfirm && myBooking && (
        <ConfirmModal
          title="Abbrechen?"
          text="Training absagen?"
          confirmLabel="Storno"
          busy={busy}
          z="z-[300]"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => cancelBooking(myBooking)}
        />
      )}

      {/* Modal: Student sperren */}
      {suspendTarget && (
        <SuspendModal student={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={showFeedback} />
      )}

      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === 'success' ? "bg-black border-[#deff9a] text-[#deff9a]" : "bg-black border-red-500 text-red-500"
          }`}>
            <span className="relative z-10">{statusMsg.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
