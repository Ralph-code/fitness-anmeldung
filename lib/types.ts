export interface UserProfile {
  username: string;
  name?: string;
  room?: string;
  createdAt?: string;
  /** Superadmin: alle Admin-Rechte + Admins anlegen/löschen (nur im Terminal änderbar) */
  isSuperAdmin?: boolean;
  birthDate?: string | null;
  birthYear?: number | null;
  isAdmin?: boolean;
  role?: string;
  suspendedUntil?: string | null;
  suspendReason?: string | null;
  /** Vom Admin bestätigt: darf Slots "Mit Bestätigung" sehen und buchen */
  approved?: boolean;
  // Heim-Daten
  school?: string;
  schoolClass?: string;
  smoker?: boolean;
  /** Unverträglichkeiten / Allergien */
  dietary?: string;
  /** Nachtschlüssel (erst ab 18) */
  nightKey?: boolean;
  /** Zeitpunkt, an dem das Tutorial abgeschlossen wurde */
  tutorialSeenAt?: string;
  /** Muss täglich eine Studierzeit besuchen (vom Admin pro Student gesetzt) */
  studyRequired?: boolean;
  /** Persönliche Einstellungen */
  theme?: "light" | "dark";
  language?: "de" | "it";
}

export interface Booking {
  id: string;
  uid: string;
  name: string;
  username: string;
  room: string;
  date: string;
  slotId: string;
  slot: string;
}

export interface StudentRecord extends UserProfile {
  uid: string;
  password: string | null;
  passwordIssuedAt: string | null;
  /** true, wenn der Student sein Passwort selbst geändert hat (gespeichertes gilt dann nicht mehr) */
  passwordChangedByUser?: boolean;
}

export type PostCategory = "news" | "info" | "wichtig";

export interface Post {
  id: string;
  title: string;
  body: string;
  category: PostCategory;
  pinned: boolean;
  createdAt: string;
  updatedAt?: string;
  authorName: string;
}

export interface Meal {
  date: string;
  lunch: string;
  dinner: string;
  note?: string;
  updatedAt?: string;
}

export interface MealAttendance {
  uid: string;
  date: string;
  name?: string;
  room?: string;
  /** "out" = abgemeldet; fehlt der Wert, ist der Student dabei */
  lunch?: "in" | "out";
  dinner?: "in" | "out";
  reason?: string | null;
  /** Kontrolle durch das Personal */
  lunchChecked?: "present" | "missing" | null;
  dinnerChecked?: "present" | "missing" | null;
  /** Vom Studenten bestätigte Fehlmeldung */
  lunchAckAt?: string | null;
  dinnerAckAt?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Presence {
  uid: string;
  date: string;
  name?: string;
  room?: string;
  status: string;
  note?: string | null;
  /** Abendkontrolle im Zimmer */
  roomCheck?: "present" | "missing" | null;
  roomCheckAt?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export interface StudyBooking {
  uid: string;
  date: string;
  name?: string;
  room?: string;
  slotId: string;
  slot: string;
  checked?: "present" | "missing" | null;
  createdAt?: string;
  updatedBy?: string;
}

export interface AdminLogEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  actorUid: string;
  actorName: string;
  at: string;
}

export type NoteType = "verweis" | "lob" | "notiz";

export interface Note {
  id: string;
  uid: string;
  type: NoteType;
  text: string;
  createdAt: string;
  authorName: string;
}

export const isSuperAdminProfile = (p: Partial<UserProfile> | undefined) =>
  p?.isSuperAdmin === true || p?.role === "superadmin";

export const isAdminProfile = (p: Partial<UserProfile> | undefined) =>
  p?.isAdmin === true || p?.role === "admin" || isSuperAdminProfile(p);

export interface AdminRecord {
  uid: string;
  username: string;
  name: string;
  isSuperAdmin: boolean;
  createdAt: string | null;
  lastSignIn: string | null;
}
