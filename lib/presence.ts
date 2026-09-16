// Wo ist der Student gerade? Vom Personal gepflegt, abends dazu die Zimmerkontrolle.

export const PRESENCE_STATUSES = ["heim", "schule", "sport", "zuhause", "ausgang", "krank", "entschuldigt"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  heim: "Im Heim",
  schule: "Schule",
  sport: "Sport",
  zuhause: "Zuhause",
  ausgang: "Ausgang",
  krank: "Krank",
  entschuldigt: "Entschuldigt",
};

export const PRESENCE_LABELS_IT: Record<PresenceStatus, string> = {
  heim: "In convitto",
  schule: "Scuola",
  sport: "Sport",
  zuhause: "A casa",
  ausgang: "Uscita",
  krank: "Malato",
  entschuldigt: "Giustificato",
};

export const DEFAULT_PRESENCE: PresenceStatus = "heim";

/** Statusfarbe: im Heim = Akzent, unterwegs = neutral, krank/entschuldigt = rot */
export const presenceTone = (status: PresenceStatus): "lime" | "zinc" | "red" =>
  status === "heim" ? "lime" : status === "krank" || status === "entschuldigt" ? "red" : "zinc";

export type RoomCheck = "present" | "missing";

export const isPresenceStatus = (value: unknown): value is PresenceStatus =>
  PRESENCE_STATUSES.includes(value as PresenceStatus);
