"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, query, where, addDoc, onSnapshot, 
  deleteDoc, doc 
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const SLOTS = ["06:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const MAX_CAPACITY = 6;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [myBookingId, setMyBookingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [adminConfirmData, setAdminConfirmData] = useState<{id: string, name: string} | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  useEffect(() => {
    if (!loading && !user) router.push("/");
    
    const q = query(collection(db, "bookings"), where("date", "==", dateStr));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(docs);
      
      const myBooking = docs.find((b: any) => b.userId === user?.uid);
      setMyBookingId(myBooking ? myBooking.id : null);
    });

    return () => unsubscribe();
  }, [user, loading, dateStr, router]);

  const handleBooking = async (slot: string) => {
    if (user?.isAdmin) return; 
    if (myBookingId) {
      showFeedback("Du hast bereits reserviert!", "error");
      return;
    }

    const currentCount = bookings.filter(b => b.slot === slot).length;
    if (currentCount >= MAX_CAPACITY) {
      showFeedback("Slot ist voll.", "error");
      return;
    }

    try {
      await addDoc(collection(db, "bookings"), {
        userId: user?.uid,
        username: user?.username || user?.email?.split('@')[0],
        userEmail: user?.email,
        date: dateStr,
        slot: slot,
        createdAt: new Date()
      });
      showFeedback("Erfolgreich gebucht!");
    } catch (error) {
      showFeedback("Fehler bei der Verbindung.", "error");
    }
  };

  const cancelBooking = async (id: string) => {
    try {
      await deleteDoc(doc(db, "bookings", id));
      showFeedback("Eintrag gelöscht.");
      setShowConfirm(false);
      setAdminConfirmData(null);
    } catch (error) {
      showFeedback("Fehler beim Löschen.", "error");
    }
  };

  if (loading) return <div className="p-10 text-white bg-black min-h-screen font-mono uppercase animate-pulse">Lädt...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6 relative">
      <div className="max-w-2xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-[#deff9a]">FITNESS HEIM</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em]">
                {user?.isAdmin ? "Admin Dashboard" : `Mitglied: ${user?.username}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* NEU: Button zum User erstellen für Admins */}
            {user?.isAdmin && (
              <button 
                onClick={() => router.push("/gym-admin-control")}
                className="px-4 py-2 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#deff9a] transition-colors"
              >
                + User erstellen
              </button>
            )}
            <button onClick={() => auth.signOut()} className="px-4 py-2 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white transition-colors">LOGOUT</button>
          </div>
        </header>

        {/* Info Box */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-[2rem] border border-zinc-800 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-1">Morgiges Training</h2>
            <p className="text-[#deff9a] text-sm font-medium">{new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
          </div>
          <div className="absolute -right-4 -top-4 text-zinc-800 text-6xl font-black opacity-20 uppercase">GYM</div>
        </div>

        {/* Slot Liste */}
        <div className="space-y-4">
          {SLOTS.map((slot) => {
            const slotBookings = bookings.filter(b => b.slot === slot);
            const count = slotBookings.length;
            const isFull = count >= MAX_CAPACITY;
            const isMySlot = slotBookings.some(b => b.userId === user?.uid);

            return (
              <div key={slot} className={`flex flex-col p-6 rounded-[2rem] border transition-all duration-300 ${
                isMySlot ? "border-[#deff9a] bg-[#deff9a]/5 shadow-[0_0_30px_rgba(222,255,154,0.05)]" : "border-zinc-800 bg-zinc-900/40"
              }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xl font-black">{slot} <span className="text-xs font-normal text-zinc-500 uppercase ml-1 tracking-widest">Uhr</span></span>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex gap-1">
                                {[...Array(MAX_CAPACITY)].map((_, i) => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < count ? (isMySlot ? "bg-[#deff9a]" : "bg-white") : "bg-zinc-800"}`} />
                                ))}
                            </div>
                            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
                                {count} / {MAX_CAPACITY} Slots
                            </span>
                        </div>
                    </div>
                    
                    {!user?.isAdmin && (
                        isMySlot ? (
                            <button onClick={() => setShowConfirm(true)} className="px-6 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Stornieren</button>
                        ) : (
                            <button
                                disabled={isFull || !!myBookingId}
                                onClick={() => handleBooking(slot)}
                                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                    isFull || !!myBookingId ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-[#deff9a] text-black hover:scale-105 active:scale-95"
                                }`}
                            >
                                {isFull ? "Voll" : "Buchen"}
                            </button>
                        )
                    )}
                </div>

                {/* Admin Ansicht: Teilnehmerliste */}
                {user?.isAdmin && slotBookings.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-zinc-800/50 space-y-2">
                        {slotBookings.map((b) => (
                            <div key={b.id} className="flex justify-between items-center bg-black/30 p-2.5 px-4 rounded-xl border border-zinc-800/30">
                                <span className="text-xs font-bold text-zinc-300 tracking-wide">{b.username}</span>
                                <button 
                                    onClick={() => setAdminConfirmData({id: b.id, name: b.username})}
                                    className="text-[9px] font-black bg-red-900/20 text-red-500 border border-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest"
                                >
                                    Entfernen
                                </button>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODALS --- (Identisch wie zuvor, nur optisch leicht angepasst) */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 text-white italic uppercase tracking-tighter">Sicher?</h3>
            <p className="text-zinc-500 mb-8 text-xs uppercase tracking-widest leading-relaxed">Möchtest du dein Training morgen wirklich absagen?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 rounded-2xl bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest">Nein</button>
              <button onClick={() => cancelBooking(myBookingId!)} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest">Ja, Storno</button>
            </div>
          </div>
        </div>
      )}

      {adminConfirmData && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-red-900/30 p-10 rounded-[3rem] max-w-sm w-full text-center">
            <h3 className="text-xl font-black mb-2 text-white italic uppercase tracking-tighter">Mitglied entfernen</h3>
            <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed">
                Soll <span className="text-[#deff9a]">{adminConfirmData.name}</span> wirklich gelöscht werden?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setAdminConfirmData(null)} className="flex-1 py-4 rounded-2xl bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest">Abbrechen</button>
              <button onClick={() => cancelBooking(adminConfirmData.id)} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest">Entfernen</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4">
          <div className={`p-4 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl ${
            statusMsg.type === 'success' ? "bg-black border-[#deff9a] text-[#deff9a]" : "bg-black border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}