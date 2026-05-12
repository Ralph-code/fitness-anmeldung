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
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [myBookingId, setMyBookingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [config, setConfig] = useState({ lockTime: "21:15", endTime: "20:30" });
  const [targetDateLabel, setTargetDateLabel] = useState(""); 
  const [dateStr, setDateStr] = useState(""); 
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [adminConfirmData, setAdminConfirmData] = useState<{id: string, name: string} | null>(null);
  
  // State für Slot-Animation (Richtung berücksichtigen)
  const [animatingSlot, setAnimatingSlot] = useState<{ slot: string; type: 'book' | 'cancel' } | null>(null);

  const currentYear = new Date().getFullYear();
  const userAge = user?.birthYear ? currentYear - user.birthYear : null;

  const showFeedback = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const unsubConfig = onSnapshot(doc(db, "settings", "gym_config"), (snap) => {
      if (snap.exists()) {
        setConfig({ lockTime: snap.data().lockTime || "21:15", endTime: snap.data().endTime || "20:30" });
      }
    });
    
    const updateTarget = () => {
      const now = new Date();
      now.setHours(22, 40, 0);
      const [lockH, lockM] = config.lockTime.split(":").map(Number);
      const [endH, endM] = config.endTime.split(":").map(Number);
      
      const limitStartMorgen = new Date();
      limitStartMorgen.setHours(lockH, lockM, 0);
      const limitEndeHeute = new Date();
      limitEndeHeute.setHours(endH, endM, 0);
      
      let finalDate = new Date();
      if (now >= limitEndeHeute && now < limitStartMorgen) {
        setIsSystemLocked(true); setTargetDateLabel("PAUSE"); setDateStr("LOCKED");
      } else if (now >= limitStartMorgen) {
        setIsSystemLocked(false); setTargetDateLabel("MORGEN");
        finalDate.setDate(finalDate.getDate() + 2);
        setDateStr(finalDate.toISOString().split('T')[0]);
      } else {
        setIsSystemLocked(false); setTargetDateLabel("HEUTE");
        finalDate.setDate(finalDate.getDate() + 1);
        setDateStr(finalDate.toISOString().split('T')[0]);
      }
    };
    updateTarget();
    const timer = setInterval(updateTarget, 10000); 
    return () => { unsubConfig(); clearInterval(timer); };
  }, [config.lockTime, config.endTime, user, loading]);
  
  useEffect(() => {
    if (loading || !user || !dateStr || dateStr === "LOCKED") return;
    const q = query(collection(db, "bookings"), where("date", "==", dateStr));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(docs);
      setMyBookingId(docs.find((b: any) => b.userId === user?.uid)?.id || null);
    });
    return () => unsubscribe();
  }, [user, loading, dateStr]);

  const handleBooking = async (slot: string, index: number) => {
    if (user?.isAdmin || isSystemLocked || myBookingId) return;
    if (userAge !== null && userAge < 14 && index >= SLOTS.length - 2) {
      showFeedback("Zutritt erst ab 14 Jahren", "error");
      return;
    }

    try {
      await addDoc(collection(db, "bookings"), {
        userId: user?.uid,
        username: user?.username,
        date: dateStr, slot: slot, createdAt: new Date()
      });
      setAnimatingSlot({ slot, type: 'book' });
      showFeedback(`Erfolgreich gebucht!`);
      setTimeout(() => setAnimatingSlot(null), 1000);
    } catch (error) { showFeedback("Fehler", "error"); }
  };

  const cancelBooking = async (id: string) => {
    const bookingToCancel = bookings.find(b => b.id === id);
    const slotName = bookingToCancel?.slot;

    try {
      await deleteDoc(doc(db, "bookings", id));
      if (slotName) {
        setAnimatingSlot({ slot: slotName, type: 'cancel' });
      }
      showFeedback("Storniert.", "error");
      setShowConfirm(false);
      setAdminConfirmData(null);
      setTimeout(() => setAnimatingSlot(null), 1000);
    } catch (error) { showFeedback("Fehler", "error"); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase animate-pulse">System Check...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-12 pt-4 relative z-50">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-[#deff9a]">GYM LOG</h1>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                {user?.isAdmin ? "Admin View" : `${user?.username} (${userAge ?? '?'} J.)`}
            </p>
          </div>
          <button onClick={() => auth.signOut()} className="px-5 py-2.5 border border-zinc-800 rounded-full text-[10px] font-black text-zinc-400 active:text-white transition-all uppercase">Logout</button>
        </header>

        {/* Status Card */}
        <div className={`mb-10 p-10 rounded-[3rem] border transition-all duration-700 text-center relative overflow-hidden shadow-2xl ${
          isSystemLocked ? "bg-red-950/20 border-red-900/50" : "bg-zinc-900 border-zinc-800"
        }`}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute -inset-[100%] opacity-30 animate-slow-spin ${
              isSystemLocked ? "bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" : "bg-[radial-gradient(ellipse_at_center,#deff9a_0%,transparent_70%)]"
            }`} style={{ filter: 'blur(60px)', borderRadius: '40%' }}></div>
          </div>

          <div className="relative z-10">
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.4em] mb-3 leading-none">Systemstatus</p>
            <h2 className={`text-6xl font-black italic uppercase tracking-tighter mb-5 transition-colors ${isSystemLocked ? "text-red-500" : "text-white"}`}>
              {targetDateLabel}
            </h2>
            {!isSystemLocked && (
              <div className="inline-block px-5 py-2 rounded-full bg-black/40 border border-[#deff9a]/20 text-[#deff9a] text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                {dateStr ? new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }) : ""}
              </div>
            )}
          </div>
          <div className="absolute -right-8 -top-8 text-white/[0.03] text-[10rem] font-black italic select-none">GYM</div>
        </div>

        {/* Slots */}
        <div className={`space-y-4 transition-all duration-500 ${isSystemLocked && !user?.isAdmin ? "opacity-20 grayscale pointer-events-none" : "opacity-100"}`}>
          {SLOTS.map((slot, index) => {
            const slotBookings = bookings.filter(b => b.slot === slot);
            const count = slotBookings.length;
            const isFull = count >= MAX_CAPACITY;
            const isMySlot = slotBookings.some(b => b.userId === user?.uid);
            const isRestricted = !user?.isAdmin && userAge !== null && userAge < 14 && index >= SLOTS.length - 2;
            
            const isAnimatingBook = animatingSlot?.slot === slot && animatingSlot.type === 'book';
            const isAnimatingCancel = animatingSlot?.slot === slot && animatingSlot.type === 'cancel';

            return (
              <div key={slot} className={`flex flex-col p-5 sm:p-6 rounded-[2.5rem] border transition-all duration-500 ${
                isMySlot ? "border-[#deff9a]/50 bg-[#deff9a]/5 shadow-xl" : "border-zinc-800/50 bg-zinc-900/40"
              } ${isRestricted ? "opacity-40" : ""} ${isAnimatingBook ? "shine-effect" : ""} ${isAnimatingCancel ? "shine-reverse-effect" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <span className="text-2xl sm:text-3xl font-black italic tracking-tighter block">{slot}</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="flex gap-1.5">
                                {[...Array(MAX_CAPACITY)].map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full transition-colors duration-500 ${i < count ? (isMySlot ? "bg-[#deff9a]" : "bg-white") : "bg-zinc-800"}`} />
                                ))}
                            </div>
                            <span className="text-[20px] uppercase text-zinc-500 font-black tracking-widest">{count}/{MAX_CAPACITY}</span>
                        </div>
                    </div>
                    
                    {!user?.isAdmin && (
                        isMySlot ? (
                            <button onClick={() => setShowConfirm(true)} className="px-6 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all outline-none">Storno</button>
                        ) : (
                            <button
                                disabled={isFull || !!myBookingId || isSystemLocked || isRestricted}
                                onClick={() => handleBooking(slot, index)}
                                className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all outline-none ${
                                    isFull || !!myBookingId || isRestricted ? "bg-zinc-800 text-zinc-600" : "bg-[#deff9a] text-black active:scale-90 shadow-lg"
                                }`}
                            >
                                {isRestricted ? "U14" : isFull ? "FULL" : "Buchen"}
                            </button>
                        )
                    )}
                </div>

                {/* Admin Kick List */}
                {user?.isAdmin && slotBookings.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-zinc-800/40 space-y-2">
                        {slotBookings.map((b) => (
                            <div key={b.id} className="flex justify-between items-center bg-black/20 p-3 px-4 rounded-xl border border-zinc-800/30">
                                <span className="text-xs font-bold text-zinc-400 tracking-wide uppercase">{b.username}</span>
                                <button onClick={() => setAdminConfirmData({id: b.id, name: b.username})} className="text-[9px] font-black bg-red-900/20 text-red-500 border border-red-500/10 px-4 py-2 rounded-lg active:bg-red-500 active:text-white transition-all uppercase tracking-widest">Kick</button>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Stornieren Confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[300] p-4 text-center animate-in fade-in">
          <div className="bg-zinc-900 border border-red-900/30 p-12 rounded-[3.5rem] max-w-sm w-full shadow-[0_0_50px_rgba(127,29,29,0.2)] animate-in zoom-in-95 relative overflow-hidden">
            
            {/* Roter Hintergrund-Glow (Pulsierend) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -inset-[50%] opacity-40 animate-red-glow bg-[radial-gradient(ellipse_at_center,#7f1d1d_0%,transparent_70%)]" 
                   style={{ filter: 'blur(60px)', borderRadius: '40%' }}>
              </div>
            </div>

            <div className="relative z-10">
              <h3 className="text-3xl font-black italic uppercase mb-3 text-red-500 tracking-tighter">Abbrechen?</h3>
              <p className="text-zinc-500 mb-10 text-[10px] uppercase tracking-[0.2em] leading-relaxed">Training absagen?</p>
              
              <div className="flex gap-4">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Nein</button>
                <button onClick={() => cancelBooking(myBookingId!)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 animate-soft-pulse shadow-[0_10px_20px_rgba(220,38,38,0.3)]">Storno</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[400] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === 'success' 
            ? "bg-black border-[#deff9a] text-[#deff9a]" 
            : "bg-black border-red-500 text-red-500"
          }`}>
            <span className="relative z-10">{statusMsg.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}