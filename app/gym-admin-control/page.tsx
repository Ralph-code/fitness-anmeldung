"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, doc, setDoc, onSnapshot, query, deleteDoc 
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// --- Zweite Firebase Instanz gegen Admin-Logout ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const tempApp = getApps().length > 1 ? getApps()[1] : initializeApp(firebaseConfig, "TempApp");
const tempAuth = getAuth(tempApp);

export default function AdminControl() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.push("/dashboard");
      return;
    }

    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersList: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role !== "admin" && doc.id !== user?.uid) {
          usersList.push({ id: doc.id, ...data });
        }
      });

      // Sortierung nach Username (ignoriert Groß/Kleinschreibung beim Sortieren)
      usersList.sort((a, b) => (a.username || "").toLowerCase().localeCompare((b.username || "").toLowerCase()));
      
      setAllUsers(usersList);
    });

    return () => unsubscribe();
  }, [user, loading, router]);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(result);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Nur für den Login-Prozess wird der Name klein gemacht, der Username im Profil bleibt wie eingegeben
    const internalEmail = `${newUsername.trim().toLowerCase()}@fitness.local`;

    try {
      const res = await createUserWithEmailAndPassword(tempAuth, internalEmail, newPassword);
      
      await setDoc(doc(db, "users", res.user.uid), {
        username: newUsername.trim(), // Speichert Original (z.B. "MaxMustermann")
        passwordDisplay: newPassword, // Speichert Original Passwort
        role: "user",
        createdAt: new Date().toISOString()
      });

      await tempAuth.signOut();
      setStatus("✓ User erstellt");
      setNewUsername("");
      setNewPassword("");
      setTimeout(() => setStatus(""), 2000);
    } catch (err: any) {
      setStatus("Fehler: " + err.message);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, "users", userToDelete.id));
      setUserToDelete(null);
    } catch (err) {
      setStatus("Löschfehler");
    }
  };

  if (loading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <header className="flex justify-between items-center mb-8 pt-4">
          <button onClick={() => router.push("/dashboard")} className="text-zinc-500 hover:text-[#deff9a] transition uppercase text-[10px] font-black tracking-widest flex items-center gap-2">
            ← ZURÜCK
          </button>
          <h1 className="text-xl font-black italic text-[#deff9a] uppercase tracking-tighter">User Management</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Linke Spalte: Formular */}
          <div className="lg:col-span-5">
            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 sticky top-8">
              <h2 className="text-sm font-black uppercase mb-6 tracking-widest text-zinc-400 italic">Account anlegen</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Username (z.B. MaxMustermann)" 
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full p-4 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white font-medium" 
                  required
                />
                
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    placeholder="Passwort" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-4 pr-14 bg-black border border-zinc-800 rounded-2xl outline-none focus:border-[#deff9a] text-white"
                    required
                  />
                  <button type="button" onClick={generateRandomPassword} className="absolute right-3 p-2 text-[#deff9a] hover:bg-zinc-800 rounded-xl transition">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                  </button>
                </div>

                <button className="w-full bg-[#deff9a] text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all mt-2">
                  Erstellen
                </button>
                {status && <p className="text-center text-[10px] font-black text-[#deff9a] uppercase mt-2 tracking-widest">{status}</p>}
              </form>
            </div>
          </div>

          {/* Rechte Spalte: Liste */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-[2rem] overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Registrierte Mitglieder</h2>
                <span className="bg-[#deff9a] text-black text-[9px] font-black px-2 py-1 rounded-full">{allUsers.length}</span>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {allUsers.length === 0 ? (
                  <div className="text-center py-20 text-zinc-700 uppercase text-xs tracking-widest font-black italic opacity-20">Keine User in der Database</div>
                ) : (
                  allUsers.map((u) => (
                    <div key={u.id} className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl flex justify-between items-center group hover:border-zinc-600 transition">
                      <div className="overflow-hidden">
                        {/* WICHTIG: Hier wurde 'uppercase' entfernt, damit Name normal angezeigt wird */}
                        <p className="font-bold text-white text-lg tracking-tight truncate">{u.username}</p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-1 tracking-wider">PW: {u.passwordDisplay}</p>
                      </div>
                      <button 
                        onClick={() => setUserToDelete({id: u.id, name: u.username})}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex-shrink-0"
                      >
                        Löschen
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Lösch-Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-black mb-2 text-white italic uppercase tracking-tighter">User entfernen?</h3>
            <p className="text-zinc-500 mb-8 text-[10px] uppercase tracking-widest leading-relaxed">
              Soll <span className="text-white font-bold">{userToDelete.name}</span> wirklich gelöscht werden?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setUserToDelete(null)} className="flex-1 py-4 rounded-2xl bg-zinc-800 text-white font-bold uppercase text-[10px] tracking-widest">Abbrechen</button>
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold uppercase text-[10px] tracking-widest">Löschen</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #deff9a; }
      `}</style>
    </div>
  );
}