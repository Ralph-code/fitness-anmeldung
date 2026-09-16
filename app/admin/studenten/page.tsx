"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { ageOn, formatDate, suspendedOn, zonedNow } from "@/lib/schedule";
import { NIGHT_KEY_MIN_AGE, NOTE_LABELS, NOTE_TYPES, type NoteTypeValue } from "@/lib/content";
import type { StudentRecord } from "@/lib/types";
import ConfirmModal, { ModalShell } from "@/components/ConfirmModal";
import SuspendModal from "@/components/SuspendModal";
import StatusBadges from "@/components/StatusBadges";
import { BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, LABEL, Loading, PILL } from "@/components/ui";

type Created = { uid: string; name: string; room: string; username: string; password: string };
type Confirm =
  | { kind: "delete" | "reset"; student: StudentRecord }
  | { kind: "bulkDelete"; uids: string[] }
  | { kind: "rotate" }
  | null;

const cardClass = "bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-5 sm:p-8 shadow-xl relative overflow-hidden";
const fieldLabel = "text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-2";

// "Name; Zimmer; Geburtsdatum[; Schule; Klasse]" – auch Tab-getrennt aus Excel
function parseBulk(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const [name = "", room = "", birthDate = "", school = "", schoolClass = ""] = line.split(sep).map((s) => s.trim());
      return { name, room, birthDate, school, schoolClass };
    });
}

const printUrl = (uids?: string[]) => `/admin/print${uids ? `?uids=${uids.join(",")}` : ""}`;

