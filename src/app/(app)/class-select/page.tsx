import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import ClassSelectClient from "@/components/ClassSelectClient";

export default async function ClassSelectPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  // If already has a class, redirect appropriately
  let heroClass: string | null = null;
  let onboardingComplete = false;
  try {
    const row = await prisma.$queryRawUnsafe<{ heroClass: string | null; onboardingComplete: boolean | null }[]>(
      `SELECT "heroClass", "onboardingComplete" FROM "User" WHERE id = $1`, userId
    );
    heroClass = row[0]?.heroClass ?? null;
    onboardingComplete = row[0]?.onboardingComplete ?? false;
  } catch { /* column not yet in DB */ }

  if (heroClass) {
    redirect(onboardingComplete ? "/dashboard" : "/tutorial");
  }

  return <ClassSelectClient />;
}
