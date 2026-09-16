"use client";

import { useState } from "react";
import { Dumbbell, House, User, Utensils } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { useSchedule } from "@/lib/useSchedule";
import { MEAL_TIMES, SIGNOFF_DEADLINE } from "@/lib/meals";
import type { TranslationKey } from "@/lib/i18n";
import { ModalShell } from "@/components/ConfirmModal";
import { BTN_GHOST, BTN_PRIMARY } from "@/components/ui";

const STEPS: { icon: typeof House; title: TranslationKey; text: TranslationKey }[] = [
  { icon: House, title: "tutorial.startTitle", text: "tutorial.startText" },
  { icon: Dumbbell, title: "tutorial.fitnessTitle", text: "tutorial.fitnessText" },
  { icon: Utensils, title: "tutorial.mealsTitle", text: "tutorial.mealsText" },
  { icon: User, title: "tutorial.profileTitle", text: "tutorial.profileText" },
];

/** Kurze Einführung beim ersten Öffnen – später im Profil erneut aufrufbar */
export default function Tutorial({ open: openProp, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const { user } = useAuth();
  const { t } = useSettings();
  const { schedule } = useSchedule(!!user);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const open = openProp ?? (!!user && !user.tutorialSeenAt && !dismissed);
  if (!open || !user) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    setDismissed(true);
    setStep(0);
    onClose?.();
    apiFetch("/api/profile", { method: "PATCH", body: { action: "tutorialSeen" } }).catch(() => {});
  };

  return (
    <ModalShell tone="green" z="z-[800]">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--accent-10)] border border-[var(--accent-20)] flex items-center justify-center text-[var(--accent-text)]">
        <Icon size={28} strokeWidth={2.4} />
      </div>
      <p className="text-[var(--accent-text)] text-[10px] font-black uppercase tracking-[0.4em] mb-2">
        {t("tutorial.step", { current: step + 1, total: STEPS.length })}
      </p>
      <h3 className="text-3xl font-black italic uppercase mb-4 tracking-tighter">{t(current.title)}</h3>
      <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-8">
        {t(current.text, {
          time: schedule.opensAt,
          lunch: `${MEAL_TIMES.lunch.start}–${MEAL_TIMES.lunch.end}`,
          dinner: `${MEAL_TIMES.dinner.start}–${MEAL_TIMES.dinner.end}`,
          deadline: SIGNOFF_DEADLINE,
        })}
      </p>

      <div className="flex justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.title} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-[var(--accent)]" : "w-1.5 bg-[var(--surface-2)]"}`} />
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={finish} className={`${BTN_GHOST} flex-1`}>
          {isLast ? t("tutorial.close") : t("tutorial.skip")}
        </button>
        <button onClick={() => (isLast ? finish() : setStep(step + 1))} className={`${BTN_PRIMARY} flex-[1.4]`}>
          {isLast ? t("tutorial.start") : t("tutorial.next")}
        </button>
      </div>
    </ModalShell>
  );
}
