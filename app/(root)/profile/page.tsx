import { getCurrentUser, isAuthenticated } from "@/lib/actions/auth.action";
import { getFeedbacksByUserId } from "@/lib/actions/general.action";
import { redirect } from "next/navigation";
import StatsDashboard from "@/components/StatsDashboard";

export default async function ProfilePage() {
  const isAuth = await isAuthenticated();
  if (!isAuth) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Get ALL feedback for the current user's taken interviews
  const rawFeedbacks = await getFeedbacksByUserId(user.id) || [];

  const feedbacks = rawFeedbacks.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <main className="flex flex-col gap-10">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-light-100">Your Performance Dashboard</h1>
        <p className="text-light-400">
          Track your interview progress and see your strongest skills.
        </p>
      </section>

      <StatsDashboard feedbacks={feedbacks} />
    </main>
  );
}
