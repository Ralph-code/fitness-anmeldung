"use client";

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, CARD, HINT, INPUT, LABEL } from "@/components/ui";

const MIN_LENGTH = 8;
const EMPTY = { current: "", next: "", repeat: "" };

/** Eigenes Login-Passwort ändern (mit aktuellem Passwort bestätigt) */
export default function PasswordCard({ onDone }: { onDone: (text: string, type?: "success" | "error") => void }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const error =
    values.next && values.next.length < MIN_LENGTH
      ? t("profile.passwordMin", { count: MIN_LENGTH })
      : values.repeat && values.next !== values.repeat
        ? t("profile.passwordMismatch")
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
      // Merken, dass der Zettel-Eintrag beim Admin nicht mehr gilt
      apiFetch("/api/profile", { method: "PATCH", body: { action: "passwordChanged" } }).catch(() => {});
      close();
      onDone(t("profile.passwordChanged"));
    } catch (err) {
      const code = (err as { code?: string }).code;
      onDone(
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? t("profile.passwordWrong")
          : code === "auth/too-many-requests"
            ? t("profile.passwordTooMany")
            : code === "auth/weak-password"
              ? t("profile.passwordWeak")
              : t("profile.passwordError"),
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD}>
      <span className={LABEL}>{t("profile.password")}</span>
      {!open ? (
        <>
          <p className={`${HINT} mb-4`}>{t("profile.passwordHint")}</p>
          <button onClick={() => setOpen(true)} className={`${BTN_OUTLINE} w-full`}>
            {t("profile.passwordChange")}
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-3 animate-in fade-in">
          <input className={INPUT} type="password" autoComplete="current-password" placeholder={t("profile.passwordCurrent")} value={values.current} onChange={(e) => setValues({ ...values, current: e.target.value })} required />
          <input className={INPUT} type="password" autoComplete="new-password" placeholder={t("profile.passwordNew")} value={values.next} onChange={(e) => setValues({ ...values, next: e.target.value })} required />
          <input className={INPUT} type="password" autoComplete="new-password" placeholder={t("profile.passwordRepeat")} value={values.repeat} onChange={(e) => setValues({ ...values, repeat: e.target.value })} required />
          {error && <p className="text-red-500 text-[11px] font-bold px-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" onClick={close} className={BTN_GHOST}>{t("profile.passwordCancel")}</button>
            <button type="submit" disabled={busy || !!error || !values.current || !values.next || !values.repeat} className={BTN_PRIMARY}>
              {busy ? "..." : t("profile.passwordSave")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
