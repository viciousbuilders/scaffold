import { z } from "zod";
import { languageSchema } from "@/core/execution";
import { messageSchema, tutorResponseSchema } from "@/core/schemas";
import { aiCall } from "@/server/ai/service";
import { TUTOR_PROMPT } from "@/server/ai/prompts";
import { jsonEndpoint } from "@/server/http";

const problemSchema = z.object({
  kind: z.enum(["coding", "written", "quiz"]),
  language: languageSchema.default("python"),
  title: z.string().max(160),
  topic: z.string().max(120),
  description: z.string().max(8000),
  examples: z
    .array(z.object({ input: z.string(), output: z.string(), explanation: z.string() }))
    .max(3),
  constraints: z.array(z.string()).max(6),
  options: z.array(z.string()).max(6),
});
export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = jsonEndpoint(
  z.object({
    problem: problemSchema,
    attempt: z.string().max(16000),
    messages: z.array(messageSchema).min(1).max(30),
  }),
  async ({ problem, attempt, messages }, signal) =>
    aiCall(
      tutorResponseSchema,
      "tutor_reply",
      TUTOR_PROMPT,
      [
        {
          role: "user",
          content: `Problem and attempt data: ${JSON.stringify({ problem, attempt })}`,
        },
        ...messages,
      ],
      signal,
    ),
);
