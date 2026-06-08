import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import NutrizionistaPianoClient from "@/components/nutrizionista/NutrizionistaPianoClient";

export default async function NutrizionistaPianoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <NutrizionistaPianoClient />;
}
