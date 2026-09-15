export interface UserProfile {
  username: string;
  name?: string;
  room?: string;
  birthDate?: string | null;
  birthYear?: number | null;
  isAdmin?: boolean;
  role?: string;
  suspendedUntil?: string | null;
  suspendReason?: string | null;
  /** Vom Admin bestätigt: darf Slots "Mit Bestätigung" sehen und buchen */
  approved?: boolean;
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
}

export const isAdminProfile = (p: Partial<UserProfile> | undefined) =>
  p?.isAdmin === true || p?.role === "admin";
