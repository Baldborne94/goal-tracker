"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function completeOnboarding(name: string, theme: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const trimmed = name.trim();
  if (!trimmed) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: trimmed,
      theme,
      onboardingComplete: true,
    },
  });

  redirect("/dashboard");
}
