"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LoginPage() {
  // WICHTIG: Hier definieren wir die Namen, die TypeScript sucht
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const internalEmail = `${username.trim().toLowerCase()}@fitness.local`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, internalEmail, password);
      const user = userCredential.user;

      // Prüfe Rolle direkt beim Login
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists() && userDoc.data().role === "admin") {
        router.push("/dashboard"); // Admin geht direkt zum Panel
      } else {
        router.push("/dashboard"); // Normaler User geht zum Dashboard
      }
    } catch (error: any) {
      setError("Login fehlgeschlagen.");
    }
};

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
        <h1 className="text-4xl font-black italic tracking-tighter text-[#deff9a] mb-2 text-center uppercase">Gym Login</h1>
        <p className="text-zinc-500 text-center mb-8 text-sm">Log dich mit deinem Usernamen ein.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input 
              type="text" 
              placeholder="Username" 
              value={username} // Verknüpfung mit dem State
              className="w-full p-4 bg-black border border-zinc-800 rounded-2xl focus:border-[#deff9a] outline-none transition" 
              onChange={(e) => setUsername(e.target.value)} // Hier wird 'username' gesetzt
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Passwort" 
              value={password} // Verknüpfung mit dem State
              className="w-full p-4 bg-black border border-zinc-800 rounded-2xl focus:border-[#deff9a] outline-none transition" 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-xs text-center font-bold uppercase tracking-wider">{error}</p>}

          <button type="submit" className="w-full bg-[#deff9a] text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(222,255,154,0.2)]">
            Anmelden
          </button>
        </form>

        {/* Admin Hinweis (optional) */}
        <div className="mt-8 text-center border-t border-zinc-800 pt-6">
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest">
            Accounts werden nur vom Admin erstellt
          </p>
        </div>
      </div>
    </div>
  );
}