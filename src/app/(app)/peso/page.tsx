import { auth } from "@/lib/auth";
import PesoClient from "@/components/peso/PesoClient";

export default async function PesoPage() {
  await auth();
  return <PesoClient />;
}
