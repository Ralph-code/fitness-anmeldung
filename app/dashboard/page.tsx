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
  
  // States für Daten
  const [bookings, setBookings] = useState<any[]>([]);
  const [myBookingId, setMyBookingId] = useState<string | null>(null);

  // States für UI-Feedback
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Datum für morgen berechnen
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  // Feedback-Funktion (ersetzt alert)
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
    if (myBookingId) {
      showFeedback("Du hast bereits einen Platz reserviert!", "error");
      return;
    }

    const currentCount = bookings.filter(b => b.slot === slot).length;
    if (currentCount >= MAX_CAPACITY) {
      showFeedback("Dieser Slot ist leider schon voll.", "error");
      return;
    }

    try {
      await addDoc(collection(db, "bookings"), {
        userId: user?.uid,
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

  const cancelBooking = async () => {
    if (!myBookingId) return;
    try {
      await deleteDoc(doc(db, "bookings", myBookingId));
      showFeedback("Reservierung wurde gelöscht.");
      setShowConfirm(false);
    } catch (error) {
      showFeedback("Löschen fehlgeschlagen.", "error");
    }
  };

  if (loading) return <div className="p-10 text-white bg-black min-h-screen font-mono">Lädt...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6 relative">
      <div className="max-w-2xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-[#deff9a]">FITNESS HEIM</h1>
            <p className="text-zinc-500 text-sm">Willkommen, {user?.email?.split('@')[0]}</p>
          </div>
          <button onClick={() => auth.signOut()} className="px-4 py-2 border border-zinc-800 rounded-full text-xs hover:bg-zinc-900 transition">Logout</button>
        </header>

        {/* Info Box */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-3xl border border-zinc-800 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-1">Planung für Morgen</h2>
            <p className="text-[#deff9a] text-sm font-medium">{new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
          </div>
          <div className="absolute -right-4 -top-4 text-zinc-800 text-6xl font-black opacity-20">GYM</div>
        </div>

        {/* Slot Liste */}
        <div className="space-y-3">
          {SLOTS.map((slot) => {
            const slotBookings = bookings.filter(b => b.slot === slot);
            const count = slotBookings.length;
            const isFull = count >= MAX_CAPACITY;
            const isMySlot = slotBookings.some(b => b.userId === user?.uid);

            return (
              <div key={slot} className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${
                isMySlot ? "border-[#deff9a] bg-[#deff9a]/5 shadow-[0_0_20px_rgba(222,255,154,0.1)]" : "border-zinc-800 bg-zinc-900/50"
              }`}>
                <div>
                  <span className="text-xl font-bold">{slot} <span className="text-sm font-normal text-zinc-500">Uhr</span></span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {[...Array(MAX_CAPACITY)].map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < count ? (isMySlot ? "bg-[#deff9a]" : "bg-white") : "bg-zinc-700"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                      {isFull ? "Voll belegt" : `${MAX_CAPACITY - count} Plätze frei`}
                    </span>
                  </div>
                </div>
                
                {isMySlot ? (
                  <button onClick={() => setShowConfirm(true)} className="px-5 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all">Stornieren</button>
                ) : (
                  <button
                    disabled={isFull || !!myBookingId}
                    onClick={() => handleBooking(slot)}
                    className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      isFull || !!myBookingId 
                        ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                        : "bg-[#deff9a] text-black hover:scale-105 active:scale-95"
                    }`}
                  >
                    {isFull ? "Full" : "Buchen"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- UI OVERLAYS --- */}

      {/* Custom Toast Message */}
      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs animate-in fade-in slide-in-from-bottom-5">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${
            statusMsg.type === 'success' ? "bg-zinc-900/90 border-[#deff9a] text-[#deff9a]" : "bg-zinc-900/90 border-red-500 text-red-500"
          }`}>
            <span className="text-lg">{statusMsg.type === 'success' ? "✓" : "✕"}</span>
            <p className="text-sm font-bold">{statusMsg.text}</p>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-100 p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
            <h3 className="text-2xl font-bold mb-2">Sicher?</h3>
            <p className="text-zinc-500 mb-8 text-sm">Möchtest du deinen Slot wirklich für andere freigeben?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition">Abbrechen</button>
              <button onClick={cancelBooking} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition">Ja, weg damit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}