export default function AdminStudents() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", room: "", birthDate: "", school: "", schoolClass: "" });
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
  const [noteTarget, setNoteTarget] = useState<StudentRecord | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const showFeedback = useCallback((text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  }, []);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) router.replace("/start");
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

  const createStudents = (list: { name: string; room: string; birthDate: string; school?: string; schoolClass?: string }[]) =>
    run(async () => {
      const res = await apiFetch<{ created: Created[]; failed: { name: string; error: string }[] }>("/api/admin/students", {
        method: "POST",
        body: { students: list },
      });
      if (res.created.length) setCreated(res.created);
      if (res.failed.length) showFeedback(`${res.failed.length} fehlgeschlagen: ${res.failed[0].name}`, "error");
      setForm({ name: "", room: "", birthDate: "", school: "", schoolClass: "" });
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
        const res = await apiFetch<{ deleted: number; failed: number }>("/api/admin/students", { method: "DELETE", body: { uids: confirm.uids } });
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

  if (loading || !user?.isAdmin) return <Loading text="Admin Check..." />;

  const today = zonedNow().date;
  const term = search.trim().toLowerCase();
  const visible = (students ?? []).filter((s) =>
    !term || [s.name, s.room, s.username, s.school, s.schoolClass].some((v) => v?.toLowerCase().includes(term))
  );
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
    <div className={`min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 ${selectMode ? "pb-40" : "pb-24"} font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]`}>
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Studenten</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-8">{students?.length ?? "–"} im Heim</p>

        {/* Neuer Student */}
        <div className={`${cardClass} mb-6`}>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-5">
              <span className={`${LABEL} !mb-0`}>{bulkMode ? "Mehrere anlegen" : "Neuer Student"}</span>
              <button onClick={() => setBulkMode(!bulkMode)} className="text-[9px] font-black uppercase tracking-widest text-[var(--accent-text)]">
                {bulkMode ? "Einzeln" : "Liste importieren"}
              </button>
            </div>

            {bulkMode ? (
              <div className="space-y-4">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={7}
                  placeholder={"Max Mustermann; 101; 14.03.2009; TFO; 3A\nAnna Beispiel; 102B; 02.11.2010"}
                  className={`${INPUT} font-mono text-sm resize-y`}
                />
                <p className={HINT}>Eine Zeile pro Student: Name; Zimmer; Geburtsdatum; Schule (optional); Klasse (optional).</p>
                <button onClick={() => createStudents(bulkRows)} disabled={busy || bulkRows.length === 0} className={`${BTN_PRIMARY} w-full`}>
                  {busy ? "Lege an..." : `${bulkRows.length} Studenten anlegen`}
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); createStudents([form]); }} className="space-y-4">
                <input className={INPUT} placeholder="Vor- und Nachname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block min-w-0">
                    <span className={fieldLabel}>Zimmer</span>
                    <input className={`${INPUT} uppercase`} placeholder="101 oder 101A" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} required />
                  </label>
                  <label className="block min-w-0">
                    <span className={fieldLabel}>Geburtsdatum</span>
                    <input className={`${INPUT} min-h-[3.5rem]`} type="date" value={form.birthDate} max={today} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} required />
                  </label>
                  <label className="block min-w-0">
                    <span className={fieldLabel}>Schule (optional)</span>
                    <input className={INPUT} placeholder="z.B. TFO" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
                  </label>
                  <label className="block min-w-0">
                    <span className={fieldLabel}>Klasse (optional)</span>
                    <input className={`${INPUT} uppercase`} placeholder="z.B. 3A" value={form.schoolClass} onChange={(e) => setForm({ ...form, schoolClass: e.target.value })} />
                  </label>
                </div>
                <button type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full`}>{busy ? "Lege an..." : "Anlegen"}</button>
              </form>
            )}
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[var(--accent-05)] blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Zugangsdaten & neues Jahr */}
        <div className={`${cardClass} mb-8`}>
          <div className="relative z-10">
            <span className={LABEL}>Zugangsdaten & neues Jahr</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href={printUrl()} className={`${BTN_PRIMARY} text-center ${students?.length ? "" : "pointer-events-none opacity-40"}`}>Alle drucken</Link>
              <button onClick={() => setConfirm({ kind: "rotate" })} disabled={!students?.length} className="py-4 px-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-40">
                Alle Passwörter neu
              </button>
              <button onClick={() => students && setConfirm({ kind: "bulkDelete", uids: students.map((s) => s.uid) })} disabled={!students?.length} className="sm:col-span-2 py-4 px-4 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-40">
                Alle Studenten löschen
              </button>
            </div>
            <p className={`${HINT} mt-4`}>Neues Schuljahr: alte Studenten löschen oder Passwörter erneuern, neue Liste importieren, Zettel drucken.</p>
          </div>
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-red-500/5 blur-[90px] rounded-full pointer-events-none"></div>
        </div>

        {/* Liste */}
        <input className={`${INPUT} mb-4`} placeholder="Suche: Name, Zimmer, Schule, Klasse" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center justify-between gap-4 mb-4 px-2">
          <span className="text-[var(--text-dim)] text-[9px] font-black uppercase tracking-[0.3em]">{visible.length} Studenten</span>
          <button
            onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
            disabled={!students?.length}
            className={`${PILL} disabled:opacity-30 ${selectMode ? "border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
          >
            {selectMode ? "Fertig" : "Auswählen"}
          </button>
        </div>

        {students === null ? (
          <EmptyState>Lädt...</EmptyState>
        ) : visible.length === 0 ? (
          <div className={CARD}><EmptyState>Keine Studenten</EmptyState></div>
        ) : (
          <div className="space-y-3">
            {visible.map((s) => {
              const isSuspended = suspendedOn(s, today);
              const isRevealed = revealed.has(s.uid);
              const isSelected = selectMode && selected.has(s.uid);
              const age = ageOn(s, today);
              return (
                <div
                  key={s.uid}
                  onClick={selectMode ? () => toggleSelected(s.uid) : undefined}
                  className={`p-5 rounded-[1.75rem] border transition-all duration-300 ${selectMode ? "cursor-pointer select-none active:scale-[0.99]" : ""} ${
                    isSelected ? "border-red-500/50 bg-red-500/5" : isSuspended ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : "border-[var(--border-soft)] bg-[var(--surface-soft)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {selectMode && (
                      <div className={`mt-1 w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition-all ${isSelected ? "border-red-500 bg-red-500 text-[var(--accent-contrast)]" : "border-[var(--border-strong)]"}`}>
                        {isSelected && "✓"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className={`text-xl font-black italic tracking-tighter uppercase block truncate ${isSuspended ? "text-red-500" : ""}`}>{s.name ?? s.username}</span>
                      <p className="text-[var(--text-dim)] text-[11px] mt-1 truncate">
                        {s.username} · {age ?? "?"} J.{s.school ? ` · ${s.school}` : ""}{s.schoolClass ? ` ${s.schoolClass}` : ""}
                      </p>
                      <div className="mt-2"><StatusBadges profile={s} date={today} /></div>
                    </div>
                    <span className="px-3 py-2 rounded-full bg-[var(--inset)] border border-[var(--accent-20)] text-[var(--accent-text)] text-[10px] font-black uppercase tracking-widest shrink-0">
                      {s.room || "—"}
                    </span>
                  </div>

                  {!selectMode && (
                    <>
                      {isSuspended && (
                        <p className="mt-3 text-red-500 text-[11px] font-bold leading-relaxed">
                          Gesperrt bis {formatDate(s.suspendedUntil!, { day: "2-digit", month: "long" })}
                          {s.suspendReason && <span className="text-[var(--text-dim)]"> · {s.suspendReason}</span>}
                        </p>
                      )}
                      {s.dietary && <p className={`${HINT} mt-2`}>Unverträglichkeit: {s.dietary}</p>}

                      <div className="mt-4 flex items-center gap-3 bg-[var(--inset)] border border-[var(--border)] p-3 pl-4 rounded-2xl">
                        <span className="flex-1 min-w-0 truncate font-mono font-bold text-[var(--accent-text)] tracking-wider text-sm">
                          {s.passwordChangedByUser ? "selbst geändert" : isRevealed ? s.password ?? "—" : "••••-••••"}
                        </span>
                        {!s.passwordChangedByUser && (
                          <button
                            onClick={() => setRevealed((prev) => {
                              const next = new Set(prev);
                              if (isRevealed) next.delete(s.uid); else next.add(s.uid);
                              return next;
                            })}
                            className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)] px-3 py-2 shrink-0"
                          >
                            {isRevealed ? "Verbergen" : "Zeigen"}
                          </button>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => toggleApproval(s)} className={`${PILL} ${s.approved ? "border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                          {s.approved ? "✓ Bestätigt" : "Bestätigen"}
                        </button>
                        <button onClick={() => setNoteTarget(s)} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Vermerk</button>
                        <button onClick={() => setEditTarget(s)} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Bearbeiten</button>
                        <Link href={printUrl([s.uid])} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Drucken</Link>
                        <button onClick={() => setConfirm({ kind: "reset", student: s })} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Passwort neu</button>
                        {isSuspended ? (
                          <button onClick={() => run(async () => { await patchStudent(s.uid, { action: "unsuspend" }); showFeedback("Entsperrt"); await load(); })} className={`${PILL} border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)]`}>
                            Entsperren
                          </button>
                        ) : (
                          <button onClick={() => setSuspendTarget(s)} className={`${PILL} border-red-500/20 bg-red-500/10 text-red-500`}>Sperren</button>
                        )}
                        <button onClick={() => setConfirm({ kind: "delete", student: s })} className={`${PILL} border-red-500/20 text-red-500`}>Löschen</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auswahl-Leiste */}
      {selectMode && (
        <div className="fixed bottom-0 inset-x-0 z-[400] bg-[var(--overlay)] backdrop-blur-xl border-t border-[var(--border)] p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button onClick={toggleAllVisible} className={`${BTN_GHOST} flex-1`}>{allVisibleSelected ? "Keine" : `Alle (${visible.length})`}</button>
            <button
              onClick={() => setConfirm({ kind: "bulkDelete", uids: [...selected] })}
              disabled={selected.size === 0}
              className="flex-[1.4] py-4 px-5 bg-red-600 text-[var(--text)] rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-30"
            >
              {selected.size} löschen
            </button>
          </div>
        </div>
      )}

      {confirm && confirmProps && (
        <ConfirmModal key={confirm.kind} busy={busy} onCancel={() => setConfirm(null)} onConfirm={handleConfirm} {...confirmProps} />
      )}

      {suspendTarget && (
        <SuspendModal
          student={{ uid: suspendTarget.uid, name: suspendTarget.name ?? suspendTarget.username }}
          onClose={() => setSuspendTarget(null)}
          onDone={(text, type) => { showFeedback(text, type); load(); }}
        />
      )}

      {noteTarget && (
        <NoteModal
          student={noteTarget}
          busy={busy}
          onClose={() => setNoteTarget(null)}
          onSave={(body) => run(async () => {
            await apiFetch("/api/admin/notes", { method: "POST", body: { uid: noteTarget.uid, ...body } });
            setNoteTarget(null);
            showFeedback("Vermerk gespeichert");
          })}
        />
      )}

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

      {created && (
        <ModalShell tone="green">
          <h3 className="text-3xl font-black italic uppercase mb-3 text-[var(--accent-text)] tracking-tighter">Angelegt</h3>
          <p className="text-[var(--text-dim)] mb-8 text-[10px] uppercase tracking-widest">{created.length} neue Zugänge</p>
          <div className="space-y-2 mb-8 text-left max-h-64 overflow-y-auto">
            {created.map((c) => (
              <div key={c.uid} className="bg-[var(--inset)] border border-[var(--border)] p-4 rounded-2xl">
                <span className="text-sm font-black uppercase tracking-tight text-[var(--text)] block truncate">{c.name} · {c.room}</span>
                <span className="font-mono text-[var(--accent-text)] text-sm break-all">{c.username} / {c.password}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCreated(null)} className={`${BTN_GHOST} flex-1`}>Fertig</button>
            <button onClick={() => router.push(printUrl(created.map((c) => c.uid)))} className={`${BTN_PRIMARY} flex-1`}>Drucken</button>
          </div>
        </ModalShell>
      )}

      {rotated !== null && (
        <ModalShell tone="green">
          <h3 className="text-3xl font-black italic uppercase mb-3 text-[var(--accent-text)] tracking-tighter">Erneuert</h3>
          <p className="text-[var(--text-dim)] mb-10 text-[10px] uppercase tracking-widest">{rotated} neue Passwörter. Jetzt Zettel drucken?</p>
          <div className="flex gap-3">
            <button onClick={() => setRotated(null)} className={`${BTN_GHOST} flex-1`}>Später</button>
            <button onClick={() => router.push(printUrl())} className={`${BTN_PRIMARY} flex-1`}>Drucken</button>
          </div>
        </ModalShell>
      )}

      {statusMsg && (
        <div className={`fixed ${selectMode ? "bottom-28" : "bottom-10"} left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in`}>
          <div className={`p-5 rounded-2xl border text-center font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl ${
            statusMsg.type === "success" ? "bg-[var(--bg)] border-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg)] border-red-500 text-red-500"
          }`}>
            {statusMsg.text}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteModal({
  student,
  busy,
  onClose,
  onSave,
}: {
  student: StudentRecord;
  busy: boolean;
  onClose: () => void;
  onSave: (values: { type: NoteTypeValue; text: string }) => void;
}) {
  const [type, setType] = useState<NoteTypeValue>("notiz");
  const [text, setText] = useState("");

  return (
    <ModalShell tone={type === "verweis" ? "red" : "green"}>
      <h3 className="text-2xl font-black italic uppercase mb-2 tracking-tighter">{student.name ?? student.username}</h3>
      <p className="text-[var(--text-dim)] mb-6 text-[10px] uppercase tracking-widest">Vermerk ist im Profil des Studenten sichtbar</p>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ type, text }); }} className="space-y-4 text-left">
        <div className="flex gap-2">
          {NOTE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                type === t ? (t === "verweis" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]") : "border-[var(--border)] text-[var(--text-dim)]"
              }`}
            >
              {NOTE_LABELS[t]}
            </button>
          ))}
        </div>
        <textarea className={`${INPUT} resize-y`} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Was ist vorgefallen?" required maxLength={500} />
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`${BTN_GHOST} flex-1`}>Abbrechen</button>
          <button type="submit" disabled={busy || !text.trim()} className={`${BTN_PRIMARY} flex-1`}>{busy ? "..." : "Speichern"}</button>
        </div>
      </form>
    </ModalShell>
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
  onSave: (values: { name: string; room: string; birthDate: string; school: string; schoolClass: string; dietary: string; smoker: boolean; nightKey: boolean; studyRequired: boolean }) => void;
}) {
  const [values, setValues] = useState({
    name: student.name ?? "",
    room: student.room ?? "",
    birthDate: student.birthDate ?? "",
    school: student.school ?? "",
    schoolClass: student.schoolClass ?? "",
    dietary: student.dietary ?? "",
    smoker: student.smoker === true,
    nightKey: student.nightKey === true,
    studyRequired: student.studyRequired !== false,
  });

  const age = ageOn({ birthDate: values.birthDate }, zonedNow().date);
  const nightKeyAllowed = age !== null && age >= NIGHT_KEY_MIN_AGE;

  return (
    <ModalShell tone="green">
      <h3 className="text-3xl font-black italic uppercase mb-2 text-[var(--accent-text)] tracking-tighter">Bearbeiten</h3>
      <p className="text-[var(--text-dim)] mb-6 text-[10px] uppercase tracking-widest break-all">Login bleibt: {student.username}</p>
      <form onSubmit={(e) => { e.preventDefault(); onSave(values); }} className="space-y-3 text-left">
        <input className={INPUT} placeholder="Name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <input className={`${INPUT} uppercase`} placeholder="Zimmer" value={values.room} onChange={(e) => setValues({ ...values, room: e.target.value })} required />
          <input className={`${INPUT} min-h-[3.5rem]`} type="date" value={values.birthDate} onChange={(e) => setValues({ ...values, birthDate: e.target.value })} required />
          <input className={INPUT} placeholder="Schule" value={values.school} onChange={(e) => setValues({ ...values, school: e.target.value })} />
          <input className={`${INPUT} uppercase`} placeholder="Klasse" value={values.schoolClass} onChange={(e) => setValues({ ...values, schoolClass: e.target.value })} />
        </div>
        <input className={INPUT} placeholder="Unverträglichkeiten / Allergien" value={values.dietary} onChange={(e) => setValues({ ...values, dietary: e.target.value })} maxLength={300} />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setValues({ ...values, smoker: !values.smoker })}
            className={`py-3.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${values.smoker ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-[var(--border)] text-[var(--text-dim)]"}`}
          >
            {values.smoker ? "Raucher" : "Nichtraucher"}
          </button>
          <button
            type="button"
            disabled={!nightKeyAllowed}
            onClick={() => setValues({ ...values, nightKey: !values.nightKey })}
            className={`py-3.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40 ${values.nightKey ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"}`}
          >
            {nightKeyAllowed ? (values.nightKey ? "Nachtschlüssel ✓" : "Nachtschlüssel") : `Schlüssel ab ${NIGHT_KEY_MIN_AGE}`}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setValues({ ...values, studyRequired: !values.studyRequired })}
          className={`w-full py-3.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
            values.studyRequired ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
          }`}
        >
          {values.studyRequired ? "Studierzeit: Pflicht ✓" : "Studierzeit: keine Pflicht"}
        </button>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className={`${BTN_GHOST} flex-1`}>Abbrechen</button>
          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{busy ? "..." : "Speichern"}</button>
        </div>
      </form>
    </ModalShell>
  );
}
