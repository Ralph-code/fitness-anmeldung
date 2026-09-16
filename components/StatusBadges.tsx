"use client";

import { useSettings } from "@/context/SettingsContext";
import { ADULT_AGE, ageOn, suspendedOn } from "@/lib/schedule";
import type { UserProfile } from "@/lib/types";

const TONES = {
  green: "border-[var(--accent-30)] bg-[var(--accent-05)] text-[var(--accent-text)]",
  zinc: "border-[var(--border-strong)] text-[var(--text-muted)]",
  red: "border-red-500/30 bg-red-500/10 text-red-500",
};

/** Status eines Studenten: Alter (16+ / U16), Bestätigung, Sperre */
export default function StatusBadges({ profile, date }: { profile: UserProfile; date: string }) {
  const { t } = useSettings();
  const age = ageOn(profile, date);

  const badges: { text: string; tone: keyof typeof TONES }[] = [
    age === null
      ? { text: t("badge.ageUnknown"), tone: "zinc" }
      : age >= ADULT_AGE
        ? { text: t("badge.adult", { age: ADULT_AGE }), tone: "green" }
        : { text: t("badge.minor", { age: ADULT_AGE }), tone: "zinc" },
  ];
  if (profile.approved) badges.push({ text: t("badge.approved"), tone: "green" });
  if (suspendedOn(profile, date)) badges.push({ text: t("badge.blocked"), tone: "red" });

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span
          key={b.text}
          className={`px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest leading-none ${TONES[b.tone]}`}
        >
          {b.text}
        </span>
      ))}
    </div>
  );
}
