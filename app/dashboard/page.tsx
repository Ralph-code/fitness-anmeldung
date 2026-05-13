"use client";

import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, query, where, addDoc, onSnapshot, 
  deleteDoc, doc 
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const SLOTS = ["06:00-07:00", "13:30-14:30", "14:30-15:30", "15:30-16:30", "16:30-17:30", "17:30-18:30", "18:30-19:30", "19:30-20:30", "20:30-21:30"];
const MAX_CAPACITY = 6;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // States
  const [bookings, setBookings] = useState<any[]>([]);
  const [myBookingId, setMyBookingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [config, setConfig] = useState({ lockTime: "21:15", endTime: "20:30" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [animatingSlot, setAnimatingSlot] = useState<{ slot: string; type: 'book' | 'cancel' } | null>(null);

  // Admin States
  const [viewDate, setViewDate] = useState(new Date());
  const [targetDateLabel, setTargetDateLabel] = useState(""); 
  const [dateStr, setDateStr] = useState(""); 
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [adminConfirmData, setAdminConfirmData] = useState<{id: string, name: string} | null>(null);

  const showFeedback = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  // 1. Auth Guard Redirect
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  // 2. Firebase Config Listener
  useEffect(() => {
    if (!user) return;
    const unsubConfig = onSnapshot(doc(db, "settings", "gym_config"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(prev => {
          if (prev.lockTime === data.lockTime && prev.endTime === data.endTime) return prev;
          return { lockTime: data.lockTime || "21:15", endTime: data.endTime || "20:30" };
        });
      }
    });
    return () => unsubConfig();
  }, [user]);

  // 3. Zeit-Logik
  useEffect(() => {
    const updateTarget = () => {
      const now = new Date(); // Heute
      const [lockH, lockM] = config.lockTime.split(":").map(Number);
      const [endH, endM] = config.endTime.split(":").map(Number);
      const limitStartMorgen = new Date(); limitStartMorgen.setHours(lockH, lockM, 0);
      const limitEndeHeute = new Date(); limitEndeHeute.setHours(endH, endM, 0);
      
      let calculatedDate = new Date(viewDate);
      const isViewingToday = viewDate.toDateString() === now.toDateString();

      if (isViewingToday) {
        if (now >= limitEndeHeute && now < limitStartMorgen) {
          setIsSystemLocked(true); setTargetDateLabel("PAUSE"); setDateStr("LOCKED");
        } else if (now >= limitStartMorgen) {
          setIsSystemLocked(false); setTargetDateLabel("MORGEN");
          calculatedDate.setDate(calculatedDate.getDate() + 2);
          setDateStr(calculatedDate.toISOString().split('T')[0]);
        } else {
          setIsSystemLocked(false); setTargetDateLabel("HEUTE");
          setDateStr(calculatedDate.toISOString().split('T')[0]);
        }
      } else {
        setIsSystemLocked(false);
        setTargetDateLabel("ARCHIV");
        setDateStr(viewDate.toISOString().split('T')[0]);
      }
    };
    updateTarget();
    const timer = setInterval(updateTarget, 10000);
    return () => clearInterval(timer);
  }, [config.lockTime, config.endTime, viewDate]);

  // 4. Buchungs-Listener
  useEffect(() => {
    if (!user || !dateStr || dateStr === "LOCKED") {
      setBookings([]);
      setMyBookingId(null);
      return;
    }
    const q = query(collection(db, "bookings"), where("date", "==", dateStr));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(docs);
      const myDoc = docs.find((b: any) => b.userId === user?.uid);
      setMyBookingId(myDoc ? myDoc.id : null);
    });
    return () => unsub();
  }, [dateStr, user?.uid]);

  const shiftDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + days);
    const today = new Date();
    const minDate = new Date(); minDate.setDate(minDate.getDate() - 7);
    if (newDate < minDate && days < 0) return;
    if (newDate > today && days > 0) return;
    setViewDate(newDate);
  };

  const handleBooking = async (slot: string, index: number) => {
    if (user?.isAdmin || isSystemLocked || myBookingId) return;
    try {
      await addDoc(collection(db, "bookings"), {
        userId: user?.uid, username: user?.username,
        date: dateStr, slot, createdAt: new Date()
      });
      setAnimatingSlot({ slot, type: 'book' });
      showFeedback(`Gebucht`);
      setTimeout(() => setAnimatingSlot(null), 1000);
    } catch (e) { showFeedback("Fehler", "error"); }
  };

  const cancelBooking = async (id: string) => {
    const slotName = bookings.find(b => b.id === id)?.slot;
    try {
      await deleteDoc(doc(db, "bookings", id));
      if (slotName) setAnimatingSlot({ slot: slotName, type: 'cancel' });
      showFeedback(user?.isAdmin ? "User entfernt" : "Storniert", "error");
      setShowConfirm(false);
      setAdminConfirmData(null);
      setTimeout(() => setAnimatingSlot(null), 1000);
    } catch (e) { showFeedback("Fehler", "error"); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase animate-pulse">Auth Check...</div>;
  if (!user) return null;

  const userAge = user?.birthYear ? (new Date().getFullYear() - user.birthYear) : null;
  const isViewingToday = viewDate.toDateString() === new Date().toDateString();

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-12 pt-4 relative z-50">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-[#deff9a]">GYM LOG</h1>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                {user?.isAdmin ? "Admin-Konsole" : `${user?.username} (${userAge ?? '?'} J.)`}
            </p>
          </div>
          <div className="flex gap-3">
            {user?.isAdmin && (
              <button onClick={() => router.push("/gym-admin-control")} className="px-5 py-2.5 border border-[#deff9a]/30 bg-[#deff9a]/5 rounded-full text-[10px] font-black text-[#deff9a] active:scale-95 transition-all uppercase tracking-widest">Einstellungen</button>
            )}
            <button onClick={async () => { await auth.signOut(); router.replace("/"); }} className="px-5 py-2.5 border border-zinc-800 rounded-full text-[10px] font-black text-zinc-400 active:text-white uppercase transition-all">Logout</button>
          </div>
        </header>

        {/* Date Navigator */}
        {user?.isAdmin && (
          <div className="flex items-center justify-between mb-6 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl shadow-xl">
            <button onClick={() => shiftDate(-1)} className="w-12 h-12 flex items-center justify-center text-[#deff9a] text-xl font-black active:bg-zinc-800 rounded-xl transition-all">←</button>
            <div className="text-center">
              <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[#deff9a] block mb-1">{viewDate.toLocaleDateString('de-DE', { weekday: 'long' })}</span>
            </div>
            <button onClick={() => shiftDate(1)} disabled={isViewingToday} className={`w-12 h-12 flex items-center justify-center text-xl font-black rounded-xl transition-all ${isViewingToday ? 'text-zinc-800' : 'text-[#deff9a] active:bg-zinc-800'}`}>→</button>
          </div>
        )}

        {/* Status Card */}
        <div className={`mb-10 p-10 rounded-[3rem] border transition-all duration-700 text-center relative overflow-hidden shadow-2xl ${
          isSystemLocked ? "bg-red-950/20 border-red-900/50" : "bg-zinc-900 border-zinc-800"
        }`}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute -inset-[100%] opacity-30 animate-slow-spin ${isSystemLocked ? "bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" : "bg-[radial-gradient(ellipse_at_center,#deff9a_0%,transparent_70%)]"}`} style={{ filter: 'blur(60px)', borderRadius: '40%' }}></div>
          </div>
          <div className="relative z-10">
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.4em] mb-3 leading-none">Status</p>
            <h2 className={`text-6xl font-black italic uppercase tracking-tighter mb-5 transition-colors ${isSystemLocked ? "text-red-500" : "text-white"}`}>{targetDateLabel}</h2>
            <div className="inline-block px-5 py-2 rounded-full bg-black/40 border border-[#deff9a]/20 text-[#deff9a] text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                {dateStr !== "LOCKED" ? new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : "System gesperrt"}
            </div>
          </div>
        </div>

        {/* Slots */}
        <div className={`space-y-4 transition-all duration-500 ${isSystemLocked && !user?.isAdmin ? "opacity-20 grayscale pointer-events-none" : "opacity-100"}`}>
          {SLOTS.map((slot, index) => {
            const slotBookings = bookings.filter(b => b.slot === slot);
            const isMySlot = slotBookings.some(b => b.userId === user?.uid);
            const isAnimatingBook = animatingSlot?.slot === slot && animatingSlot.type === 'book';
            const isAnimatingCancel = animatingSlot?.slot === slot && animatingSlot.type === 'cancel';
            const isRestricted = !user?.isAdmin && userAge !== null && userAge < 14 && index >= SLOTS.length - 2;

            return (
              <div key={slot} className={`flex flex-col p-5 sm:p-6 rounded-[2.5rem] border transition-all duration-500 ${
                isMySlot ? "border-[#deff9a]/50 bg-[#deff9a]/5 shadow-xl" : "border-zinc-800/50 bg-zinc-900/40"
              } ${isAnimatingBook ? "shine-effect" : ""} ${isAnimatingCancel ? "shine-reverse-effect" : ""} ${isRestricted ? "opacity-40" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-2xl sm:text-3xl font-black italic tracking-tighter block">{slot}</span>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex gap-1.5">
                        {[...Array(MAX_CAPACITY)].map((_, i) => (
                          <div key={i} className={`w-3 h-3 rounded-full transition-colors duration-500 ${i < slotBookings.length ? (isMySlot ? "bg-[#deff9a]" : "bg-white") : "bg-zinc-800"}`} />
                        ))}
                      </div>
                      <span className="text-[20px] uppercase text-zinc-500 font-black tracking-widest">{slotBookings.length}/{MAX_CAPACITY}</span>
                    </div>
                  </div>
                  {!user?.isAdmin && (
                    isMySlot ? (
                      <button onClick={() => setShowConfirm(true)} className="px-6 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-[10px] uppercase active:scale-95 outline-none transition-all">Storno</button>
                    ) : (
                      <button disabled={slotBookings.length >= MAX_CAPACITY || !!myBookingId || isSystemLocked || isRestricted}
                        onClick={() => handleBooking(slot, index)}
                        className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all outline-none ${
                          slotBookings.length >= MAX_CAPACITY || !!myBookingId || isRestricted ? "bg-zinc-800 text-zinc-600" : "bg-[#deff9a] text-black active:scale-90 shadow-lg"
                        }`}>{isRestricted ? "U14" : slotBookings.length >= MAX_CAPACITY ? "FULL" : "Buchen"}</button>
                    )
                  )}
                </div>

                {/* Admin-Info: Teilnehmerliste */}
                {user?.isAdmin && slotBookings.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-zinc-800/50 space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                            {slotBookings.map((b, i) => (
                                <div key={i} className="flex items-center justify-between bg-black/40 border border-zinc-800 p-4 rounded-2xl">
                                    <span className="text-lg font-black uppercase tracking-tight text-[#deff9a]">{b.username}</span>
                                    <button onClick={() => setAdminConfirmData({id: b.id, name: b.username})} className="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black active:scale-90 transition-all">✕</button>
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

      {/* Modal: Admin Bestätigung (Style angepasst an Storno) */}
      {adminConfirmData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[500] p-4 text-center animate-in fade-in">
          <div className="bg-zinc-900 border border-red-900/30 p-12 rounded-[3.5rem] max-w-sm w-full shadow-[0_0_50px_rgba(127,29,29,0.2)] animate-in zoom-in-95 relative overflow-hidden">
            {/* Pulsierender roter Hintergrund-Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -inset-[50%] opacity-40 animate-red-glow bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" 
                   style={{ filter: 'blur(60px)', borderRadius: '40%' }}>
              </div>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-3xl font-black italic uppercase mb-3 text-red-500 tracking-tighter">{adminConfirmData.name}</h3>
              <p className="text-zinc-500 mb-10 text-[10px] uppercase tracking-widest leading-relaxed">Aus dem Slot entfernen?</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setAdminConfirmData(null)} 
                  className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all"
                >
                  Nein
                </button>
                <button 
                  onClick={() => cancelBooking(adminConfirmData.id)} 
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 animate-soft-pulse shadow-[0_10px_20px_rgba(220,38,38,0.3)]"
                >
                  Entfernen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: User Storno */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[300] p-4 text-center animate-in fade-in">
          <div className="bg-zinc-900 border border-red-900/30 p-12 rounded-[3.5rem] max-w-sm w-full shadow-[0_0_50px_rgba(127,29,29,0.2)] animate-in zoom-in-95 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -inset-[50%] opacity-40 animate-red-glow bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" 
                   style={{ filter: 'blur(60px)', borderRadius: '40%' }}></div>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black italic uppercase mb-3 text-red-500 tracking-tighter">Abbrechen?</h3>
              <p className="text-zinc-500 mb-10 text-[10px] uppercase tracking-widest leading-relaxed">Training absagen?</p>
              <div className="flex gap-4">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all">Nein</button>
                <button onClick={() => cancelBooking(myBookingId!)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 animate-soft-pulse shadow-[0_10px_20px_rgba(220,38,38,0.3)]">Storno</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[400] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
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