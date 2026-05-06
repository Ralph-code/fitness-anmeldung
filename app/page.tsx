import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      alert("Fehler: " + error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <form onSubmit={handleLogin} className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <h1 className="text-3xl font-bold mb-6 text-[#deff9a]">Fitness Login</h1>
        <input type="email" placeholder="E-Mail" className="w-full p-3 mb-4 bg-black border border-zinc-700 rounded" onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Passwort" className="w-full p-3 mb-6 bg-black border border-zinc-700 rounded" onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full bg-[#deff9a] text-black font-bold py-3 rounded-lg hover:bg-[#c9f07a] transition">Anmelden</button>
        <p className="mt-4 text-center">Noch kein Konto? <Link href="/register" className="text-[#deff9a] underline">Registrieren</Link></p>
      </form>
    </div>
  );
}