"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { AdminRecord } from "@/lib/types";
import ConfirmModal, { ModalShell } from "@/components/ConfirmModal";

type NewAdmin = { uid: string; username: string; name: string; password: string };

const inputClass = "w-full p-4 sm:p-5 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-bold transition-all placeholder:text-zinc-700";
const labelClass = "text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-4";
const cardClass = "bg-zinc-900 border border-zinc-800 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden";
const pillClass = "px-4 py-2.5 border rounded-full text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all";

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "nie";

export default function AdminsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminRecord[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [credentials, setCredentials] = useState<{ title: string; username: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "reset"; admin: AdminRecord } | null>(null);

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  }, []);

  // Nur der Superadmin darf hier sein
  useEffect(() => {
    if (!loading && !user?.isSuperAdmin) router.replace("/gym-admin-control");
  }, [user, loading, router]);

  const load = useCallback(
    () =>
      apiFetch<{ admins: AdminRecord[] }>("/api/admin/admins").then(
        (data) => setAdmins(data.admins),
        (e: Error) => showFeedback(e.message, "error")
      ),
    [showFeedback]
  );

  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    let active = true;
    apiFetch<{ admins: AdminRecord[] }>("/api/admin/admins").then(
      (data) => active && setAdmins(data.admins),
      (e: Error) => active && showFeedback(e.message, "error")
    );
    return () => { active = false; };
  }, [user?.isSuperAdmin, showFeedback]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const createAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await apiFetch<NewAdmin>("/api/admin/admins", { method: "POST", body: { name } });
      setCredentials({ title: "Admin angelegt", username: res.username, password: res.password });
      setName("");
      await load();
    });
  };

  const handleConfirm = () =>
    run(async () => {
      if (!confirm) return;
      if (confirm.kind === "reset") {
        const res = await apiFetch<{ password: string }>(`/api/admin/admins/${confirm.admin.uid}`, {
          method: "PATCH",
          body: { action: "resetPassword" },
        });
        setCredentials({ title: "Neues Passwort", username: confirm.admin.username, password: res.password });
      } else {
        await apiFetch(`/api/admin/admins/${confirm.admin.uid}`, { method: "DELETE" });
        showFeedback("Admin gelöscht", "error");
      }
      setConfirm(null);
      await load();
    });

  if (loading || !user?.isSuperAdmin) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase tracking-widest">
      Superadmin Check...
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 pb-24 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">

        <button
          onClick={() => router.push("/gym-admin-control")}
          className="mb-8 sm:mb-10 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <span className="text-lg">←</span> Control
        </button>

        <h1 className="text-4xl font-black italic text-[#deff9a] uppercase tracking-tighter mb-2">Admins</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mb-10 sm:mb-12">Superadmin-Bereich</p>

        {/* Neuer Admin */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <span className={labelClass}>Neuer Admin</span>
            <form onSubmit={createAdmin} className="space-y-4">
              <input className={inputClass} placeholder="Vor- und Nachname" value={name} onChange={(e) => setName(e.target.value)} required />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-5 sm:py-6 bg-[#deff9a] text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-50"
              >
                {busy ? "Lege an..." : "Admin anlegen"}
              </button>
            </form>
            <p className="text-[9px] text-zinc-600 mt-4 leading-relaxed uppercase font-bold italic">
              Das Passwort wird nur einmal angezeigt und nirgends gespeichert. Bei Verlust einfach neu erzeugen.
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#deff9a]/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Liste */}
        {admins === null ? (
          <p className="text-center text-[#deff9a] font-black uppercase tracking-widest animate-pulse py-10">Lade...</p>
        ) : (
          <div className="space-y-4">
            {admins.map((a) => {
              const isSelf = a.uid === user.uid;
              return (
                <div key={a.uid} className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border transition-all ${a.isSuperAdmin ? "border-[#deff9a]/30 bg-[#deff9a]/5" : "border-zinc-800/50 bg-zinc-900/40"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase block truncate">{a.name}</span>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1 truncate">
                        {a.username} · Login: {formatDateTime(a.lastSignIn)}
                      </p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full border text-[8px] font-black uppercase tracking-widest shrink-0 ${a.isSuperAdmin ? "border-[#deff9a]/30 bg-[#deff9a]/10 text-[#deff9a]" : "border-zinc-700 text-zinc-500"}`}>
                      {a.isSuperAdmin ? "Superadmin" : "Admin"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {a.isSuperAdmin ? (
                      <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest italic py-2.5">
                        Nur im Terminal änderbar{isSelf ? " · das bist du" : ""}
                      </span>
                    ) : (
                      <>
                        <button onClick={() => setConfirm({ kind: "reset", admin: a })} className={`${pillClass} border-zinc-800 text-zinc-400`}>Passwort neu</button>
                        <button onClick={() => setConfirm({ kind: "delete", admin: a })} className={`${pillClass} border-red-500/20 text-red-500`}>Löschen</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-16 border-t border-zinc-900 pt-8 flex justify-between items-center px-4">
          <p className="text-zinc-800 text-[8px] font-black uppercase tracking-[0.6em]">Superadmin</p>
          <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#deff9a] animate-pulse"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
          </div>
        </footer>
      </div>

      {confirm && (
        <ConfirmModal
          key={confirm.kind}
          busy={busy}
          title={confirm.admin.name}
          text={confirm.kind === "reset" ? "Neues Passwort erzeugen? Das alte gilt sofort nicht mehr." : "Admin-Konto endgültig löschen?"}
          confirmLabel={confirm.kind === "reset" ? "Erneuern" : "Löschen"}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirm}
        />
      )}

      {credentials && (
        <ModalShell tone="green">
          <h3 className="text-3xl font-black italic uppercase mb-3 text-[#deff9a] tracking-tighter">{credentials.title}</h3>
          <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed">Jetzt notieren – wird nicht gespeichert</p>
          <div className="bg-black/40 border border-zinc-800 p-5 rounded-2xl mb-8 text-left">
            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-1">Name</p>
            <p className="font-mono text-[#deff9a] text-lg break-all mb-4">{credentials.username}</p>
            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-1">Passwort</p>
            <p className="font-mono text-[#deff9a] text-lg break-all">{credentials.password}</p>
          </div>
          <button onClick={() => setCredentials(null)} className="w-full py-4 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
            Notiert
          </button>
        </ModalShell>
      )}

      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === "success" ? "bg-black border-[#deff9a] text-[#deff9a]" : "bg-black border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}
