"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Nach erfolgreichem Login zum Dashboard weiterleiten
      router.push("/dashboard");
    } catch (error: any) {
      setError("Login fehlgeschlagen. Prüfe E-Mail und Passwort.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-sans">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
        <h1 className="text-4xl font-black italic tracking-tighter text-[#deff9a] mb-2 text-center uppercase">Gym Login</h1>
        <p className="text-zinc-500 text-center mb-8 text-sm">Melde dich an, um deinen Slot zu buchen.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input 
              type="email" 
              placeholder="E-Mail" 
              className="w-full p-4 bg-black border border-zinc-800 rounded-2xl focus:border-[#deff9a] outline-none transition" 
              onChange={(e) => setEmail(e.target.value)} 
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Passwort" 
              className="w-full p-4 bg-black border border-zinc-800 rounded-2xl focus:border-[#deff9a] outline-none transition" 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-xs text-center font-bold uppercase tracking-wider">{error}</p>}

          <button className="w-full bg-[#deff9a] text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(222,255,154,0.2)]">
            Anmelden
          </button>
        </form>

        <div className="mt-8 text-center border-t border-zinc-800 pt-6">
          <p className="text-zinc-500 text-sm">Neu im Heim?</p>
          <Link href="/register" className="text-[#deff9a] font-bold hover:underline">
            Konto erstellen
          </Link>
        </div>
      </div>
    </div>
  );
}