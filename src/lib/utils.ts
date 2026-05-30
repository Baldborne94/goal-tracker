import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getProgressColor(progress: number) {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 60) return "bg-blue-500";
  if (progress >= 30) return "bg-yellow-500";
  return "bg-red-400";
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "text-red-500 bg-red-50";
    case "medium":
      return "text-yellow-600 bg-yellow-50";
    case "low":
      return "text-green-600 bg-green-50";
    default:
      return "text-gray-500 bg-gray-50";
  }
}

export function getPriorityLabel(priority: string) {
  switch (priority) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return priority;
  }
}

export function calculateStreak(completedDates: (Date | null)[]): number {
  const dates = new Set(
    completedDates
      .filter((d): d is Date => d !== null)
      .map((d) => d.toISOString().slice(0, 10))
  );

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const checkDate = new Date(today);

  if (!dates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
