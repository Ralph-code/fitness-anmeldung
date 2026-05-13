"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function AdminControl() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [config, setConfig] = useState({ lockTime: "21:15", endTime: "20:30" });
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Sicherheits-Check: Nur Admins dürfen hier sein
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Echtzeit-Daten laden
  useEffect(() => {
    if (!user?.isAdmin) return;
    const unsub = onSnapshot(doc(db, "settings", "gym_config"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig({
          lockTime: data.lockTime || "21:15",
          endTime: data.endTime || "20:30"
        });
      }
    });
    return () => unsub();
  }, [user]);

  const saveConfig = async () => {
    setIsSaving(true);
    setMsg("");
    try {
      await updateDoc(doc(db, "settings", "gym_config"), {
        lockTime: config.lockTime,
        endTime: config.endTime
      });
      setMsg("Konfiguration aktualisiert!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Fehler beim Speichern");
    }
    setIsSaving(false);
  };

  if (loading || !user?.isAdmin) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase tracking-widest">
      Admin Check...
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-md mx-auto pt-10">
        
        {/* Back Navigation */}
        <button 
          onClick={() => router.push("/dashboard")} 
          className="mb-10 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <span className="text-lg">←</span> Dashboard
        </button>

        <h1 className="text-4xl font-black italic text-[#deff9a] uppercase tracking-tighter mb-2">Control</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mb-12">Gym System Settings</p>


        {/* <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-10">
            
            <div className="group">
              <label className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-4 group-focus-within:text-[#deff9a] transition-colors">
                1. System-Wechsel (Morgen-Modus)
              </label>
              <input 
                type="time" 
                value={config.lockTime}
                onChange={(e) => setConfig({...config, lockTime: e.target.value})}
                className="w-full bg-black border border-zinc-800 rounded-2xl p-5 text-3xl font-black text-[#deff9a] outline-none focus:border-[#deff9a]/50 transition-all shadow-inner"
              />
              <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed uppercase font-bold italic">
                Ab dieser Zeit springen die Buchungen auf den nächsten Kalendertag.
              </p>
            </div>

            <div className="group">
              <label className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-4 group-focus-within:text-red-500 transition-colors">
                2. Buchungsschluss (Pause-Modus)
              </label>
              <input 
                type="time" 
                value={config.endTime}
                onChange={(e) => setConfig({...config, endTime: e.target.value})}
                className="w-full bg-black border border-zinc-800 rounded-2xl p-5 text-3xl font-black text-red-500 outline-none focus:border-red-500/50 transition-all shadow-inner"
              />
              <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed uppercase font-bold italic">
                Ab dieser Zeit ist das System für heute gesperrt.
              </p>
            </div>

            <div className="pt-4">
              <button 
                onClick={saveConfig}
                disabled={isSaving}
                className="w-full py-6 bg-[#deff9a] text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-50"
              >
                {isSaving ? "Synchronisiere..." : "Konfiguration Speichern"}
              </button>
            </div>

            {msg && (
              <div className="text-center py-2 animate-in fade-in slide-in-from-bottom-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#deff9a] bg-[#deff9a]/10 px-4 py-2 rounded-full border border-[#deff9a]/20">
                  {msg}
                </span>
              </div>
            )}
          </div>

          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#deff9a]/5 blur-[90px] rounded-full pointer-events-none"></div>
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-red-500/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div> */}

        <footer className="mt-16 border-t border-zinc-900 pt-8 flex justify-between items-center px-4">
          <p className="text-zinc-800 text-[8px] font-black uppercase tracking-[0.6em]">Core Engine v4.2</p>
          <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#deff9a] animate-pulse"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
          </div>
        </footer>
      </div>
    </div>
  );
}