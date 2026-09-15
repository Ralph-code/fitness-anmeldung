"use client";

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

const MIN_LENGTH = 8;
const EMPTY = { current: "", next: "", repeat: "" };
const inputClass = "w-full p-4 sm:p-5 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-bold transition-all placeholder:text-zinc-700";

/** Admin ändert das eigene Login-Passwort (mit aktuellem Passwort bestätigt) */
export default function AdminPasswordCard({ onDone }: { onDone: (text: string, type?: "success" | "error") => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const error =
    values.next && values.next.length < MIN_LENGTH
      ? `Mindestens ${MIN_LENGTH} Zeichen`
      : values.repeat && values.next !== values.repeat
        ? "Passwörter stimmen nicht überein"
        : "";

  const close = () => {
    setOpen(false);
    setValues(EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user?.email || error) return;
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, values.current));
      await updatePassword(user, values.next);
      close();
      onDone("Passwort geändert");
    } catch (err) {
      const code = (err as { code?: string }).code;
      onDone(
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "Aktuelles Passwort falsch"
          : code === "auth/too-many-requests"
            ? "Zu viele Versuche"
            : code === "auth/weak-password"
              ? "Passwort zu schwach"
              : "Fehler beim Ändern",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-2">Admin-Passwort</span>
            <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-bold italic">Eigenes Login-Passwort ändern</p>
          </div>
          {!open && (
            <button
              onClick={() => setOpen(true)}
              className="px-6 py-5 bg-black border border-zinc-800 text-[#deff9a] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shrink-0"
            >
              Passwort ändern
            </button>
          )}
        </div>

        {open && (
          <form onSubmit={submit} className="space-y-3 mt-6 animate-in fade-in">
            <input className={inputClass} type="password" autoComplete="current-password" placeholder="Aktuelles Passwort" value={values.current} onChange={(e) => setValues({ ...values, current: e.target.value })} required />
            <input className={inputClass} type="password" autoComplete="new-password" placeholder="Neues Passwort" value={values.next} onChange={(e) => setValues({ ...values, next: e.target.value })} required />
            <input className={inputClass} type="password" autoComplete="new-password" placeholder="Neues Passwort wiederholen" value={values.repeat} onChange={(e) => setValues({ ...values, repeat: e.target.value })} required />
            {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest px-2">{error}</p>}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={close} className="py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all">
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={busy || !!error || !values.current || !values.next || !values.repeat}
                className="py-5 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
              >
                {busy ? "..." : "Speichern"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
