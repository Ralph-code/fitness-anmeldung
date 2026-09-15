"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ageOn, formatDate, suspendedOn, zonedNow } from "@/lib/schedule";
import type { StudentRecord } from "@/lib/types";
import ConfirmModal, { ModalShell } from "@/components/ConfirmModal";
import SuspendModal from "@/components/SuspendModal";

type Created = { uid: string; name: string; room: string; username: string; password: string };
type Confirm =
  | { kind: "delete" | "reset"; student: StudentRecord }
  | { kind: "rotate" }
  | null;

const inputClass = "w-full p-5 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-bold transition-all placeholder:text-zinc-700 [color-scheme:dark]";
const labelClass = "text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-4";
const cardClass = "bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden";
const pillClass = "px-4 py-2.5 border rounded-full text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all";

// Eine Zeile pro Student: "Name; Zimmer; Geburtsdatum" (auch Tab-getrennt aus Excel)
function parseBulk(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const [name = "", room = "", birthDate = ""] = line.split(sep).map((s) => s.trim());
      return { name, room, birthDate };
    });
}

const printUrl = (uids?: string[]) => `/gym-admin-control/print${uids ? `?uids=${uids.join(",")}` : ""}`;

export default function AdminControl() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", room: "", birthDate: "" });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [created, setCreated] = useState<Created[] | null>(null);
  const [rotated, setRotated] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [suspendTarget, setSuspendTarget] = useState<StudentRecord | null>(null);
  const [editTarget, setEditTarget] = useState<StudentRecord | null>(null);

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  }, []);

  // Sicherheits-Check: Nur Admins dürfen hier sein
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const load = useCallback(
    () =>
      apiFetch<{ students: StudentRecord[] }>("/api/admin/students").then(
        (data) => setStudents(data.students),
        (e: Error) => showFeedback(e.message, "error")
      ),
    [showFeedback]
  );

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    apiFetch<{ students: StudentRecord[] }>("/api/admin/students").then(
      (data) => active && setStudents(data.students),
      (e: Error) => active && showFeedback(e.message, "error")
    );
    return () => { active = false; };
  }, [user?.isAdmin, showFeedback]);

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

  const createStudents = (list: { name: string; room: string; birthDate: string }[]) =>
    run(async () => {
      const res = await apiFetch<{ created: Created[]; failed: { name: string; error: string }[] }>("/api/admin/students", {
        method: "POST",
        body: { students: list },
      });
      if (res.created.length) setCreated(res.created);
      if (res.failed.length) showFeedback(`${res.failed.length} fehlgeschlagen: ${res.failed[0].name}`, "error");
      setForm({ name: "", room: "", birthDate: "" });
      setBulkText("");
      await load();
    });

  const patchStudent = (uid: string, body: object) =>
    apiFetch<{ password?: string }>(`/api/admin/students/${uid}`, { method: "PATCH", body });

  const handleConfirm = () =>
    run(async () => {
      if (!confirm) return;
      if (confirm.kind === "rotate") {
        const res = await apiFetch<{ updated: number; failed: number }>("/api/admin/passwords", { method: "POST" });
        if (res.failed) showFeedback(`${res.failed} Passwörter fehlgeschlagen`, "error");
        setRotated(res.updated);
      } else if (confirm.kind === "reset") {
        await patchStudent(confirm.student.uid, { action: "resetPassword" });
        setRevealed((prev) => new Set(prev).add(confirm.student.uid));
        showFeedback("Neues Passwort");
      } else {
        await apiFetch(`/api/admin/students/${confirm.student.uid}`, { method: "DELETE" });
        showFeedback("Student gelöscht", "error");
      }
      setConfirm(null);
      await load();
    });

  if (loading || !user?.isAdmin) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase tracking-widest">
      Admin Check...
    </div>
  );

  const today = zonedNow().date;
  const term = search.trim().toLowerCase();
  const visible = (students ?? []).filter((s) =>
    !term || [s.name, s.room, s.username].some((v) => v?.toLowerCase().includes(term))
  );
  const suspendedCount = (students ?? []).filter((s) => suspendedOn(s, today)).length;
  const bulkRows = parseBulk(bulkText);

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans selection:bg-[#deff9a] selection:text-black">
      <div className="max-w-2xl mx-auto pt-10">

        {/* Back Navigation */}
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-10 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <span className="text-lg">←</span> Dashboard
        </button>

        <h1 className="text-4xl font-black italic text-[#deff9a] uppercase tracking-tighter mb-2">Control</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mb-12">Studenten & Zugänge</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-6 rounded-[2.5rem] border border-zinc-800/50 bg-zinc-900/40 text-center">
            <span className="text-5xl font-black italic tracking-tighter block">{students?.length ?? "–"}</span>
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em]">Studenten</span>
          </div>
          <div className={`p-6 rounded-[2.5rem] border text-center ${suspendedCount ? "border-red-900/50 bg-red-950/20" : "border-zinc-800/50 bg-zinc-900/40"}`}>
            <span className={`text-5xl font-black italic tracking-tighter block ${suspendedCount ? "text-red-500" : ""}`}>{students ? suspendedCount : "–"}</span>
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em]">Gesperrt</span>
          </div>
        </div>

        {/* Neuer Student */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <label className={`${labelClass} !mb-0`}>{bulkMode ? "Mehrere anlegen" : "Neuer Student"}</label>
              <button onClick={() => setBulkMode(!bulkMode)} className="text-[9px] font-black uppercase tracking-widest text-[#deff9a]">
                {bulkMode ? "Einzeln" : "Liste importieren"}
              </button>
            </div>

            {bulkMode ? (
              <div className="space-y-4">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={8}
                  placeholder={"Max Mustermann; 101A; 14.03.2009\nAnna Beispiel; 102B; 02.11.2010"}
                  className={`${inputClass} font-mono text-sm resize-y`}
                />
                <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-bold italic">
                  Eine Zeile pro Student: Name; Zimmer; Geburtsdatum. Direkt aus Excel kopieren geht auch.
                </p>
                <button
                  onClick={() => createStudents(bulkRows)}
                  disabled={busy || bulkRows.length === 0}
                  className="w-full py-6 bg-[#deff9a] text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-50"
                >
                  {busy ? "Lege an..." : `${bulkRows.length} Studenten anlegen`}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); createStudents([form]); }}
                className="space-y-4"
              >
                <input className={inputClass} placeholder="Vor- und Nachname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <div className="grid grid-cols-2 gap-4">
                  <input className={`${inputClass} uppercase`} placeholder="Zimmer (101)" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} required />
                  <input className={inputClass} type="date" value={form.birthDate} max={today} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} required />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-6 bg-[#deff9a] text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-50"
                >
                  {busy ? "Lege an..." : "Anlegen"}
                </button>
              </form>
            )}
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#deff9a]/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Zeitplan */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <label className={`${labelClass} !mb-2`}>Zeitplan</label>
              <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-bold italic">Slots, Uhrzeiten, Plätze & Altersgrenzen</p>
            </div>
            <button
              onClick={() => router.push("/gym-admin-control/slots")}
              className="px-6 py-5 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shrink-0"
            >
              Slots bearbeiten
            </button>
          </div>
        </div>

        {/* Zugangsdaten */}
        <div className={`${cardClass} mb-12`}>
          <div className="relative z-10">
            <label className={labelClass}>Zugangsdaten</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => router.push(printUrl())}
                disabled={!students?.length}
                className="py-5 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
              >
                Alle drucken
              </button>
              <button
                onClick={() => setConfirm({ kind: "rotate" })}
                disabled={!students?.length}
                className="py-5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
              >
                Neues Jahr: Alle Passwörter neu
              </button>
            </div>
            <p className="text-[9px] text-zinc-600 mt-4 leading-relaxed uppercase font-bold italic">
              Neue Passwörter gelten sofort – alle Studenten werden abgemeldet. Danach Zettel drucken und an der Rezeption abgeben.
            </p>
          </div>
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-red-500/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Studentenliste */}
        <input
          className={`${inputClass} mb-6`}
          placeholder="Suche: Name, Zimmer, Benutzername"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {students === null ? (
          <p className="text-center text-[#deff9a] font-black uppercase tracking-widest animate-pulse py-10">Lade...</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] py-10">Keine Studenten</p>
        ) : (
          <div className="space-y-4">
            {visible.map((s) => {
              const isSuspended = suspendedOn(s, today);
              const isRevealed = revealed.has(s.uid);
              const age = ageOn(s, today);
              return (
                <div key={s.uid} className={`p-5 sm:p-6 rounded-[2.5rem] border transition-all duration-500 ${isSuspended ? "border-red-900/50 bg-red-950/20" : "border-zinc-800/50 bg-zinc-900/40"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className={`text-2xl font-black italic tracking-tighter uppercase block truncate ${isSuspended ? "text-red-500" : ""}`}>{s.name ?? s.username}</span>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1 truncate">
                        {s.username} · {age ?? "?"} J.
                      </p>
                    </div>
                    <span className="px-4 py-2 rounded-full bg-black/40 border border-[#deff9a]/20 text-[#deff9a] text-[10px] font-black uppercase tracking-widest shrink-0">
                      {s.room || "—"}
                    </span>
                  </div>

                  {isSuspended && (
                    <p className="mt-3 text-red-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                      Gesperrt bis {formatDate(s.suspendedUntil!, { day: "2-digit", month: "long" })}
                      {s.suspendReason && <span className="text-zinc-500"> · {s.suspendReason}</span>}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-3 bg-black/40 border border-zinc-800 p-3 pl-5 rounded-2xl">
                    <span className="flex-1 font-mono font-bold text-[#deff9a] tracking-wider">
                      {isRevealed ? s.password ?? "—" : "••••-••••"}
                    </span>
                    <button
                      onClick={() => setRevealed((prev) => {
                        const next = new Set(prev);
                        if (isRevealed) next.delete(s.uid); else next.add(s.uid);
                        return next;
                      })}
                      className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2"
                    >
                      {isRevealed ? "Verbergen" : "Zeigen"}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => router.push(printUrl([s.uid]))} className={`${pillClass} border-zinc-800 text-zinc-400`}>Drucken</button>
                    <button onClick={() => setConfirm({ kind: "reset", student: s })} className={`${pillClass} border-zinc-800 text-zinc-400`}>Passwort neu</button>
                    <button onClick={() => setEditTarget(s)} className={`${pillClass} border-zinc-800 text-zinc-400`}>Bearbeiten</button>
                    {isSuspended ? (
                      <button
                        onClick={() => run(async () => { await patchStudent(s.uid, { action: "unsuspend" }); showFeedback("Entsperrt"); await load(); })}
                        className={`${pillClass} border-[#deff9a]/30 bg-[#deff9a]/5 text-[#deff9a]`}
                      >
                        Entsperren
                      </button>
                    ) : (
                      <button onClick={() => setSuspendTarget(s)} className={`${pillClass} border-red-500/20 bg-red-500/10 text-red-500`}>Sperren</button>
                    )}
                    <button onClick={() => setConfirm({ kind: "delete", student: s })} className={`${pillClass} border-red-500/20 text-red-500`}>Löschen</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-16 border-t border-zinc-900 pt-8 flex justify-between items-center px-4">
          <p className="text-zinc-800 text-[8px] font-black uppercase tracking-[0.6em]">Core Engine v5.0</p>
          <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#deff9a] animate-pulse"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
          </div>
        </footer>
      </div>

      {/* Modal: Bestätigungen */}
      {confirm && (
        <ConfirmModal
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirm}
          {...(confirm.kind === "rotate"
            ? { title: "Neues Jahr?", text: `Alle ${students?.length ?? 0} Passwörter werden ersetzt. Alte Zugänge gehen sofort nicht mehr.`, confirmLabel: "Erneuern" }
            : confirm.kind === "reset"
              ? { title: confirm.student.name ?? confirm.student.username, text: "Neues Passwort erzeugen? Das alte gilt sofort nicht mehr.", confirmLabel: "Erneuern" }
              : { title: confirm.student.name ?? confirm.student.username, text: "Student endgültig löschen? Offene Buchungen werden entfernt.", confirmLabel: "Löschen" })}
        />
      )}

      {/* Modal: Sperren */}
      {suspendTarget && (
        <SuspendModal
          student={{ uid: suspendTarget.uid, name: suspendTarget.name ?? suspendTarget.username }}
          onClose={() => setSuspendTarget(null)}
          onDone={(text, type) => { showFeedback(text, type); load(); }}
        />
      )}

      {/* Modal: Bearbeiten */}
      {editTarget && (
        <EditModal
          student={editTarget}
          busy={busy}
          onClose={() => setEditTarget(null)}
          onSave={(values) => run(async () => {
            await patchStudent(editTarget.uid, { action: "update", ...values });
            showFeedback("Gespeichert");
            setEditTarget(null);
            await load();
          })}
        />
      )}

      {/* Modal: Neu angelegte Zugänge */}
      {created && (
        <ModalShell tone="green" padding="p-8 sm:p-12">
          <h3 className="text-3xl font-black italic uppercase mb-3 text-[#deff9a] tracking-tighter">Angelegt</h3>
          <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed">{created.length} neue Zugänge</p>
          <div className="space-y-2 mb-8 text-left max-h-64 overflow-y-auto">
            {created.map((c) => (
              <div key={c.uid} className="bg-black/40 border border-zinc-800 p-4 rounded-2xl">
                <span className="text-sm font-black uppercase tracking-tight text-white block truncate">{c.name} · {c.room}</span>
                <span className="font-mono text-[#deff9a] text-sm">{c.username} / {c.password}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <button onClick={() => setCreated(null)} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Fertig</button>
            <button onClick={() => router.push(printUrl(created.map((c) => c.uid)))} className="flex-1 py-4 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Drucken</button>
          </div>
        </ModalShell>
      )}

      {/* Modal: Passwörter erneuert */}
      {rotated !== null && (
        <ModalShell tone="green">
          <h3 className="text-3xl font-black italic uppercase mb-3 text-[#deff9a] tracking-tighter">Erneuert</h3>
          <p className="text-zinc-500 mb-10 text-[10px] uppercase tracking-widest leading-relaxed">{rotated} neue Passwörter. Jetzt Zettel drucken?</p>
          <div className="flex gap-4">
            <button onClick={() => setRotated(null)} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Später</button>
            <button onClick={() => router.push(printUrl())} className="flex-1 py-4 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Drucken</button>
          </div>
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

function EditModal({
  student,
  busy,
  onClose,
  onSave,
}: {
  student: StudentRecord;
  busy: boolean;
  onClose: () => void;
  onSave: (values: { name: string; room: string; birthDate: string }) => void;
}) {
  const [values, setValues] = useState({
    name: student.name ?? "",
    room: student.room ?? "",
    birthDate: student.birthDate ?? "",
  });

  return (
    <ModalShell tone="green" padding="p-8 sm:p-12">
      <h3 className="text-3xl font-black italic uppercase mb-3 text-[#deff9a] tracking-tighter">Bearbeiten</h3>
      <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed">Login bleibt: {student.username}</p>
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(values); }}
        className="space-y-3"
      >
        <input className={inputClass} placeholder="Name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
        <input className={`${inputClass} uppercase`} placeholder="Zimmer" value={values.room} onChange={(e) => setValues({ ...values, room: e.target.value })} required />
        <input className={inputClass} type="date" value={values.birthDate} onChange={(e) => setValues({ ...values, birthDate: e.target.value })} required />
        <div className="flex gap-4 pt-5">
          <button type="button" onClick={onClose} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Abbrechen</button>
          <button type="submit" disabled={busy} className="flex-1 py-4 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all disabled:opacity-50">
            {busy ? "..." : "Speichern"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
