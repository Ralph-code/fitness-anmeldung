"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { isAdminProfile, isSuperAdminProfile, type UserProfile } from "@/lib/types";

export interface AppUser extends UserProfile {
  uid: string;
  email: string | null;
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeDoc?.();
      unsubscribeDoc = undefined;

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Bis das Profil da ist, nicht als "ausgeloggt" gelten (sonst Redirect zum Login)
      setLoading(true);
      // Echtzeit-Listener für Profildaten (Sperren wirken sofort)
      unsubscribeDoc = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (docSnap) => {
          if (!docSnap.exists()) {
            // Konto wurde gelöscht
            auth.signOut();
            return;
          }
          const data = docSnap.data() as UserProfile;
          const username = data.username || firebaseUser.email?.split("@")[0] || "";
          setUser({
            ...data,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username,
            name: data.name || username,
            isAdmin: isAdminProfile(data),
            isSuperAdmin: isSuperAdminProfile(data),
          });
          setLoading(false);
        },
        (error) => {
          console.warn("AuthDoc-Sperre:", error.message);
          setUser(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeDoc?.();
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
