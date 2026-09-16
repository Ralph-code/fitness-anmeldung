"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { AdminLogEntry } from "@/lib/types";
import { CARD, EmptyState, HINT, INPUT, Loading } from "@/components/ui";

const ACTION_LABELS: Record<string, string> = {
  "post.create": "Beitrag erstellt",
  "post.update": "Beitrag geändert",
  "post.delete": "Beitrag gelöscht",
  "meal.update": "Essensplan geändert",
  "meal.delete": "Essensplan gelöscht",
  "attendance.update": "Essens-Anwesenheit geändert",
  "schedule.update": "Fitness-Slots geändert",
  "opening.update": "Öffnungszeiten geändert",
  "calendar.update": "Kalendereintrag geändert",
  "calendar.delete": "Kalendereintrag gelöscht",
  "student.create": "Studenten angelegt",
  "student.update": "Student bearbeitet",
  "student.delete": "Student gelöscht",
  "student.bulkDelete": "Studenten gelöscht",
  "student.suspend": "Student gesperrt",
  "student.unsuspend": "Sperre aufgehoben",
  "student.approval": "Bestätigung geändert",
  "student.password": "Passwort erneuert",
  "passwords.rotate": "Alle Passwörter erneuert",
  "note.create": "Vermerk erstellt",
  "admin.create": "Admin angelegt",
  "admin.delete": "Admin gelöscht",
  "admin.password": "Admin-Passwort erneuert",
};

function describeDetails(details: Record<string, unknown> = {}) {
  const parts: string[] = [];
  const push = (value: unknown, prefix = "") => {
    if (value === undefined || value === null || value === "") return;
    parts.push(`${prefix}${value}`);
  };
  push(details.name);
  push(details.title);
  push(details.username);
  push(details.date);
  if (typeof details.count === "number") push(`${details.count} Stück`);
  if (typeof details.deleted === "number") push(`${details.deleted} gelöscht`);
  if (typeof details.updated === "number") push(`${details.updated} erneuert`);
  if (typeof details.approved === "boolean") push(details.approved ? "bestätigt" : "Bestätigung entfernt");
  push(details.until, "bis ");
  push(details.reason, "Grund: ");
  if (typeof details.cancelledBookings === "number" && details.cancelledBookings > 0) push(`${details.cancelledBookings} Buchungen storniert`);
  if (typeof details.slots === "number") push(`${details.slots} Slots`);
  if (details.lunch) push(`Mittag: ${details.lunch === "out" ? "abgemeldet" : "dabei"}`);
  if (details.dinner) push(`Abend: ${details.dinner === "out" ? "abgemeldet" : "dabei"}`);
  if (details.lunchChecked) push(`Mittag kontrolliert: ${details.lunchChecked === "present" ? "da" : "gefehlt"}`);
  if (details.dinnerChecked) push(`Abend kontrolliert: ${details.dinnerChecked === "present" ? "da" : "gefehlt"}`);
  if (details.closed === true) push("geschlossen");
  if (details.schoolFree === true) push("schulfrei");
  return parts.join(" · ");
}

export default function AdminLog() {
  const { user, loading } = useAuth();
  const [entries, setEntries] = useState<AdminLogEntry[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) return;
    return onSnapshot(
      query(collection(db, "adminLog"), orderBy("at", "desc"), limit(200)),
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminLogEntry)),
      (err) => { console.warn("Protokoll:", err.message); setEntries([]); }
    );
  }, [user?.isAdmin]);

  if (loading || !user?.isAdmin) return <Loading text="Admin Check..." />;

  const term = search.trim().toLowerCase();
  const visible = (entries ?? []).filter((e) => {
    if (!term) return true;
    const label = ACTION_LABELS[e.action] ?? e.action;
    return [e.actorName, label, describeDetails(e.details)].some((v) => v?.toLowerCase().includes(term));
  });

  // Nach Tagen gruppieren, damit im Render nichts umgeschrieben wird
  const groups = visible.reduce<{ day: string; items: AdminLogEntry[] }[]>((acc, entry) => {
    const day = entry.at.slice(0, 10);
    const last = acc[acc.length - 1];
    if (last?.day === day) last.items.push(entry);
    else acc.push({ day, items: [entry] });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-24 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Protokoll</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-6">Änderungen der Admins</p>

        <input className={`${INPUT} mb-6`} placeholder="Suche: Person, Aktion, Name" value={search} onChange={(e) => setSearch(e.target.value)} />

        {entries === null ? (
          <EmptyState>Lädt...</EmptyState>
        ) : visible.length === 0 ? (
          <div className={CARD}><EmptyState>Noch keine Einträge.</EmptyState></div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.day}>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-faint)] mt-6 mb-2 px-1">
                  {new Date(`${group.day}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "long", timeZone: "UTC" })}
                </p>
                <div className="space-y-2">
                  {group.items.map((e) => {
                    const details = describeDetails(e.details);
                    return (
                      <div key={e.id} className={`${CARD} flex items-start gap-3`}>
                        <span className="text-[11px] font-black text-[var(--accent-text)] tabular-nums pt-0.5 shrink-0">
                          {new Date(e.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[var(--text)]">{ACTION_LABELS[e.action] ?? e.action}</p>
                          {details && <p className="text-sm text-[var(--text-muted)] leading-relaxed break-words">{details}</p>}
                          <p className={`${HINT} mt-1`}>von {e.actorName}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className={`${HINT} text-center mt-6`}>Die letzten 200 Änderungen. Nur Admin-Aktionen werden protokolliert.</p>
      </div>
    </div>
  );
}
