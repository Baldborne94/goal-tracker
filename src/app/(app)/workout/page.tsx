import WorkoutClient from "@/components/workout/WorkoutClient";

export default function WorkoutPage() {
  const today = new Date().toISOString().slice(0, 10);
  return <WorkoutClient initialDate={today} />;
}
