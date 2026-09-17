"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toUsername, usernameToEmail } from "@/lib/schedule";
import { LANGUAGES } from "@/lib/i18n";
import { useSettings } from "@/context/SettingsContext";

export default function LoginPage() {
  const { t, language, setLanguage } = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // "Max Müller" und "max.mueller" führen zum selben Konto; ältere Benutzernamen gehen weiterhin
    const raw = username.trim().toLowerCase();
    const candidates = [...new Set([toUsername(raw), raw])].filter(Boolean);

    try {
      let userCredential;
      for (const [i, candidate] of candidates.entries()) {
        try {
          userCredential = await signInWithEmailAndPassword(auth, usernameToEmail(candidate), password);
          break;
        } catch (err) {
          if (i === candidates.length - 1 || (err as { code?: string }).code !== "auth/invalid-credential") throw err;
        }
      }
      const userDoc = await getDoc(doc(db, "users", userCredential!.user.uid));

      if (userDoc.exists()) {
        router.push("/fitness");
      } else {
        await auth.signOut();
        setError(t("login.noProfile"));
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      console.error(err);
      const code = (err as { code?: string }).code;
      setError(code === "auth/invalid-credential" || code === "auth/user-not-found" ? t("login.wrong") : t("login.failed"));
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] flex items-center justify-center overflow-hidden font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      {/* Hintergrund-Animation */}
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

      {/* Anmeldung */}
      <div className="relative z-10 w-full max-w-sm p-8 mx-4 bg-zinc-900/40 backdrop-blur-2xl border border-[var(--border)] rounded-[3rem] shadow-2xl">
        <div className="flex justify-center gap-1 mb-8">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLanguage(l.value)}
              className={`px-3 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
                language === l.value
                  ? "border-[var(--accent-40)] bg-[var(--accent-10)] text-[var(--accent-text)]"
                  : "border-[var(--border)] text-[var(--text-faint)]"
              }`}
            >
              {l.value}
            </button>
          ))}
        </div>

        <div className="text-center mb-10">
          <h2 className="text-4xl sm:text-5xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter leading-[0.95]">{t("login.title")}</h2>
          <p className="text-[var(--text-faint)] text-[10px] uppercase tracking-[0.4em] mt-4 font-bold">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder={t("login.name")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl outline-none focus:border-[var(--accent)] text-[var(--text)] font-bold transition-all placeholder:text-[var(--text-faint)]"
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder={t("login.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl outline-none focus:border-[var(--accent)] text-[var(--text)] font-bold transition-all placeholder:text-[var(--text-faint)]"
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 py-3 rounded-xl">
              <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_30px_var(--accent-10)] ${
              loading ? "bg-[var(--surface-2)] text-[var(--text-dim)] cursor-not-allowed" : "bg-[var(--accent)] text-[var(--accent-contrast)] hover:scale-[1.02] active:scale-95"
            }`}
          >
            {loading ? t("login.checking") : t("login.submit")}
          </button>
        </form>
      </div>

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
