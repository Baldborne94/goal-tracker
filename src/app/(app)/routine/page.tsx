import { auth } from "@/lib/auth";
import RoutineClient from "@/components/routine/RoutineClient";

export default async function RoutinePage() {
  await auth();
  return <RoutineClient />;
}
