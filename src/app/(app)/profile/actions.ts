"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Imposta (o sostituisce) la password dell'account.
 *
 * Serve a chi si è registrato con Google e deve poter entrare dall'APK, dove
 * il Sign-In nativo dipende dal Credential Manager del dispositivo e può
 * rifiutare l'accesso anche con la configurazione OAuth corretta.
 *
 * Non richiede la password attuale: la sessione in corso è già la prova
 * d'identità, ed è l'unico modo perché un account nato da Google — che una
 * password non ce l'ha — possa averne una.
 */
export async function setPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessione scaduta. Rientra e riprova." };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Almeno ${MIN_PASSWORD_LENGTH} caratteri.` };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: await bcrypt.hash(password, 12) },
  });

  return { ok: true };
}

/** Se l'account ha già una password, per distinguere "imposta" da "cambia". */
export async function hasPassword(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  return Boolean(user?.password);
}

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

export async function updateHeroClass(heroClass: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  // Ensure column exists (seed may have been skipped on pgBouncer during build)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "heroClass" TEXT`
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "heroClass" = $1 WHERE id = $2`,
    heroClass, session.user.id
  );
}

export async function markOnboardingComplete(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "onboardingComplete" = true WHERE id = $1`,
    session.user.id
  );
}
