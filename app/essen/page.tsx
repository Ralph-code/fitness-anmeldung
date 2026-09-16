"use client";

import { useAuth } from "@/context/AuthContext";
import AdminEssenView from "./AdminEssenView";
import StudentEssenView from "./StudentEssenView";

// Studenten sehen Plan und Abmeldung, Admins den Plan-Editor mit Anwesenheitskontrolle
export default function EssenPage() {
  const { user, loading } = useAuth();
  return !loading && user?.isAdmin ? <AdminEssenView /> : <StudentEssenView />;
}
