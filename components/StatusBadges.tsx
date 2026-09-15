import { ADULT_AGE, ageOn, suspendedOn } from "@/lib/schedule";
import type { UserProfile } from "@/lib/types";

const TONES = {
  green: "border-[#deff9a]/30 bg-[#deff9a]/5 text-[#deff9a]",
  zinc: "border-zinc-700 text-zinc-500",
  red: "border-red-500/30 bg-red-500/10 text-red-500",
};

/** Status eines Studenten: Alter (16+ / U16), Bestätigung, Sperre */
export default function StatusBadges({ profile, date }: { profile: UserProfile; date: string }) {
  const age = ageOn(profile, date);
  const badges: { text: string; tone: keyof typeof TONES }[] = [
    age === null
      ? { text: "Alter ?", tone: "zinc" }
      : age >= ADULT_AGE
        ? { text: `${ADULT_AGE}+`, tone: "green" }
        : { text: `U${ADULT_AGE}`, tone: "zinc" },
  ];
  if (profile.approved) badges.push({ text: "Bestätigt", tone: "green" });
  if (suspendedOn(profile, date)) badges.push({ text: "Gesperrt", tone: "red" });

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
