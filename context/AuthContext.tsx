"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

interface UserType {
  uid: string;
  email: string | null;
  username?: string;
  isAdmin?: boolean;
  birthYear?: number;
}

interface AuthContextType {
  user: UserType | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Echtzeit-Listener für Profildaten
        const userRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              username: data.username || firebaseUser.email?.split("@")[0],
              isAdmin: data.isAdmin === true || data.role === "admin",
              birthYear: data.birthYear || 0, // 0 als Fallback, falls nichts eingetragen ist
            });
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, birthYear: 0 });
          }
          setLoading(false);
        }, (error) => {
          console.warn("AuthDoc-Sperre:", error.message);
          setLoading(false);
        });

        return () => unsubscribeDoc();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);