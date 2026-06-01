import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionProvider } from "next-auth/react";
import BottomNav from "@/components/layout/BottomNav";
import ThemeProvider from "@/components/ThemeProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  let dbUser: { points: number; theme: string; onboardingComplete: boolean } | null = null;
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

  return (
    <SessionProvider>
      <ThemeProvider initialTheme={(dbUser?.theme as import("@/components/ThemeProvider").ThemeKey) ?? "warrior"}>
        <div className="flex flex-col min-h-screen bg-[#0c0a1a]">
          <main className="flex-1 overflow-y-auto pb-20">{children}</main>
          <BottomNav points={dbUser?.points ?? 0} />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}
