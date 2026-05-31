import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionProvider } from "next-auth/react";
import BottomNav from "@/components/layout/BottomNav";
import ThemeProvider from "@/components/ThemeProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user!.id! },
    select: { points: true },
  });

  return (
    <SessionProvider>
      <ThemeProvider>
        <div className="flex flex-col min-h-screen bg-[#0c0a1a]">
          <main className="flex-1 overflow-y-auto pb-20">{children}</main>
          <BottomNav points={dbUser?.points ?? 0} />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}
