"use client";

import Link from "next/link";
import { ChevronRight, Dumbbell, Palette, Printer, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import Tour from "@/components/Tour";
import { CARD, HINT } from "@/components/ui";

const SECTIONS = [
  { href: "/admin/studenten", icon: Users, title: "Studenten", text: "Anlegen, bearbeiten, bestätigen, sperren, Passwörter" },
  { href: "/admin/slots", icon: Dumbbell, title: "Fitness-Slots", text: "Zeiten, Plätze, 16+ und Bestätigung" },
  { href: "/admin/design", icon: Palette, title: "Design", text: "Akzentfarbe der App für alle" },
  { href: "/admin/print", icon: Printer, title: "Zugangsdaten", text: "Zettel für die Rezeption drucken" },
  { href: "/admin/admins", icon: ShieldCheck, title: "Admins", text: "Admins anlegen und löschen", superOnly: true },
];

export default function AdminHub() {
  const { user } = useAuth();
  const sections = SECTIONS.filter((s) => !s.superOnly || user?.isSuperAdmin);

  return (
    <AppShell title="Verwaltung" subtitle={user?.isSuperAdmin ? "Superadmin-Konsole" : "Admin-Konsole"} adminOnly>
      <div className="space-y-3">
        {sections.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} data-tour={`admin-${href.split("/").pop()}`} className={`${CARD} flex items-center gap-4 active:scale-[0.99] transition-all`}>
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-[var(--accent-10)] border border-[var(--accent-20)] flex items-center justify-center text-[var(--accent-text)]">
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black uppercase tracking-tight text-[var(--text)]">{title}</p>
              <p className={HINT}>{text}</p>
            </div>
            <ChevronRight size={18} className="text-[var(--text-faint)] shrink-0" />
          </Link>
        ))}
      </div>
      <Tour id="admin" />
    </AppShell>
  );
}
