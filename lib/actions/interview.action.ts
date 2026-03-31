"use server";

import { db } from "@/firebase/admin";
import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const LOG_PREFIX = "[Interview]";

interface CreateInterviewParams {
  userId: string;
  role: string;
  level: string;
  type: string;
  techStack: string[];
  questionCount: number;
}

/**
 * Build prompt purely from selected options. No Vapi/voice/transcript dependency.
 * Pipeline: Option Selection → This prompt → Gemini → Questions
 */
function buildPromptFromOptions(params: {
  role: string;
  level: string;
  type: string;
  techStack: string[];
  questionCount: number;
}): string {
  const { role, level, type, techStack, questionCount } = params;
  const techList =
    Array.isArray(techStack) && techStack.length > 0
      ? techStack.join(" and ")
      : "technologies relevant to the role";

  return `Generate ${questionCount} interview questions for a ${role} (${level}) using ${techList}. The interview type is ${type}. Return only a JSON array of questions.`;
}

/**
 * Safely extract a string[] from Gemini response. Handles markdown, extra text, invalid JSON.
 * Never throws; returns empty array if parsing fails.
 */
function parseQuestionsFromGeminiResponse(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];

  let text = raw.trim();

  // Strip markdown code blocks
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((q): q is string => typeof q === "string");
    }
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q: unknown): q is string => typeof q === "string");
    }
  } catch {
    // Fallback: find first [...] substring and parse that
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter((q): q is string => typeof q === "string");
        }
      } catch {
        // ignore
      }
    }

    // Last resort: split by newlines and clean lines as questions
    const lines = text
      .split(/\n+/)
      .map((s) => s.replace(/^[\s\-*\d.)"]+|\s*$|^"\s*|"$/g, "").trim())
      .filter(Boolean);
    if (lines.length > 0) return lines;
  }

  return [];
}

export async function createInterview(params: CreateInterviewParams) {
  const userId = params.userId?.trim();
  const role = params.role?.trim() ?? "";
  const level = params.level?.trim() ?? "";
  const type = params.type?.trim() ?? "";
  const techStack = Array.isArray(params.techStack) ? params.techStack : [];
  const questionCount = Math.min(20, Math.max(1, Number(params.questionCount) || 5));

  console.log(`${LOG_PREFIX} createInterview called with:`, {
    userId: userId ? "***" : undefined,
    role,
    level,
    type,
    techStackLength: techStack.length,
    questionCount,
  });

  try {
    if (!userId) {
      console.warn(`${LOG_PREFIX} Rejected: missing userId`);
      return { success: false, error: "You must be signed in to create an interview." };
    }
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error(`${LOG_PREFIX} Missing GOOGLE_GENERATIVE_AI_API_KEY`);
      return { success: false, error: "Interview service is not configured. Please try again later." };
    }
    if (!role || !level || !type) {
      console.warn(`${LOG_PREFIX} Rejected: missing role/level/type`, { role, level, type });
      return { success: false, error: "Please select role, level, and interview type." };
    }

    const prompt = buildPromptFromOptions({ role, level, type, techStack, questionCount });
    console.log(`${LOG_PREFIX} Prompt created:`, prompt);

    let questions: string[] = [];

    try {
      console.log(`${LOG_PREFIX} Sending request to Gemini (generateObject)...`);
      const result = await generateObject({
        model: google("gemini-2.0-flash-001"),
        schema: z.object({
          questions: z.array(z.string()),
        }),
        prompt,
      });
      if (result.object?.questions?.length) {
        questions = result.object.questions;
        console.log(`${LOG_PREFIX} Gemini response parsed (generateObject): ${questions.length} questions`);
      }
    } catch (objectError) {
      console.warn(`${LOG_PREFIX} generateObject failed, falling back to generateText:`, objectError);
    }

    if (!questions.length) {
      console.log(`${LOG_PREFIX} Sending request to Gemini (generateText fallback)...`);
      const { text } = await generateText({
        model: google("gemini-2.0-flash-001"),
        prompt: prompt + " Reply with only a JSON array of question strings, no other text.",
      });
      console.log(`${LOG_PREFIX} Gemini raw response length:`, text?.length ?? 0);
      questions = parseQuestionsFromGeminiResponse(text ?? "");
      if (questions.length) {
        console.log(`${LOG_PREFIX} Response parsed safely (generateText): ${questions.length} questions`);
      }
    }

    if (!questions.length) {
      console.error(`${LOG_PREFIX} No questions extracted from Gemini response`);
      return { success: false, error: "Could not generate interview questions. Please try again." };
    }

    const interviewRef = await db.collection("interviews").add({
      userId,
      role,
      level,
      type,
      techstack: techStack,
      questions,
      createdAt: new Date().toISOString(),
      finalized: false,
    });

    console.log(`${LOG_PREFIX} Interview created:`, interviewRef.id);

    return {
      success: true,
      interviewId: interviewRef.id,
    };
  } catch (error: unknown) {
    console.error(`${LOG_PREFIX} Create Interview Error:`, error);
    const message = error instanceof Error ? error.message : "Failed to create interview";
    return {
      success: false,
      error: message,
      details: String(error),
    };
  }
}

export async function deleteInterview(interviewId: string, userId: string) {
  try {
    const interviewRef = db.collection("interviews").doc(interviewId);
    const doc = await interviewRef.get();

    if (!doc.exists) {
      return { success: false, error: "Interview not found" };
    }

    const data = doc.data();
    if (data?.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    await interviewRef.delete();

    // Optionally delete associated feedback
    const feedbackSnapshot = await db
      .collection("feedback")
      .where("interviewId", "==", interviewId)
      .get();

    if (!feedbackSnapshot.empty) {
      const batch = db.batch();
      feedbackSnapshot.docs.forEach((feedbackDoc) => {
        batch.delete(feedbackDoc.ref);
      });
      await batch.commit();
    }

    revalidatePath("/");

    return { success: true };
  } catch (error: unknown) {
    console.error(`${LOG_PREFIX} Delete Interview Error:`, error);
    return { success: false, error: "Failed to delete interview" };
  }
}
