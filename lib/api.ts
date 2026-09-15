"use client";

import { auth } from "@/lib/firebase";

/** Ruft eine eigene API-Route mit dem Firebase-Token des eingeloggten Users auf */
export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Nicht eingeloggt");

  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  // Passwort wurde geändert oder Konto gelöscht -> abmelden
  if (res.status === 401) await auth.signOut();
  if (!res.ok) throw new Error(data.error || "Fehler");
  return data as T;
}
