import { z } from "zod";
import { languageSchema } from "./execution";

export const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
});
export const curriculumSchema = z.object({
  title: z.string().min(1).max(120),
  goal: z.string().min(1).max(1200),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  formats: z
    .array(z.enum(["coding", "written", "quiz"]))
    .min(1)
    .max(3),
  modules: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        objective: z.string().min(1).max(500),
      }),
    )
    .min(1)
    .max(6),
});
export const planResponseSchema = z.object({
  reply: z.string().min(1),
  curriculum: curriculumSchema.nullable(),
});
export const questionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["coding", "written", "quiz"]),
  title: z.string().min(1).max(160),
  topic: z.string().min(1).max(120),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  description: z.string().min(1).max(8000),
  examples: z
    .array(z.object({ input: z.string(), output: z.string(), explanation: z.string() }))
    .max(3),
  constraints: z.array(z.string()).max(6),
  language: languageSchema.default("python"),
  starterCode: z.string().max(8000),
  tests: z.array(z.object({ label: z.string(), expression: z.string().min(1).max(2000) })).max(8),
  options: z.array(z.string()).max(6),
  correctOptionIndex: z.number().int().nullable(),
  numericAnswer: z.number().nullable(),
  tolerance: z.number().min(0),
  hints: z.array(z.string()).min(1).max(4),
  solution: z.string().min(1).max(8000),
  explanation: z.string().min(1).max(8000),
});
export const questionBatchSchema = z.object({ questions: z.array(questionSchema).min(1).max(6) });
export const feedbackSchema = z.object({ correct: z.boolean(), feedback: z.string().min(1) });
export const tutorResponseSchema = z.object({ reply: z.string().min(1).max(6000) });

export type Message = z.infer<typeof messageSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;

// Structural output is checked again for relationships JSON Schema cannot express.
export function validateQuestions(
  questions: Question[],
  formats?: Curriculum["formats"],
): Question[] {
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw new Error("Question IDs must be unique.");
  for (const q of questions) {
    if (formats && !formats.includes(q.kind))
      throw new Error("Question format does not match the curriculum.");
    if (q.kind === "coding" && (!q.starterCode.trim() || q.tests.length < 2))
      throw new Error("Coding questions need starter code and at least two tests.");
    if (
      q.kind === "quiz" &&
      (q.options.length < 2 ||
        q.correctOptionIndex === null ||
        q.correctOptionIndex < 0 ||
        q.correctOptionIndex >= q.options.length)
    )
      throw new Error("Quiz answer must identify an available option.");
  }
  return questions;
}
