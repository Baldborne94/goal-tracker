import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionProvider } from "next-auth/react";
import BottomNav from "@/components/layout/BottomNav";
import ThemeProvider from "@/components/ThemeProvider";
import NotificationScheduler from "@/components/NotificationScheduler";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  let dbUser: { points: number; theme: string; onboardingComplete: boolean } | null = null;
  let goalReminders: { id: string; title: string; reminderTime: string }[] = [];

  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user!.id! },
      select: { points: true, theme: true, onboardingComplete: true },
    });
  } catch {
    // New columns not yet in DB — skip onboarding redirect and use defaults
    try {
      const basic = await prisma.user.findUnique({
        where: { id: session.user!.id! },
        select: { points: true },
      });
      if (basic) dbUser = { points: basic.points, theme: "warrior", onboardingComplete: true };
    } catch {
      // ignore
    }
  }

  if (dbUser && !dbUser.onboardingComplete) redirect("/onboarding");

  try {
    const goalsWithReminders = await prisma.goal.findMany({
      where: { userId: session.user!.id!, status: "active", reminderTime: { not: null } },
      select: { id: true, title: true, reminderTime: true },
    });
    goalReminders = goalsWithReminders
      .filter((g): g is { id: string; title: string; reminderTime: string } => g.reminderTime !== null);
  } catch {
    // reminderTime column not yet in DB — skip
  }

  return (
    <SessionProvider>
      <ThemeProvider initialTheme={(dbUser?.theme as import("@/components/ThemeProvider").ThemeKey) ?? "warrior"}>
        <div className="flex flex-col min-h-screen" style={{ background: "var(--theme-bg)" }}>
          <main className="flex-1 overflow-y-auto pb-20">{children}</main>
          <BottomNav points={dbUser?.points ?? 0} />
          <NotificationScheduler goals={goalReminders} />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}
