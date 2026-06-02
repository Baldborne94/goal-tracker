"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function updateProfileName(name: string): Promise<{ ok: boolean; name?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false };

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: trimmed },
    select: { name: true },
  });

  return { ok: true, name: user.name ?? trimmed };
}

export async function updateTheme(theme: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  });
}

export async function updateReminder(enabled: boolean, time: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { reminderEnabled: enabled, reminderTime: time },
  });
}
