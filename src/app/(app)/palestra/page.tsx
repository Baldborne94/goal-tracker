import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PalestraClient from "@/components/palestra/PalestraClient";

export default async function PalestraPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <PalestraClient />;
}
