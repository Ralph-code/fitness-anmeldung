"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Umwandlung in die interne E-Mail-Adresse
    const email = `${username.trim().toLowerCase()}@fitness.local`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

      if (userDoc.exists()) {
        router.push("/dashboard");
      } else {
        setError("Daten konnten nicht geladen werden.");
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
        setError("Name oder Passwort falsch.");
      } else {
        setError("Login fehlgeschlagen.");
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden font-sans selection:bg-[#deff9a] selection:text-black">
      
      {/* --- BACKGROUND ANIMATION (Marquee) --- */}
      <div className="absolute inset-0 z-0 flex flex-col pointer-events-none opacity-[0.05]">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="flex whitespace-nowrap border-b border-white/5 py-2">
            <div className={`flex animate-marquee ${i % 2 === 0 ? "" : "direction-reverse"}`}>
              {[...Array(10)].map((_, j) => (
                <span key={j} className="text-white text-[15vw] font-black italic uppercase tracking-tighter mx-8 leading-none select-none">
                  GYM
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* --- LOGIN FORM --- */}
      <div className="relative z-10 w-full max-w-sm p-8 mx-4 bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800 rounded-[3rem] shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-5xl font-black italic text-[#deff9a] uppercase tracking-tighter leading-none">Login</h2>
          <p className="text-zinc-600 text-[9px] uppercase tracking-[0.4em] mt-3 font-bold">Fitness Heim System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-5 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-bold transition-all placeholder:text-zinc-700"
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-5 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-bold transition-all placeholder:text-zinc-700"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 py-3 rounded-xl">
              <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_30px_rgba(222,255,154,0.1)] ${
              loading 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                : "bg-[#deff9a] text-black hover:scale-[1.02] active:scale-95"
            }`}
          >
            {loading ? "PRÜFE..." : "ANMELDEN"}
          </button>
        </form>
      </div>

      {/* --- CSS FOR SMOOTH MARQUEE --- */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          animation: marquee 30s linear infinite;
          width: max-content;
        }
        .direction-reverse {
          animation-direction: reverse;
        }
      `}</style>
    </div>
  );
}