"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { ArrowLeft, Pin, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/schedule";
import { POST_CATEGORIES, POST_LABELS, type PostCategoryValue } from "@/lib/content";
import type { Post } from "@/lib/types";
import ConfirmModal, { ModalShell } from "@/components/ConfirmModal";
import { Badge, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, CARD, EmptyState, HINT, INPUT, LABEL, Loading } from "@/components/ui";

type Draft = { title: string; body: string; category: PostCategoryValue; pinned: boolean };
const EMPTY: Draft = { title: "", body: "", category: "news", pinned: false };

export default function AdminNews() {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Post | null>(null);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    return onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)),
      (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post)),
      (err) => { console.warn("Beiträge:", err.message); setPosts([]); }
    );
  }, [user?.isAdmin]);

  if (loading || !user?.isAdmin) return <Loading text="Admin Check..." />;

  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      if (editId) await apiFetch(`/api/admin/posts/${editId}`, { method: "PATCH", body: draft });
      else await apiFetch("/api/admin/posts", { method: "POST", body: draft });
      setDraft(null);
      setEditId(null);
      showFeedback("Gespeichert");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/posts/${confirmDelete.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      showFeedback("Gelöscht", "error");
    } catch (e) {
      showFeedback((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const sorted = (posts ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-6 pb-24 font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]">
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link href="/admin" className="mb-8 text-[var(--text-faint)] hover:text-[var(--text)] text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
          <ArrowLeft size={14} /> Verwaltung
        </Link>

        <h1 className="text-4xl font-black italic text-[var(--accent-text)] uppercase tracking-tighter mb-2">Neuigkeiten</h1>
        <p className="text-[var(--text-dim)] text-[10px] font-black uppercase tracking-[0.4em] mb-8">Für die Startseite</p>

        <button onClick={() => { setDraft(EMPTY); setEditId(null); }} className={`${BTN_PRIMARY} w-full flex items-center justify-center gap-2 mb-8`}>
          <Plus size={16} /> Neuer Beitrag
        </button>

        {posts === null ? (
          <EmptyState>Lädt...</EmptyState>
        ) : sorted.length === 0 ? (
          <div className={CARD}><EmptyState>Noch keine Beiträge.</EmptyState></div>
        ) : (
          <div className="space-y-3">
            {sorted.map((post) => (
              <div key={post.id} className={`${CARD} ${post.category === "wichtig" ? "border-red-500/30" : ""}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.pinned && <Pin size={12} className="text-[var(--accent-text)]" />}
                    <Badge tone={post.category === "wichtig" ? "red" : post.category === "info" ? "zinc" : "lime"}>
                      {POST_LABELS[post.category] ?? post.category}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-[var(--text-faint)] shrink-0">
                    {formatDate(post.createdAt.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </div>
                <p className="font-bold text-[var(--text)] mb-1">{post.title}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line line-clamp-3">{post.body}</p>
                <p className={`${HINT} mt-2`}>von {post.authorName}</p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setDraft({ title: post.title, body: post.body, category: post.category, pinned: post.pinned }); setEditId(post.id); }}
                    className={`${BTN_OUTLINE} flex-1`}
                  >
                    Bearbeiten
                  </button>
                  <button onClick={() => setConfirmDelete(post)} className="py-4 px-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] text-red-500 border border-red-500/20 active:scale-95 transition-all">
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {draft && (
        <ModalShell tone="green">
          <h3 className="text-3xl font-black italic uppercase mb-6 text-[var(--accent-text)] tracking-tighter">{editId ? "Bearbeiten" : "Neuer Beitrag"}</h3>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4 text-left">
            <div>
              <span className={LABEL}>Titel</span>
              <input className={INPUT} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Kurzer Titel" required maxLength={120} />
            </div>
            <div>
              <span className={LABEL}>Text</span>
              <textarea className={`${INPUT} resize-y`} rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Was sollen die Studenten wissen?" required maxLength={4000} />
            </div>
            <div>
              <span className={LABEL}>Kategorie</span>
              <div className="flex gap-2">
                {POST_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={`flex-1 py-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      draft.category === c ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    {POST_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
              className={`w-full py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                draft.pinned ? "border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--text-dim)]"
              }`}
            >
              <Pin size={13} /> {draft.pinned ? "Oben angeheftet" : "Oben anheften"}
            </button>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setDraft(null); setEditId(null); }} className={`${BTN_GHOST} flex-1`}>Abbrechen</button>
              <button type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{busy ? "..." : "Speichern"}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Beitrag löschen?"
          text={confirmDelete.title}
          confirmLabel="Löschen"
          busy={busy}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={remove}
        />
      )}

      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[700] w-full max-w-xs px-4 animate-in slide-in-from-bottom-5 fade-in">
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
