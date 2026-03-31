import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

/**
 * Legacy: used when Vapi workflow (voice-based setup) generates an interview.
 * Option-based setup uses createInterview server action instead; no Vapi for prompt generation.
 */
export async function POST(request: Request) {
  const { type, role, level, techstack, amount, userid } =
    await request.json();

  try {
    const { text } = await generateText({
      model: google("gemini-2.0-flash-001"), // ✅ FIXED MODEL
      prompt: `
Generate exactly ${amount} interview questions.

Role: ${role}
Experience Level: ${level}
Tech Stack: ${techstack}

Return ONLY a valid JSON array like:
["Question 1", "Question 2"]

Do not include any extra explanation or formatting.
      `,
    });

    let parsedQuestions;

    try {
      parsedQuestions = JSON.parse(text); // ✅ Safe parse
    } catch (err) {
      console.error("Invalid JSON from Gemini:", text);
      parsedQuestions = [];
    }

    const interview = {
      role,
      type,
      level,
      techstack: techstack.split(","),
      questions: parsedQuestions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json({ success: true, interview }, { status: 200 });
  } catch (error: any) {
    console.error("Gemini Interview Generation Error:", error.message);

    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
