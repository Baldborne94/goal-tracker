import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import OnboardingClient from "@/components/OnboardingClient";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let user: { onboardingComplete: boolean; name: string | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingComplete: true, name: true },
    });
  } catch {
    // onboardingComplete column not yet in DB — fetch just name
    try {
      const basic = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      });
      if (basic) user = { onboardingComplete: false, name: basic.name };
    } catch {
      // ignore
    }
  }

  if (user?.onboardingComplete) redirect("/dashboard");

  return <OnboardingClient initialName={user?.name ?? ""} />;
}
