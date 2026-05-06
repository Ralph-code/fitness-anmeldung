"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Konto erstellt!");
      router.push("/");
    } catch (error: any) {
      alert("Fehler: " + error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <form onSubmit={handleRegister} className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <h2 className="text-3xl font-bold mb-6 text-[#deff9a]">Neu anmelden</h2>
        <input type="email" placeholder="E-Mail" className="w-full p-3 mb-4 bg-black border border-zinc-700 rounded" onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Mind. 6 Zeichen" className="w-full p-3 mb-6 bg-black border border-zinc-700 rounded" onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full bg-white text-black font-bold py-3 rounded-lg">Konto erstellen</button>
      </form>
    </div>
  );
}