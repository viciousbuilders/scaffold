import { z } from "zod";
import { curriculumSchema, feedbackSchema, messageSchema, questionSchema } from "./schemas";

const draftSchema = z.object({
  answer: z.string(),
  working: z.string(),
  hintCount: z.number().int().min(0),
  revealed: z.boolean(),
  completed: z.boolean(),
  tutorMessages: z.array(messageSchema),
  feedback: feedbackSchema.nullable(),
});
export const sessionSchema = z.object({
  version: z.literal(1),
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
