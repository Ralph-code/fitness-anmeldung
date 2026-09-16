"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarDays, ChevronRight, Dumbbell, House, Megaphone, Pin, TriangleAlert, Utensils } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useSchedule } from "@/lib/useSchedule";
import { addDays, formatDate, getBookingWindow, zonedNow } from "@/lib/schedule";
import { MEAL_KEYS, MEAL_TIMES, SIGNOFF_DEADLINE, attendanceOf, canChangeAttendance, nextMeal } from "@/lib/meals";
import { POST_LABELS } from "@/lib/content";
import { DEFAULT_OPENING, dayStatus, normalizeOpening, type CalendarEntry, type Opening } from "@/lib/opening";
import type { Booking, Meal, MealAttendance, Post } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Badge, CARD, CARD_TIGHT, EmptyState, HINT, SectionTitle } from "@/components/ui";

export default function StartPage() {
  const { user } = useAuth();
  const { t, locale, language } = useSettings();
  const uid = user?.uid;
  const { schedule } = useSchedule(!!uid);

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [bookings, setBookings] = useState<Record<string, Booking | null>>({});
  const [tomorrowMeals, setTomorrowMeals] = useState<MealAttendance | null>(null);
  const [opening, setOpening] = useState<Opening>(DEFAULT_OPENING);
  const [todayEntry, setTodayEntry] = useState<CalendarEntry | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const now = zonedNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);

  useEffect(() => {
    if (!uid) return;
    const unsubPosts = onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20)),
      (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post)),
      (err) => { console.warn("Neuigkeiten:", err.message); setPosts([]); }
    );
    const unsubMeal = onSnapshot(doc(db, "meals", today), (snap) => setMeal(snap.exists() ? (snap.data() as Meal) : null), () => setMeal(null));
    const unsubBookings = [today, tomorrow].map((date) =>
      onSnapshot(
        doc(db, "bookings", `${date}_${uid}`),
        (snap) => setBookings((prev) => ({ ...prev, [date]: snap.exists() ? ({ id: snap.id, ...snap.data() } as Booking) : null })),
        () => {}
      )
    );
    const unsubAttendance = onSnapshot(
      doc(db, "mealAttendance", `${tomorrow}_${uid}`),
      (snap) => setTomorrowMeals(snap.exists() ? (snap.data() as MealAttendance) : null),
      () => {}
    );
    const unsubOpening = onSnapshot(
      doc(db, "settings", "opening"),
      (snap) => setOpening(snap.exists() ? normalizeOpening(snap.data()) : DEFAULT_OPENING),
      () => {}
    );
    const unsubCalendar = onSnapshot(
      doc(db, "calendar", today),
      (snap) => setTodayEntry(snap.exists() ? (snap.data() as CalendarEntry) : null),
      () => {}
    );
    return () => { unsubPosts(); unsubMeal(); unsubAttendance(); unsubOpening(); unsubCalendar(); unsubBookings.forEach((u) => u()); };
  }, [uid, today, tomorrow]);

  const win = getBookingWindow(schedule);
  const upcomingBooking = bookings[today] ?? bookings[tomorrow] ?? null;
  const bookingDate = bookings[today] ? today : bookings[tomorrow] ? tomorrow : null;
  const comingMeal = nextMeal(now.minutes);
  const sorted = (posts ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  const greeting = now.minutes < 330 ? t("greeting.night") : now.minutes < 660 ? t("greeting.morning") : now.minutes < 1020 ? t("greeting.day") : t("greeting.evening");
  const status = dayStatus(today, opening, todayEntry);
  const homeText =
    status.state === "closed"
      ? t("start.homeClosed")
      : status.state === "closes"
        ? t("start.homeUntil", { time: status.closeTime ?? "" })
        : status.state === "opens"
          ? t("start.homeFrom", { time: status.openTime ?? "" })
          : t("start.homeOpen");

  return (
    <AppShell
      title={`${greeting}, ${user?.name?.split(" ")[0] ?? ""}`}
      subtitle={formatDate(today, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }, locale)}
    >
      {/* Heute */}
      <div className={`${CARD} mb-6`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Utensils size={18} className="text-[var(--accent-text)] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text)]">
                  {comingMeal ? t(comingMeal === "lunch" ? "meals.lunch" : "meals.dinner") : t("start.kitchenClosed")}
                </p>
                <p className={HINT}>
                  {comingMeal
                    ? `${MEAL_TIMES[comingMeal].start} – ${MEAL_TIMES[comingMeal].end}`
                    : t("start.kitchenTomorrow", { time: MEAL_TIMES.lunch.start })}
                </p>
              </div>
            </div>
            <Link href="/essen" className="text-[var(--text-faint)] active:text-[var(--text)]"><ChevronRight size={20} /></Link>
          </div>

          <div className="h-px bg-[var(--surface-2)]" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Dumbbell size={18} className="text-[var(--accent-text)] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text)]">
                  {upcomingBooking ? t("start.booking", { slot: upcomingBooking.slot }) : t("start.noBooking")}
                </p>
                <p className={HINT}>
                  {upcomingBooking && bookingDate
                    ? bookingDate === today ? t("start.today") : t("start.tomorrow")
                    : win.phase === "pause" ? t("start.bookingFrom", { time: schedule.opensAt }) : t("start.bookNow")}
                </p>
              </div>
            </div>
            <Link href="/fitness" className="text-[var(--text-faint)] active:text-[var(--text)]"><ChevronRight size={20} /></Link>
          </div>
        </div>
      </div>

      {/* Heim heute */}
      <Link href="/kalender" className={`${CARD} mb-6 flex items-center justify-between gap-4 active:scale-[0.99] transition-all`}>
        <div className="flex items-center gap-3 min-w-0">
          <House size={18} className="text-[var(--accent-text)] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text)]">{homeText}</p>
            <p className={HINT}>
              {status.schoolFree ? `${t("start.schoolFreeToday")} · ` : ""}
              {todayEntry?.label || t("start.seeCalendar")}
            </p>
          </div>
        </div>
        <ChevronRight size={20} className="text-[var(--text-faint)] shrink-0" />
      </Link>

      {/* Erinnerung: Abmeldung für morgen */}
      {!user?.isAdmin && canChangeAttendance(tomorrow) && (
        <Link href="/essen" className={`${CARD} mb-6 flex items-center justify-between gap-4 border-[var(--accent-30)] bg-[var(--accent-05)] active:scale-[0.99] transition-all`}>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text)] mb-1">{t("start.mealsTomorrow")}</p>
            <p className={HINT}>{t("start.signOffUntil", { time: SIGNOFF_DEADLINE })}</p>
            <div className="flex gap-2 mt-2">
              {MEAL_KEYS.map((key) => (
                <Badge key={key} tone={attendanceOf(tomorrowMeals, key) === "out" ? "red" : "lime"}>
                  {t(key === "lunch" ? "meals.lunch" : "meals.dinner")}: {attendanceOf(tomorrowMeals, key) === "out" ? t("start.out") : t("start.in")}
                </Badge>
              ))}
            </div>
          </div>
          <ChevronRight size={20} className="text-[var(--text-faint)] shrink-0" />
        </Link>
      )}

      {/* Essensplan heute */}
      <SectionTitle title={t("start.mealsToday")} icon={<CalendarDays size={14} />} />
      <div className={`${CARD} mb-6`}>
        {meal?.lunch || meal?.dinner ? (
          <div className="space-y-4">
            {MEAL_KEYS.map((key) => {
              const text = key === "lunch" ? meal?.lunch : meal?.dinner;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)]">{t(key === "lunch" ? "meals.lunch" : "meals.dinner")}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">{MEAL_TIMES[key].start}–{MEAL_TIMES[key].end}</span>
                  </div>
                  <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-line">{text || "—"}</p>
                </div>
              );
            })}
            {meal?.note && <p className={`${HINT} pt-1 italic`}>{meal.note}</p>}
          </div>
        ) : (
          <EmptyState>{t("start.noMealPlan")}</EmptyState>
        )}
      </div>

      {/* Neuigkeiten */}
      <SectionTitle title={t("start.news")} icon={<Megaphone size={14} />} />
      {posts === null ? (
        <EmptyState>{t("app.loading")}</EmptyState>
      ) : sorted.length === 0 ? (
        <div className={CARD}><EmptyState>{t("start.noNews")}</EmptyState></div>
      ) : (
        <div className="space-y-3">
          {sorted.map((post) => {
            const isOpen = expanded === post.id;
            const long = post.body.length > 160;
            return (
              <button
                key={post.id}
                onClick={() => setExpanded(isOpen ? null : post.id)}
                className={`${CARD_TIGHT} w-full text-left transition-all ${post.category === "wichtig" ? "border-[var(--danger-border)] bg-[var(--danger-soft)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.pinned && <Pin size={12} className="text-[var(--accent-text)]" />}
                    {post.category === "wichtig" && <TriangleAlert size={12} className="text-red-500" />}
                    <Badge tone={post.category === "wichtig" ? "red" : post.category === "info" ? "zinc" : "lime"}>
                      {language === "it"
                        ? post.category === "wichtig" ? "Importante" : post.category === "info" ? "Info" : "Novità"
                        : POST_LABELS[post.category] ?? post.category}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-[var(--text-faint)] shrink-0 pt-1">
                    {formatDate(post.createdAt.slice(0, 10), { day: "2-digit", month: "2-digit" }, locale)}
                  </span>
                </div>
                <p className="font-bold text-[var(--text)] text-sm mb-1">{post.title}</p>
                <p className={`text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line ${isOpen || !long ? "" : "line-clamp-2"}`}>
                  {post.body}
                </p>
                {long && <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)] mt-2 inline-block">{isOpen ? t("start.less") : t("start.more")}</span>}
              </button>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
