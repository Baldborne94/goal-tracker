import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionProvider } from "next-auth/react";
import BottomNav from "@/components/layout/BottomNav";
import ThemeProvider from "@/components/ThemeProvider";
import PushSubscriber from "@/components/PushSubscriber";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  let dbUser: { points: number; theme: string; heroClass: string | null } | null = null;

  try {
    const u = await prisma.$queryRawUnsafe<{ points: number; theme: string; heroClass: string | null }[]>(
      `SELECT points, theme, "heroClass" FROM "User" WHERE id = $1`, session.user!.id!
    );
    if (u[0]) dbUser = u[0];
  } catch {
    try {
      const basic = await prisma.user.findUnique({
        where: { id: session.user!.id! },
        select: { points: true },
      });
      if (basic) dbUser = { points: basic.points, theme: "warrior", heroClass: null };
    } catch {
      // ignore
    }
  }

  return (
    <SessionProvider>
      <ThemeProvider initialTheme={(dbUser?.theme as import("@/components/ThemeProvider").ThemeKey) ?? "warrior"}>
        <div className="flex flex-col min-h-screen" style={{ background: "var(--theme-bg)" }}>
          <main className="flex-1 overflow-y-auto pb-20">{children}</main>
          <BottomNav points={dbUser?.points ?? 0} heroClass={dbUser?.heroClass} />
          <PushSubscriber />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}
