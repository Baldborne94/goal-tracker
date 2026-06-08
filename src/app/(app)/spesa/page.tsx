import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SpesaClient from "@/components/spesa/SpesaClient";

export default async function SpesaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <SpesaClient />;
}
