import { z } from "zod";
import { learningProjectSchema } from "./learning-projects";
import { curriculumSchema, feedbackSchema, messageSchema, questionSchema } from "./schemas";

export const attemptSchema = z.object({
  at: z.iso.datetime(),
  answer: z.string(),
  working: z.string(),
  hints: z.number().int().min(0),
  revealed: z.boolean(),
  tutorUsed: z.boolean().optional(),
  evidence: z.enum(["tests", "answer-key", "ai-feedback", "self-review", "draft"]),
  correct: z.boolean().nullable(),
  feedback: z.string(),
});
export type Attempt = z.infer<typeof attemptSchema>;
const draftSchema = z.object({
  answer: z.string(),
  working: z.string(),
  hintCount: z.number().int().min(0),
  revealed: z.boolean(),
  completed: z.boolean(),
  tutorMessages: z.array(messageSchema),
  feedback: feedbackSchema.nullable(),
  attempts: z.array(attemptSchema).max(100).optional(),
  reviewRequested: z.boolean().optional(),
});
export const sessionSchema = z.object({
  version: z.literal(1),
  learningProjects: z.array(learningProjectSchema).max(100).optional(),
  curriculum: curriculumSchema.nullable(),
  messages: z.array(messageSchema),
  questions: z.array(questionSchema),
  activeIndex: z.number().int().min(0),
  moduleIndex: z.number().int().min(0),
  drafts: z.record(z.string(), draftSchema),
  sample: z.boolean(),
  theme: z.enum(["light", "dark"]),
});
export type Session = z.infer<typeof sessionSchema>;
export type Draft = z.infer<typeof draftSchema>;
export const EMPTY: Session = {
  version: 1,
  curriculum: null,
  messages: [],
  questions: [],
  activeIndex: 0,
  moduleIndex: 0,
  drafts: {},
  sample: false,
  theme: "light",
};

export const progressSchema = sessionSchema.omit({ curriculum: true, questions: true });
export type Progress = z.infer<typeof progressSchema>;
