import { expect, it } from "vitest";
import { learningSubjectSchema, safeSource, suggestedQuestion } from "@/core/learning-projects";
import { sessionSchema, EMPTY } from "@/core/session";
import { researchQuestions } from "@/core/learning-path";
import { getDraft } from "@/features/session/store";
it("loads older progress without requiring projects", () => {
  expect(sessionSchema.parse(EMPTY).learningProjects).toBeUndefined();
});
it("allows web sources and rejects executable URL schemes", () => {
  expect(safeSource("https://www.baseten.co/blog")).toBe("https://www.baseten.co/blog");
  expect(safeSource("javascript:alert(1)")).toBeNull();
  expect(safeSource("file:///etc/passwd")).toBeNull();
});
it("suggests unfinished work ahead of an untouched exercise and skips completed work", () => {
  const [first, second] = researchQuestions;
  const session = {
    ...EMPTY,
    questions: [first, second],
    drafts: { [second.id]: { ...getDraft(second, EMPTY), working: "My attempt" } },
  };
  expect(suggestedQuestion(session.questions, (q) => getDraft(q, session))?.id).toBe(second.id);
  session.drafts[second.id].completed = true;
  expect(suggestedQuestion(session.questions, (q) => getDraft(q, session))?.id).toBe(first.id);
});

it("accepts arbitrary subjects and preserves legacy subjects", () => {
  for (const subject of ["Film history", "日本語", "Quant maths", "AI / ML", "GPU programming"])
    expect(learningSubjectSchema.parse(subject)).toBe(subject);
  expect(learningSubjectSchema.parse("  Photography  ")).toBe("Photography");
  expect(learningSubjectSchema.safeParse("   ").success).toBe(false);
  expect(learningSubjectSchema.safeParse("x".repeat(121)).success).toBe(false);
});
