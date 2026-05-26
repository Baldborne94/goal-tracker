import { auth } from "@/lib/auth";
import KakeeboClient from "@/components/kakeebo/KakeeboClient";

export default async function KakeeboPage() {
  await auth();
  return <KakeeboClient />;
}
