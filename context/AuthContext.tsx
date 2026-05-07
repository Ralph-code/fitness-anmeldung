"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// 1. Definiere genau, wie unser User-Objekt in der App aussieht
interface AuthUser {
  uid: string;
  email: string | null;
  username: string | null;
  isAdmin: boolean;
}

// 2. Definiere die Struktur des Contexts
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Überwache den Login-Status von Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Suche die Rolle und den Usernamen im Firestore
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // Setze unseren erweiterten User mit Daten aus Firestore
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              username: userData.username || null,
              isAdmin: userData.role === "admin", // Hier wird isAdmin definiert
            });
          } else {
            // Falls kein Firestore-Dokument existiert (Sicherheits-Fallback)
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              username: null,
              isAdmin: false,
            });
          }
        } catch (error) {
          console.error("Fehler beim Abrufen der User-Rolle:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook, um den Auth-Status einfach in jeder Komponente zu nutzen
export const useAuth = () => useContext(AuthContext);