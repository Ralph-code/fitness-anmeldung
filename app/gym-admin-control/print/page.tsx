"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { zonedNow } from "@/lib/schedule";
import type { StudentRecord } from "@/lib/types";

function schoolYear() {
  const [year, month] = zonedNow().date.split("-").map(Number);
  const start = month >= 8 ? year : year - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

export default function PrintCredentials() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [error, setError] = useState("");
  const [host, setHost] = useState("");

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    const uids = new URLSearchParams(window.location.search).get("uids")?.split(",").filter(Boolean);
    apiFetch<{ students: StudentRecord[] }>("/api/admin/students")
      .then((data) => {
        setHost(window.location.host);
        setStudents(uids ? data.students.filter((s) => uids.includes(s.uid)) : data.students);
      })
      .catch((e) => setError(e.message));
  }, [user?.isAdmin]);

  if (loading || !user?.isAdmin || (!students && !error)) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#deff9a] font-black uppercase tracking-widest animate-pulse">
      Lade Zugänge...
    </div>
  );

  return (
    <div className="print-root min-h-screen bg-zinc-950 text-black font-sans">
      {/* Toolbar (wird nicht gedruckt) */}
      <div className="no-print sticky top-0 z-10 bg-black border-b border-zinc-900 p-4">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between gap-4">
          <button onClick={() => router.push("/gym-admin-control")} className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
            <span className="text-lg">←</span> Control
          </button>
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">{students?.length ?? 0} Zettel</span>
          <button onClick={() => window.print()} disabled={!students?.length} className="px-6 py-3 bg-[#deff9a] text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50">
            Drucken
          </button>
        </div>
        {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest mt-3">{error}</p>}
      </div>

      <div className="sheet max-w-[210mm] mx-auto bg-white my-6 p-[10mm] grid grid-cols-2">
        {students?.map((s) => (
          <div key={s.uid} className="slip border border-dashed border-zinc-400 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black italic uppercase tracking-tighter leading-none">Gym Log</p>
                <p className="text-[7px] font-bold uppercase tracking-[0.3em] text-zinc-500 mt-1">Fitness Heim · Schuljahr {schoolYear()}</p>
              </div>
              <span className="px-3 py-1 rounded-full border-2 border-black text-sm font-black">{s.room}</span>
            </div>

            <p className="text-lg font-black uppercase tracking-tight mt-3 leading-tight">{s.name ?? s.username}</p>

            <dl className="mt-2 space-y-1 text-[11px]">
              <div className="flex justify-between gap-2 border-b border-zinc-200 pb-1">
                <dt className="font-bold uppercase tracking-widest text-zinc-500 text-[8px] self-end">Name</dt>
                <dd className="font-mono font-bold text-base">{s.username}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-zinc-200 pb-1">
                <dt className="font-bold uppercase tracking-widest text-zinc-500 text-[8px] self-end">Passwort</dt>
                <dd className="font-mono font-bold text-base">{s.password ?? "—"}</dd>
              </div>
            </dl>

            <p className="text-[7px] text-zinc-500 uppercase font-bold tracking-widest mt-2 leading-relaxed">
              {host && <>Login: <span className="text-black">{host}</span> · </>}Persönlich – nicht weitergeben
            </p>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .slip { height: 55mm; break-inside: avoid; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body, .print-root { background: white !important; }
          .no-print { display: none !important; }
          .sheet { margin: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}
