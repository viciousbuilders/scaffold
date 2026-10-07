import { z } from "zod";
import { questionSchema, feedbackSchema } from "@/core/schemas";
import { gradeAnswer } from "@/core/grading";
import { aiCall } from "@/server/ai/service";
import { GRADER_PROMPT } from "@/server/ai/prompts";
import { jsonEndpoint } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = jsonEndpoint(
  z.object({ question: questionSchema, answer: z.string().min(1).max(16000) }),
  async ({ question, answer }, signal) => {
    const result = gradeAnswer(question, answer);
    if (result) return result;
    return aiCall(
      feedbackSchema,
      "answer_feedback",
      GRADER_PROMPT,
      [{ role: "user", content: JSON.stringify({ question, answer }) }],
      signal,
    );
  },
);
