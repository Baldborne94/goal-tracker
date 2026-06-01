"use client";

import { useEffect, useRef } from "react";

type GoalReminder = {
  id: string;
  title: string;
  reminderTime: string; // "HH:MM"
};

export default function NotificationScheduler({ goals }: { goals: GoalReminder[] }) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const activeGoals = goals.filter((g) => g.reminderTime);
    if (activeGoals.length === 0) return;

    if (!("Notification" in window)) return;

    function schedule() {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      const now = new Date();

      for (const goal of activeGoals) {
        const [hh, mm] = goal.reminderTime.split(":").map(Number);
        const next = new Date(now);
        next.setHours(hh, mm, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);

        const ms = next.getTime() - now.getTime();

        const t = setTimeout(() => {
          if (Notification.permission === "granted") {
            new Notification(`⚔️ Quest reminder: ${goal.title}`, {
              body: "Time to work on your quest!",
              icon: "/icon-192.svg",
              tag: `goal-${goal.id}`,
            });
          }
          // reschedule for next day
          schedule();
        }, ms);

        timersRef.current.push(t);
      }
    }

    if (Notification.permission === "granted") {
      schedule();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") schedule();
      });
    }

    return () => timersRef.current.forEach(clearTimeout);
  }, [goals]);

  return null;
}
