import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import OnboardingClient from "@/components/OnboardingClient";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingComplete: true, name: true },
  });

  if (user?.onboardingComplete) redirect("/dashboard");

  return <OnboardingClient initialName={user?.name ?? ""} />;
}
