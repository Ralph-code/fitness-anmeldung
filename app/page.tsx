"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Mail, MapPin, Phone, Printer } from "lucide-react";
import { toUsername, usernameToEmail } from "@/lib/schedule";
import { LANGUAGES } from "@/lib/i18n";
import { useSettings } from "@/context/SettingsContext";

const HOME = {
  street: "Weggensteinstraße 16",
  city: "39100 Bozen",
  phone: { label: "+39 0471 195 9 660", href: "tel:+3904711959660" },
  fax: "+39 0471 982 046",
  mails: [
    { address: "georgsheim@deutschorden.it", roleKey: "login.management" as const },
    { address: "pforte.georgsheim@deutschorden.it", roleKey: "login.staff" as const },
  ],
};

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
        router.push("/start");
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col lg:flex-row font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      {/* Willkommen & Kontakt */}
      <div className="relative flex-1 overflow-hidden px-6 py-12 sm:px-10 lg:px-16 lg:py-20 flex flex-col justify-center">
        <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-[var(--accent-10)] blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <p className="text-[var(--accent-text)] text-[10px] font-black uppercase tracking-[0.5em] mb-5">{t("login.welcome")}</p>
          <h1 className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter leading-[0.95] mb-6">
            St. Georg<br />Schülerheim
          </h1>
          <p className="text-[var(--text-muted)] text-sm sm:text-base leading-relaxed mb-10 max-w-md">{t("login.intro")}</p>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-[var(--accent-text)] mt-0.5 shrink-0" />
              <p className="text-[var(--text-muted)] leading-relaxed">
                {HOME.street}<br />{HOME.city}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-[var(--accent-text)] shrink-0" />
              <a href={HOME.phone.href} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">{HOME.phone.label}</a>
            </div>
            <div className="flex items-center gap-3">
              <Printer size={16} className="text-[var(--accent-text)] shrink-0" />
              <span className="text-[var(--text-muted)]">{HOME.fax}</span>
            </div>
            {HOME.mails.map((mail) => (
              <div key={mail.address} className="flex items-start gap-3">
                <Mail size={16} className="text-[var(--accent-text)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <a href={`mailto:${mail.address}`} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors break-all">{mail.address}</a>
                  <p className="text-[var(--text-faint)] text-[11px] uppercase tracking-widest font-bold mt-0.5">{t(mail.roleKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anmeldung */}
      <div className="lg:w-[30rem] xl:w-[34rem] shrink-0 bg-[var(--surface-strong)] border-t lg:border-t-0 lg:border-l border-[var(--border)] px-6 py-12 sm:px-10 lg:px-14 flex items-center">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex items-start justify-between gap-4 mb-10">
            <div>
              <h2 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter leading-none">{t("login.title")}</h2>
              <p className="text-[var(--text-faint)] text-[9px] uppercase tracking-[0.4em] mt-3 font-bold">{t("login.subtitle")}</p>
            </div>
            <div className="flex gap-1 shrink-0">
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
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_30px_var(--accent-20)] ${
                loading ? "bg-[var(--surface-2)] text-[var(--text-dim)] cursor-not-allowed" : "bg-[var(--accent)] text-[var(--accent-contrast)] hover:scale-[1.02] active:scale-95"
              }`}
            >
              {loading ? t("login.checking") : t("login.submit")}
            </button>
          </form>

          <p className="text-[var(--text-faint)] text-[11px] leading-relaxed mt-8">{t("login.forgot")}</p>
        </div>
      </div>
    </div>
  );
}
