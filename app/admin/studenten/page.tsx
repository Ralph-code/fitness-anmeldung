"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { ageOn, formatDate, suspendedOn, zonedNow } from "@/lib/schedule";
import type { StudentRecord } from "@/lib/types";
import AdminPage from "@/components/AdminPage";
import ConfirmModal, { ModalShell } from "@/components/ConfirmModal";
import SuspendModal from "@/components/SuspendModal";
import StatusBadges from "@/components/StatusBadges";
import { Toast, useToast } from "@/components/Toast";
import Tour from "@/components/Tour";
import { BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, LABEL, PILL } from "@/components/ui";

type Created = { uid: string; name: string; room: string; username: string; password: string };
type Confirm =
  | { kind: "delete" | "reset"; student: StudentRecord }
  | { kind: "bulkDelete"; uids: string[] }
  | { kind: "rotate" }
  | null;

const cardClass = "bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-5 sm:p-8 shadow-xl relative overflow-hidden";
const fieldLabel = "text-[var(--text-faint)] text-[8px] font-black uppercase tracking-[0.3em] block mb-2 ml-2";

// "Name; Zimmer; Geburtsdatum" – auch Tab-getrennt aus Excel
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

const printUrl = (uids?: string[]) => `/admin/print${uids ? `?uids=${uids.join(",")}` : ""}`;

