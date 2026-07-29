import DietClient from "@/components/diet/DietClient";
import { serverDayKey } from "@/lib/utils";

export default function DietPage() {
  const today = serverDayKey();
  return <DietClient initialDate={today} />;
}
