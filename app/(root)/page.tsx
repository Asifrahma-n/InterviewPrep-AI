import InterviewCard from "@/components/InterviewCard";
import { InterviewCardSkeleton } from "@/components/InterviewCardSkeleton";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getFeedbacksForInterviewIds,
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";
import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import React, { Suspense } from "react";

const CACHE_REVALIDATE = 25;

const getCachedUserInterviews = (userId: string) =>
  unstable_cache(
    () => getInterviewsByUserId(userId),
    ["interviews", "user", userId],
    { revalidate: CACHE_REVALIDATE }
  )();

function getCachedFeedbacks(userId: string) {
  return unstable_cache(
    () => import("@/lib/actions/general.action").then(m => m.getFeedbacksByUserId(userId)),
    ["feedbacks", "user", userId],
    { revalidate: CACHE_REVALIDATE }
  )();
}

const getCachedLatestInterviews = (userId: string) =>
  unstable_cache(
    () => getLatestInterviews({ userId }),
    ["interviews", "latest", userId],
    { revalidate: CACHE_REVALIDATE }
  )();

async function YourInterviewsSection({ userId, feedbackMap }: { userId: string, feedbackMap: Record<string, any> }) {
  const userInterviews = await getCachedUserInterviews(userId);
  const hasPastInterviews = (userInterviews?.length ?? 0) > 0;

  return (
    <section className="flex flex-col gap-6 mt-8">
      <h2>Your Interviews</h2>
      <div className="interviews-section">
        {hasPastInterviews ? (
          userInterviews?.map((interview) => (
            <InterviewCard
              {...interview}
              key={interview.id}
              currentUserId={userId}
              feedback={feedbackMap[interview.id] ?? null}
            />
          ))
        ) : (
          <p className="text-muted-foreground">You haven&apos;t taken any interview yet</p>
        )}
      </div>
    </section>
  );
}

async function TakeAnInterviewSection({ userId, feedbackMap }: { userId: string, feedbackMap: Record<string, any> }) {
  const latestInterviews = await getCachedLatestInterviews(userId);
  const hasUpcomingInterviews = (latestInterviews?.length ?? 0) > 0;

  return (
    <section className="flex flex-col gap-6 mt-8">
      <h2>Take an Interview</h2>
      <div className="interviews-section">
        {hasUpcomingInterviews ? (
          latestInterviews?.map((interview) => (
            <InterviewCard {...interview} key={interview.id} currentUserId={userId} feedback={feedbackMap[interview.id] ?? null} />
          ))
        ) : (
          <p className="text-muted-foreground">There are no new interviews available</p>
        )}
      </div>
    </section>
  );
}

function SectionSkeleton() {
  return (
    <section className="flex flex-col gap-6 mt-8">
      <div className="h-8 w-40 animate-pulse rounded bg-dark-300" />
      <div className="interviews-section flex flex-wrap gap-4">
        <InterviewCardSkeleton />
        <InterviewCardSkeleton />
        <InterviewCardSkeleton />
      </div>
    </section>
  );
}

const Page = async () => {
  const user = await getCurrentUser();
  const userId = user?.id ?? "";

  let feedbackMap: Record<string, any> = {};
  if (userId) {
    const feedbacks = await getCachedFeedbacks(userId) || [];
    feedbackMap = feedbacks.reduce((acc: any, curr: any) => {
      acc[curr.interviewId] = curr;
      return acc;
    }, {});
  }

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg text-muted-foreground">
            Practice on real interview question & get instant feedback
          </p>
          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>
        <Image
          src="/robot.png"
          alt=""
          height={400}
          width={400}
          className="max-sm:hidden"
          priority
          sizes="400px"
        />
      </section>

      {userId && (
        <Suspense fallback={<SectionSkeleton />}>
          <YourInterviewsSection userId={userId} feedbackMap={feedbackMap} />
        </Suspense>
      )}
      {!userId && (
        <section className="flex flex-col gap-6 mt-8">
          <h2>Your Interviews</h2>
          <p className="text-muted-foreground">You haven&apos;t taken any interview yet</p>
        </section>
      )}

      <Suspense fallback={<SectionSkeleton />}>
        <TakeAnInterviewSection userId={userId} feedbackMap={feedbackMap} />
      </Suspense>
    </>
  );
};

export default Page;