export default function AdminStudents() {
  const { user } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", room: "", birthDate: "" });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, showToast } = useToast();
  const [created, setCreated] = useState<Created[] | null>(null);
  const [rotated, setRotated] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [suspendTarget, setSuspendTarget] = useState<StudentRecord | null>(null);
  const [editTarget, setEditTarget] = useState<StudentRecord | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(
    () =>
      apiFetch<{ students: StudentRecord[] }>("/api/admin/students").then(
        (data) => setStudents(data.students),
        (e: Error) => showToast(e.message, "error")
      ),
    [showToast]
  );

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    apiFetch<{ students: StudentRecord[] }>("/api/admin/students").then(
      (data) => active && setStudents(data.students),
      (e: Error) => active && showToast(e.message, "error")
    );
    return () => { active = false; };
  }, [user?.isAdmin, showToast]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      showToast((e as Error).message, "error");
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
      if (res.failed.length) showToast(`${res.failed.length} fehlgeschlagen: ${res.failed[0].name}`, "error");
      setForm({ name: "", room: "", birthDate: "" });
      setBulkText("");
      await load();
    });

  const patchStudent = (uid: string, body: object) =>
    apiFetch<{ password?: string; removed?: number }>(`/api/admin/students/${uid}`, { method: "PATCH", body });

  const handleConfirm = () =>
    run(async () => {
      if (!confirm) return;
      if (confirm.kind === "rotate") {
        const res = await apiFetch<{ updated: number; failed: number }>("/api/admin/passwords", { method: "POST" });
        if (res.failed) showToast(`${res.failed} Passwörter fehlgeschlagen`, "error");
        setRotated(res.updated);
      } else if (confirm.kind === "bulkDelete") {
        const res = await apiFetch<{ deleted: number; failed: number }>("/api/admin/students", { method: "DELETE", body: { uids: confirm.uids } });
        showToast(res.failed ? `${res.deleted} gelöscht · ${res.failed} Fehler` : `${res.deleted} gelöscht`, "error");
        setSelected(new Set());
        setSelectMode(false);
      } else if (confirm.kind === "reset") {
        await patchStudent(confirm.student.uid, { action: "resetPassword" });
        setRevealed((prev) => new Set(prev).add(confirm.student.uid));
        showToast("Neues Passwort");
      } else {
        await apiFetch(`/api/admin/students/${confirm.student.uid}`, { method: "DELETE" });
        showToast("Student gelöscht", "error");
      }
      setConfirm(null);
      await load();
    });

  const today = zonedNow().date;
  const term = search.trim().toLowerCase();
  const visible = (students ?? []).filter((s) =>
    !term || [s.name, s.room, s.username].some((v) => v?.toLowerCase().includes(term))
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
    <AdminPage title="Studenten" subtitle={`${students?.length ?? "–"} Studenten`} className={selectMode ? "pb-40" : "pb-24"}>
      {/* Neuer Student */}
      <div className={`${cardClass} mb-6`} data-tour="students-new">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 mb-5">
            <span className={`${LABEL} !mb-0`}>{bulkMode ? "Mehrere anlegen" : "Neuer Student"}</span>
            <button data-tour="students-import" onClick={() => setBulkMode(!bulkMode)} className="text-[9px] font-black uppercase tracking-widest text-[var(--accent-text)]">
              {bulkMode ? "Einzeln" : "Liste importieren"}
            </button>
          </div>

          {bulkMode ? (
            <div className="space-y-4">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={7}
                placeholder={"Max Mustermann; 101; 14.03.2009\nAnna Beispiel; 102B; 02.11.2010"}
                className={`${INPUT} font-mono text-sm resize-y`}
              />
              <p className={HINT}>Eine Zeile pro Student: Name; Zimmer; Geburtsdatum.</p>
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
              </div>
              <button type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full`}>{busy ? "Lege an..." : "Anlegen"}</button>
            </form>
          )}
        </div>
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[var(--accent-05)] blur-[90px] rounded-full pointer-events-none"></div>
      </div>

      {/* Zugangsdaten & neues Jahr */}
      <div className={`${cardClass} mb-8`} data-tour="students-year">
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
      <input data-tour="students-search" className={`${INPUT} mb-4`} placeholder="Suche: Name, Zimmer" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="flex items-center justify-between gap-4 mb-4 px-2">
        <span className="text-[var(--text-dim)] text-[9px] font-black uppercase tracking-[0.3em]">{visible.length} Studenten</span>
        <button
          data-tour="students-select"
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
          {visible.map((s, index) => {
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
                      {s.username} · {age ?? "?"} J.
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

                    <div data-tour={index === 0 ? "students-password" : undefined} className="mt-4 flex items-center gap-3 bg-[var(--inset)] border border-[var(--border)] p-3 pl-4 rounded-2xl">
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

                    <div data-tour={index === 0 ? "students-actions" : undefined} className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setEditTarget(s)} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Bearbeiten</button>
                      <Link href={printUrl([s.uid])} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Drucken</Link>
                      <button onClick={() => setConfirm({ kind: "reset", student: s })} className={`${PILL} border-[var(--border)] text-[var(--text-muted)]`}>Passwort neu</button>
                      {isSuspended ? (
                        <button onClick={() => run(async () => { await patchStudent(s.uid, { action: "unsuspend" }); showToast("Entsperrt"); await load(); })} className={`${PILL} border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)]`}>
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

      {/* Auswahl-Leiste */}
      {selectMode && (
      <div className="fixed bottom-0 inset-x-0 z-[400] bg-[var(--overlay)] backdrop-blur-xl border-t border-[var(--border)] p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button onClick={toggleAllVisible} className={`${BTN_GHOST} flex-1`}>{allVisibleSelected ? "Keine" : `Alle (${visible.length})`}</button>
          <button
            onClick={() => setConfirm({ kind: "bulkDelete", uids: [...selected] })}
            disabled={selected.size === 0}
            className="flex-[1.4] py-4 px-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-30"
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
        onDone={(text, type) => { showToast(text, type); load(); }}
      />
      )}

      {editTarget && (
      <EditModal
        student={editTarget}
        busy={busy}
        onClose={() => setEditTarget(null)}
        onSave={({ approved, ...values }) => run(async () => {
          await patchStudent(editTarget.uid, { action: "update", ...values });
          let removed = 0;
          if (approved !== (editTarget.approved === true)) {
            removed = (await patchStudent(editTarget.uid, { action: "setApproval", approved })).removed ?? 0;
          }
          showToast(removed ? `Gespeichert · ${removed} storniert` : "Gespeichert");
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

      <Toast toast={toast} position={selectMode ? "bottom-28" : "bottom-10"} />
      <Tour id="students" />
    </AdminPage>
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
  onSave: (values: { name: string; room: string; birthDate: string; approved: boolean }) => void;
}) {
  const [values, setValues] = useState({
    name: student.name ?? "",
    room: student.room ?? "",
    birthDate: student.birthDate ?? "",
    approved: student.approved === true,
  });

  return (
    <ModalShell tone="green">
      <h3 className="text-3xl font-black italic uppercase mb-2 text-[var(--accent-text)] tracking-tighter">Bearbeiten</h3>
      <p className="text-[var(--text-dim)] mb-6 text-[10px] uppercase tracking-widest break-all">Login bleibt: {student.username}</p>
      <form onSubmit={(e) => { e.preventDefault(); onSave(values); }} className="space-y-3 text-left">
        <input className={INPUT} placeholder="Name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <input className={`${INPUT} uppercase`} placeholder="Zimmer" value={values.room} onChange={(e) => setValues({ ...values, room: e.target.value })} required />
          <input className={`${INPUT} min-h-[3.5rem]`} type="date" value={values.birthDate} onChange={(e) => setValues({ ...values, birthDate: e.target.value })} required />
        </div>
        <button
          type="button"
          onClick={() => setValues({ ...values, approved: !values.approved })}
          className={`w-full py-3.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
            values.approved ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
          }`}
        >
          {values.approved ? "Bestätigt ✓ (Slots mit Bestätigung)" : "Nicht bestätigt"}
        </button>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className={`${BTN_GHOST} flex-1`}>Abbrechen</button>
          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{busy ? "..." : "Speichern"}</button>
        </div>
      </form>
    </ModalShell>
  );
}
