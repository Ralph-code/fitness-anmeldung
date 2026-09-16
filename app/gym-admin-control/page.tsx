"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ageOn, formatDate, suspendedOn, zonedNow } from "@/lib/schedule";
import type { StudentRecord } from "@/lib/types";
import ConfirmModal, { ModalShell } from "@/components/ConfirmModal";
import SuspendModal from "@/components/SuspendModal";
import StatusBadges from "@/components/StatusBadges";
import AdminPasswordCard from "@/components/AdminPasswordCard";

type Created = { uid: string; name: string; room: string; username: string; password: string };
type Confirm =
  | { kind: "delete" | "reset"; student: StudentRecord }
  | { kind: "bulkDelete"; uids: string[] }
  | { kind: "rotate" }
  | null;

const inputClass = "w-full p-4 sm:p-5 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-bold transition-all placeholder:text-zinc-700 [color-scheme:dark]";
const labelClass = "text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] block mb-4";
const fieldLabelClass = "text-zinc-600 text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-2";
const cardClass = "bg-zinc-900 border border-zinc-800 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden";
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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    apiFetch<{ password?: string; removed?: number }>(`/api/admin/students/${uid}`, { method: "PATCH", body });

  const toggleApproval = (s: StudentRecord) =>
    run(async () => {
      const res = await patchStudent(s.uid, { action: "setApproval", approved: !s.approved });
      if (s.approved) showFeedback(res.removed ? `Bestätigung entfernt · ${res.removed} storniert` : "Bestätigung entfernt", "error");
      else showFeedback("Bestätigt");
      await load();
    });

  const handleConfirm = () =>
    run(async () => {
      if (!confirm) return;
      if (confirm.kind === "rotate") {
        const res = await apiFetch<{ updated: number; failed: number }>("/api/admin/passwords", { method: "POST" });
        if (res.failed) showFeedback(`${res.failed} Passwörter fehlgeschlagen`, "error");
        setRotated(res.updated);
      } else if (confirm.kind === "bulkDelete") {
        const res = await apiFetch<{ deleted: number; failed: number }>("/api/admin/students", {
          method: "DELETE",
          body: { uids: confirm.uids },
        });
        showFeedback(res.failed ? `${res.deleted} gelöscht · ${res.failed} Fehler` : `${res.deleted} gelöscht`, "error");
        setSelected(new Set());
        setSelectMode(false);
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
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.uid));

  const toggleSelected = (uid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((s) => (allVisibleSelected ? next.delete(s.uid) : next.add(s.uid)));
      return next;
    });

  const confirmProps =
    confirm?.kind === "rotate"
      ? { title: "Neues Jahr?", text: `Alle ${students?.length ?? 0} Passwörter werden ersetzt. Alte Zugänge gehen sofort nicht mehr.`, confirmLabel: "Erneuern" }
      : confirm?.kind === "bulkDelete"
        ? {
            title: confirm.uids.length === 1 ? "1 Student löschen?" : `${confirm.uids.length} Studenten löschen?`,
            text: "Konten, Passwörter und offene Buchungen werden endgültig entfernt. Zum Bestätigen LÖSCHEN eingeben.",
            confirmLabel: "Löschen",
            requireTyping: "LÖSCHEN",
          }
        : confirm?.kind === "reset"
          ? { title: confirm.student.name ?? confirm.student.username, text: "Neues Passwort erzeugen? Das alte gilt sofort nicht mehr.", confirmLabel: "Erneuern" }
          : confirm?.kind === "delete"
            ? { title: confirm.student.name ?? confirm.student.username, text: "Student endgültig löschen? Offene Buchungen werden entfernt.", confirmLabel: "Löschen" }
            : null;

  return (
    <div className={`min-h-screen bg-black text-white p-4 sm:p-6 ${selectMode ? "pb-40" : "pb-24"} font-sans selection:bg-[#deff9a] selection:text-black`}>
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">

        {/* Back Navigation */}
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-8 sm:mb-10 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
        >
          <span className="text-lg">←</span> Dashboard
        </button>

        <h1 className="text-4xl font-black italic text-[#deff9a] uppercase tracking-tighter mb-2">Control</h1>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mb-10 sm:mb-12">Studenten & Zugänge</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-800/50 bg-zinc-900/40 text-center">
            <span className="text-4xl sm:text-5xl font-black italic tracking-tighter block">{students?.length ?? "–"}</span>
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em]">Studenten</span>
          </div>
          <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border text-center ${suspendedCount ? "border-red-900/50 bg-red-950/20" : "border-zinc-800/50 bg-zinc-900/40"}`}>
            <span className={`text-4xl sm:text-5xl font-black italic tracking-tighter block ${suspendedCount ? "text-red-500" : ""}`}>{students ? suspendedCount : "–"}</span>
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em]">Gesperrt</span>
          </div>
        </div>

        {/* Neuer Student */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-6">
              <span className={`${labelClass} !mb-0`}>{bulkMode ? "Mehrere anlegen" : "Neuer Student"}</span>
              <button onClick={() => setBulkMode(!bulkMode)} className="text-[9px] font-black uppercase tracking-widest text-[#deff9a] text-right">
                {bulkMode ? "Einzeln" : "Liste importieren"}
              </button>
            </div>

            {bulkMode ? (
              <div className="space-y-4">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={8}
                  placeholder={"Max Mustermann; 101; 14.03.2009\nAnna Beispiel; 102B; 02.11.2010"}
                  className={`${inputClass} font-mono text-sm resize-y`}
                />
                <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-bold italic">
                  Eine Zeile pro Student: Name; Zimmer; Geburtsdatum. Direkt aus Excel kopieren geht auch.
                </p>
                <button
                  onClick={() => createStudents(bulkRows)}
                  disabled={busy || bulkRows.length === 0}
                  className="w-full py-5 sm:py-6 bg-[#deff9a] text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-50"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block min-w-0">
                    <span className={fieldLabelClass}>Zimmer</span>
                    <input className={`${inputClass} uppercase`} placeholder="101 oder 101A" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} required />
                  </label>
                  <label className="block min-w-0">
                    <span className={fieldLabelClass}>Geburtsdatum</span>
                    <input className={`${inputClass} min-h-[3.5rem] sm:min-h-[4rem]`} type="date" value={form.birthDate} max={today} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} required />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-5 sm:py-6 bg-[#deff9a] text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_15px_40px_rgba(222,255,154,0.15)] disabled:opacity-50"
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
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <span className={`${labelClass} !mb-2`}>Zeitplan</span>
              <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-bold italic">Slots, Uhrzeiten, Plätze, 16+ & Bestätigung</p>
            </div>
            <button
              onClick={() => router.push("/gym-admin-control/slots")}
              className="px-6 py-5 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shrink-0"
            >
              Slots bearbeiten
            </button>
          </div>
        </div>

        {/* Admins (nur Superadmin) */}
        {user.isSuperAdmin && (
          <div className={`${cardClass} mb-6`}>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <span className={`${labelClass} !mb-2`}>Admins</span>
                <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-bold italic">Admins anlegen, Passwort neu, löschen</p>
              </div>
              <button
                onClick={() => router.push("/gym-admin-control/admins")}
                className="px-6 py-5 bg-black border border-[#deff9a]/30 text-[#deff9a] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shrink-0"
              >
                Admins verwalten
              </button>
            </div>
          </div>
        )}

        {/* Zugangsdaten & neues Schuljahr */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <span className={labelClass}>Zugangsdaten & neues Jahr</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                className="py-5 px-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
              >
                Alle Passwörter neu
              </button>
              <button
                onClick={() => students && setConfirm({ kind: "bulkDelete", uids: students.map((s) => s.uid) })}
                disabled={!students?.length}
                className="sm:col-span-2 py-5 px-4 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
              >
                Alle Studenten löschen
              </button>
            </div>
            <p className="text-[9px] text-zinc-600 mt-4 leading-relaxed uppercase font-bold italic">
              Neues Schuljahr: alte Studenten löschen oder Passwörter erneuern, neue Liste importieren, Zettel drucken und an der Rezeption abgeben.
            </p>
          </div>
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-red-500/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Admin-Passwort */}
        <div className="mb-10 sm:mb-12">
          <AdminPasswordCard onDone={showFeedback} />
        </div>

        {/* Studentenliste */}
        <input
          className={`${inputClass} mb-4`}
          placeholder="Suche: Name, Zimmer, Benutzername"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center justify-between gap-4 mb-4 px-2">
          <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em]">{visible.length} Studenten</span>
          <button
            onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
            disabled={!students?.length}
            className={`${pillClass} disabled:opacity-30 ${selectMode ? "border-[#deff9a]/30 bg-[#deff9a]/5 text-[#deff9a]" : "border-zinc-800 text-zinc-400"}`}
          >
            {selectMode ? "Fertig" : "Auswählen"}
          </button>
        </div>

        {students === null ? (
          <p className="text-center text-[#deff9a] font-black uppercase tracking-widest animate-pulse py-10">Lade...</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] py-10">Keine Studenten</p>
        ) : (
          <div className="space-y-4">
            {visible.map((s) => {
              const isSuspended = suspendedOn(s, today);
              const isRevealed = revealed.has(s.uid);
              const isSelected = selectMode && selected.has(s.uid);
              const age = ageOn(s, today);
              return (
                <div
                  key={s.uid}
                  onClick={selectMode ? () => toggleSelected(s.uid) : undefined}
                  className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border transition-all duration-300 ${selectMode ? "cursor-pointer select-none active:scale-[0.98]" : ""} ${
                    isSelected ? "border-red-500/50 bg-red-500/5" : isSuspended ? "border-red-900/50 bg-red-950/20" : "border-zinc-800/50 bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {selectMode && (
                      <div className={`mt-1 w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition-all ${isSelected ? "border-red-500 bg-red-500 text-black" : "border-zinc-700"}`}>
                        {isSelected && "✓"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className={`text-xl sm:text-2xl font-black italic tracking-tighter uppercase block truncate ${isSuspended ? "text-red-500" : ""}`}>{s.name ?? s.username}</span>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1 truncate">
                        {s.username} · {age ?? "?"} J.
                      </p>
                      <div className="mt-2">
                        <StatusBadges profile={s} date={today} />
                      </div>
                    </div>
                    <span className="px-3 sm:px-4 py-2 rounded-full bg-black/40 border border-[#deff9a]/20 text-[#deff9a] text-[10px] font-black uppercase tracking-widest shrink-0">
                      {s.room || "—"}
                    </span>
                  </div>

                  {!selectMode && (
                    <>
                      {isSuspended && (
                        <p className="mt-3 text-red-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                          Gesperrt bis {formatDate(s.suspendedUntil!, { day: "2-digit", month: "long" })}
                          {s.suspendReason && <span className="text-zinc-500"> · {s.suspendReason}</span>}
                        </p>
                      )}

                      <div className="mt-4 flex items-center gap-3 bg-black/40 border border-zinc-800 p-3 pl-4 sm:pl-5 rounded-2xl">
                        <span className="flex-1 min-w-0 truncate font-mono font-bold text-[#deff9a] tracking-wider">
                          {isRevealed ? s.password ?? "—" : "••••-••••"}
                        </span>
                        <button
                          onClick={() => setRevealed((prev) => {
                            const next = new Set(prev);
                            if (isRevealed) next.delete(s.uid); else next.add(s.uid);
                            return next;
                          })}
                          className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 shrink-0"
                        >
                          {isRevealed ? "Verbergen" : "Zeigen"}
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleApproval(s)}
                          className={`${pillClass} ${s.approved ? "border-[#deff9a]/30 bg-[#deff9a]/5 text-[#deff9a]" : "border-zinc-800 text-zinc-400"}`}
                        >
                          {s.approved ? "✓ Bestätigt" : "Bestätigen"}
                        </button>
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-16 border-t border-zinc-900 pt-8 flex justify-between items-center px-4">
          <p className="text-zinc-800 text-[8px] font-black uppercase tracking-[0.6em]">Core Engine v5.1</p>
          <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#deff9a] animate-pulse"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
          </div>
        </footer>
      </div>

      {/* Auswahl-Leiste */}
      {selectMode && (
        <div className="fixed bottom-0 inset-x-0 z-[400] bg-black/80 backdrop-blur-xl border-t border-zinc-900 p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              onClick={toggleAllVisible}
              className="flex-1 py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all"
            >
              {allVisibleSelected ? "Keine" : `Alle (${visible.length})`}
            </button>
            <button
              onClick={() => setConfirm({ kind: "bulkDelete", uids: [...selected] })}
              disabled={selected.size === 0}
              className="flex-[1.4] py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_10px_20px_rgba(220,38,38,0.3)] disabled:opacity-30"
            >
              {selected.size} löschen
            </button>
          </div>
        </div>
      )}

      {/* Modal: Bestätigungen */}
      {confirm && confirmProps && (
        <ConfirmModal
          key={confirm.kind}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirm}
          {...confirmProps}
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
        <ModalShell tone="green">
          <h3 className="text-3xl font-black italic uppercase mb-3 text-[#deff9a] tracking-tighter">Angelegt</h3>
          <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed">{created.length} neue Zugänge</p>
          <div className="space-y-2 mb-8 text-left max-h-64 overflow-y-auto">
            {created.map((c) => (
              <div key={c.uid} className="bg-black/40 border border-zinc-800 p-4 rounded-2xl">
                <span className="text-sm font-black uppercase tracking-tight text-white block truncate">{c.name} · {c.room}</span>
                <span className="font-mono text-[#deff9a] text-sm break-all">{c.username} / {c.password}</span>
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
        <div className={`fixed ${selectMode ? "bottom-28" : "bottom-10"} left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in`}>
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
    <ModalShell tone="green">
      <h3 className="text-3xl font-black italic uppercase mb-3 text-[#deff9a] tracking-tighter">Bearbeiten</h3>
      <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed break-all">Login bleibt: {student.username}</p>
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(values); }}
        className="space-y-3 text-left"
      >
        <input className={inputClass} placeholder="Name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
        <input className={`${inputClass} uppercase`} placeholder="Zimmer" value={values.room} onChange={(e) => setValues({ ...values, room: e.target.value })} required />
        <input className={`${inputClass} min-h-[3.5rem]`} type="date" value={values.birthDate} onChange={(e) => setValues({ ...values, birthDate: e.target.value })} required />
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
