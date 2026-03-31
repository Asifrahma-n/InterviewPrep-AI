"use server";

import { feedbackSchema } from "@/constants";
import { db } from "@/firebase/admin";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";

export async function getInterviewsByUserId(
  userId: string,
): Promise<Interview[] | null> {
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams,
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const snapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Feedback;
}

export async function getFeedbacksByUserId(
  userId: string
): Promise<Feedback[]> {
  const snapshot = await db
    .collection("feedback")
    .where("userId", "==", userId)
    .get();

  const feedbacks = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Feedback[];

  return feedbacks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Get feedback for multiple interviews (current user). Returns map interviewId -> Feedback. */
export async function getFeedbacksForInterviewIds(
  userId: string,
  interviewIds: string[]
): Promise<Record<string, Feedback>> {
  if (interviewIds.length === 0) return {};
  const map: Record<string, Feedback> = {};
  const chunkSize = 10;
  for (let i = 0; i < interviewIds.length; i += chunkSize) {
    const chunk = interviewIds.slice(i, i + chunkSize);
    const snapshot = await db
      .collection("feedback")
      .where("userId", "==", userId)
      .where("interviewId", "in", chunk)
      .get();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Feedback & { interviewId: string };
      if (data.interviewId) map[data.interviewId] = { ...data, id: doc.id };
    });
  }
  return map;
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, questions, visualMetrics, durationSeconds } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`,
      )
      .join("");

    const visualContext = visualMetrics
      ? `
        Body language & webcam analysis (client-side, during the interview):
        - Average attention / eye-contact score (0-100): ${visualMetrics.averageAttention}
        - Average confidence score from posture & expression (0-100): ${visualMetrics.averageConfidence}
        - Most frequently detected emotion: ${visualMetrics.dominantEmotion}

        You MUST provide a BodyLanguageAndConfidence score (0-100) based on this data. Use the attention and confidence scores (e.g. average them or weight them) and the dominant emotion to produce a single 0-100 score. Mention eye contact, posture, or expression in the finalAssessment or in a category comment where relevant. This score is separate from verbal performance: do NOT use it to boost totalScore or the five main category scores—those must reflect verbal participation only.`
      : `
        No body language data was collected for this interview. Set BodyLanguageAndConfidence to 0 and do not comment on eye contact or facial expression.`;

    const questionsBlock =
      (questions?.length ?? 0) > 0
        ? `
Interview questions that were asked (in order):
${questions!.map((q, i) => `${i + 1}. ${q}`).join("\n")}

For each question above, provide a "questionFeedback" entry: score (0-100) and a short comment. Use the exact question text as the "question" field. If the candidate did not answer a question at all (no relevant user/candidate response for that question), you MUST set score to 0 for that question and comment that they did not answer. Match by topic/order from the transcript.`
        : "";

    const jsonSchemaDescription = `Return a single JSON object with no markdown or code fences, with this exact shape:
{
  "totalScore": number (0-100),
  "categoryScores": [
    { "name": "Communication Skills", "score": number, "comment": string },
    { "name": "Technical Knowledge", "score": number, "comment": string },
    { "name": "Problem Solving", "score": number, "comment": string },
    { "name": "Cultural Fit", "score": number, "comment": string },
    { "name": "Confidence and Clarity", "score": number, "comment": string }
  ],
  "strengths": string[],
  "areasForImprovement": string[],
  "finalAssessment": string,
  "BodyLanguageAndConfidence": number (0-100)${questions?.length ? ',\n  "questionFeedback": [ { "question": string, "score": number, "comment": string }, ... ] (one entry per interview question)' : ""}
}`;

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001"),
      system:
        "You are a strict interviewer evaluating a mock interview. Score the candidate only on what they actually said and did. If the candidate was mostly silent, gave very short or no answers, or did not engage meaningfully, you MUST give low scores (totalScore and category scores should be low, e.g. 20-45). Do not reward silence or minimal participation. Body language scores cannot substitute for verbal participation. Respond with only valid JSON, no other text or markdown.",
      prompt: `Analyze this mock interview and return feedback as a single JSON object (no markdown, no code fences).

Transcript:
${formattedTranscript}
${visualContext}
${questionsBlock}

IMPORTANT SCORING RULES:
- Base scores primarily on the CANDIDATE's verbal responses (user/candidate lines in the transcript). If the candidate said very little, was mostly silent, or gave one-word/minimal answers, totalScore and all category scores MUST be low (roughly 15-50 depending on how little they said). Do not give high scores when there is little or no substantive response.
- Body language (BodyLanguageAndConfidence) can be scored separately, but it must NOT inflate the overall totalScore or other categories. Someone who was silent but had good eye contact should still get a low totalScore and low Communication/Technical/Problem Solving/etc. scores.
- Only give high scores (e.g. 70+) when the candidate actually provided substantive, relevant answers to the questions.

${jsonSchemaDescription}

Score 0-100 for totalScore and each category. Use exactly the five category names above in categoryScores. Include 1-4 strengths and 1-4 areasForImprovement (if the candidate was silent, areasForImprovement should mention lack of participation, need to answer questions, etc.). Write a short finalAssessment paragraph. When body language data was provided above, you MUST set BodyLanguageAndConfidence to a 0-100 score based on that data (e.g. blend of the attention and confidence scores). When no body language data was provided, set BodyLanguageAndConfidence to 0.${questions?.length ? " Include questionFeedback with one object per interview question (use the exact question text, score 0-100, and a brief comment). For any question the candidate did not answer, set score to 0." : ""}`,
    });

    const rawJson = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(rawJson) as unknown;
    const parseResult = feedbackSchema.safeParse(parsed);
    if (!parseResult.success) {
      console.error("Feedback schema validation failed", parseResult.error.flatten());
      return {
        success: false,
        error: "AI returned invalid feedback format. Please try again.",
      };
    }
    const object = parseResult.data;

    let bodyLangScore = object.BodyLanguageAndConfidence ?? 0;
    if (visualMetrics && (bodyLangScore == null || bodyLangScore === 0)) {
      bodyLangScore = Math.round(
        (visualMetrics.averageAttention + visualMetrics.averageConfidence) / 2
      );
    }

    const feedbackPayload: Record<string, unknown> = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      BodyLanguageAndConfidence: bodyLangScore,
      createdAt: new Date().toISOString(),
    };
    if (object.questionFeedback?.length) {
      feedbackPayload.questionFeedback = object.questionFeedback;
    }
    if (durationSeconds != null && durationSeconds >= 0) {
      feedbackPayload.durationSeconds = durationSeconds;
    }
    const feedback = await db.collection("feedback").add(feedbackPayload);

    revalidatePath("/");
    revalidatePath("/profile");

    return {
      success: true,
      feedbackId: feedback.id,
    };
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    console.error("Error saving feedback", err);
    const message =
      err?.message?.includes("API key") || err?.message?.toLowerCase().includes("api_key")
        ? "AI API key missing or invalid. Check GOOGLE_GENERATIVE_AI_API_KEY."
        : err?.message?.toLowerCase().includes("permission") || err?.message?.toLowerCase().includes("firestore")
          ? "Database error. Check Firebase permissions for the feedback collection."
          : err?.message ?? "Failed to generate feedback.";
    return {
      success: false,
      error: message,
    };
  }

  return {
    success: false,
    error: "Failed to generate feedback.",
  };
}
