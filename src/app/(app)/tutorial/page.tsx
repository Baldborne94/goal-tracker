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
  try {
    const row = await prisma.$queryRawUnsafe<{ onboardingComplete: boolean | null }[]>(
      `SELECT "onboardingComplete" FROM "User" WHERE id = $1`, userId
    );
    isFirstTime = !(row[0]?.onboardingComplete ?? false);
  } catch {
    isFirstTime = false;
  }

  return <TutorialClient name={user?.name} isFirstTime={isFirstTime} />;
}
