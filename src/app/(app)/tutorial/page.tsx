import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TutorialClient from "@/components/TutorialClient";

export default async function TutorialPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  let isFirstTime = true;
  let heroClass: string | null = null;
  try {
    const row = await prisma.$queryRawUnsafe<{ onboardingComplete: boolean | null; heroClass: string | null }[]>(
      `SELECT "onboardingComplete", "heroClass" FROM "User" WHERE id = $1`, userId
    );
    isFirstTime = !(row[0]?.onboardingComplete ?? false);
    heroClass = row[0]?.heroClass ?? null;
  } catch {
    isFirstTime = false;
  }

  return <TutorialClient name={user?.name} isFirstTime={isFirstTime} heroClass={heroClass} />;
}
