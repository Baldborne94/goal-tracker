import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SvuotaFrigoClient from "@/components/svuota-frigo/SvuotaFrigoClient";

export default async function SvuotaFrigoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <SvuotaFrigoClient />;
}
