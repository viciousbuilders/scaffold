import { z } from "zod";
import type { Question } from "./schemas";
import type { Draft } from "./session";
import { hasWork } from "./practice-progress";

// Suggestions only: learners can enter any subject.
export const learningSubjects = [
  "Languages",
  "History",
  "Science",
  "Writing",
  "Arts & music",
  "Technology",
] as const;
export const learningSubjectSchema = z.string().trim().min(1).max(120);
export const learningProjectSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(160),
  subject: learningSubjectSchema,
  goal: z.string().max(4000),
  source: z.string().max(2000),
  notes: z.string().max(40000),
  results: z.string().max(40000),
  questionIds: z.array(z.string()).max(500),
  steps: z
    .array(z.object({ id: z.string(), title: z.string().min(1).max(300), done: z.boolean() }))
    .max(50),
  createdAt: z.string(),
  archived: z.boolean(),
});
export type LearningProject = z.infer<typeof learningProjectSchema>;
export function safeSource(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
export function suggestedQuestion(questions: Question[], draftFor: (q: Question) => Draft) {
  return (
    questions.find((q) => !draftFor(q).completed && hasWork(q, draftFor(q))) ??
    questions.find((q) => !draftFor(q).completed)
  );
}
