import { describe, expect, it } from "vitest";
import { gradeAnswer, parseNumericAnswer } from "@/core/grading";
import { sampleQuestions } from "@/core/sample";

describe("numeric answers", () => {
  it.each([
    ["1/6", 1 / 6],
    [" 16.67% ", 0.1667],
    ["0.1667", 0.1667],
    ["-3 / 2", -1.5],
    ["2e-3", 0.002],
    [".25", 0.25],
  ])("parses %s", (input, expected) =>
    expect(parseNumericAnswer(input as string)).toBeCloseTo(expected as number),
  );
  it.each(["", " ", "1/0", "Infinity", "NaN", "1/2/3", "0x10", "1+1", "because it is likely"])(
    'rejects "%s"',
    (input) => expect(parseNumericAnswer(input)).toBeNull(),
  );
  it("accepts equivalent answers and the specified rounding tolerance", () => {
    const question = sampleQuestions.find((q) => q.id === "sample-dice")!;
    for (const answer of ["1/6", "0.1667", "16.67%"])
      expect(gradeAnswer(question, answer)?.correct).toBe(true);
    expect(gradeAnswer(question, "0.16")?.correct).toBe(false);
  });
  it("uses an option index, rather than accepting the text or an empty selection", () => {
    const question = sampleQuestions.find((q) => q.kind === "quiz")!;
    expect(gradeAnswer(question, "0")?.correct).toBe(true);
    for (const wrong of ["", "1", "-1", "0.0"])
      expect(gradeAnswer(question, wrong)?.correct).toBe(false);
  });
  it("sends conceptual answers to the AI grader instead of guessing", () => {
    expect(
      gradeAnswer({ ...sampleQuestions[2], numericAnswer: null }, "Some reasoning"),
    ).toBeNull();
  });
});
