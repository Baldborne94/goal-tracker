import DietClient from "@/components/diet/DietClient";

export default function DietPage() {
  const today = new Date().toISOString().slice(0, 10);
  return <DietClient initialDate={today} />;
}
