import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";

const FeedbackPage = async ({ params }: RouteParams) => {
  const { id: interviewId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [interview, feedback] = await Promise.all([
    getInterviewById(interviewId),
    getFeedbackByInterviewId({ interviewId, userId: user.id }),
  ]);

  if (!interview) redirect("/");
  if (!feedback) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-primary-200/40 bg-dark-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-primary-100">
          Feedback not ready
        </h2>
        <p className="text-muted-foreground">
          Complete the interview first, or feedback is still being generated.
        </p>
        <Button asChild className="btn-primary">
          <Link href={`/interview/${interviewId}`}>Go to Interview</Link>
        </Button>
      </div>
    );
  }

  const categoryScores = feedback.categoryScores ?? [];
  const durationSeconds = feedback.durationSeconds ?? 0;
  const durationLabel =
    durationSeconds > 0
      ? `${Math.floor(durationSeconds / 60)} min ${durationSeconds % 60} sec`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-primary-100">
          Interview Feedback
        </h1>
        <p className="text-muted-foreground capitalize">
          {interview.role} · {interview.type}
          {durationLabel != null && (
            <span className="ml-2">· {durationLabel}</span>
          )}
        </p>
      </div>

      <div className="card-border rounded-2xl bg-dark-200 p-6">
        <div className="mb-6 flex items-center justify-between border-b border-dark-300 pb-4">
          <span className="text-muted-foreground">Overall score</span>
          <span className="text-3xl font-bold text-primary-100">
            {feedback.totalScore}
            <span className="text-lg font-normal text-muted-foreground">/100</span>
          </span>
        </div>

        {feedback.BodyLanguageAndConfidence != null && (
          <div className="mb-6 flex items-center justify-between border-b border-dark-300 pb-4">
            <span className="text-muted-foreground">
              Body language & confidence
            </span>
            <span className="text-xl font-semibold text-primary-100">
              {feedback.BodyLanguageAndConfidence}/100
            </span>
          </div>
        )}

        {durationLabel != null && (
          <div className="mb-6 flex items-center justify-between border-b border-dark-300 pb-4">
            <span className="text-muted-foreground">Duration</span>
            <span className="text-xl font-semibold text-primary-100">
              {durationLabel}
            </span>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold text-primary-100">
            Category scores
          </h3>
          <ul className="space-y-3">
            {categoryScores.map((cat) => (
              <li
                key={cat.name}
                className="rounded-lg border border-dark-300 bg-dark-300/50 p-4"
              >
                <div className="flex justify-between gap-4">
                  <span className="font-medium text-primary-100">
                    {cat.name}
                  </span>
                  <span className="text-primary-200">{cat.score}/100</span>
                </div>
                {cat.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cat.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card-border rounded-2xl bg-dark-200 p-6">
          <h3 className="mb-3 font-semibold text-success-100">Strengths</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {(feedback.strengths ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card-border rounded-2xl bg-dark-200 p-6">
          <h3 className="mb-3 font-semibold text-destructive-100">
            Areas for improvement
          </h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {(feedback.areasForImprovement ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-border rounded-2xl bg-dark-200 p-6">
        <h3 className="mb-3 font-semibold text-primary-100">
          Final assessment
        </h3>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {feedback.finalAssessment}
        </p>
      </div>

      {(feedback.questionFeedback?.length ?? 0) > 0 && (
        <div className="card-border rounded-2xl bg-dark-200 p-6">
          <h3 className="mb-4 font-semibold text-primary-100">
            Feedback by question
          </h3>
          <ul className="space-y-4">
            {feedback.questionFeedback!.map((item, index) => (
              <li
                key={index}
                className="rounded-lg border border-dark-300 bg-dark-300/50 p-4"
              >
                <p className="mb-2 font-medium text-primary-100">
                  {item.question}
                </p>
                <span className="text-sm font-medium text-primary-200">
                  Score: {item.score}/100
                </span>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.comment}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild className="btn-primary">
          <Link href={`/interview/${interviewId}`}>Retake interview</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
};

export default FeedbackPage;
