import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { curriculumSchema, questionBatchSchema, validateQuestions } from "@/core/schemas";
import { sampleCurriculum, sampleQuestions } from "@/core/sample";
import { tutorProblem } from "@/core/tutor-context";

describe("question integrity", () => {
  it("validates the sample curriculum and mixed question set", () => {
    expect(curriculumSchema.safeParse(sampleCurriculum).success).toBe(true);
    expect(questionBatchSchema.safeParse({ questions: sampleQuestions }).success).toBe(true);
    expect(validateQuestions(sampleQuestions, sampleCurriculum.formats)).toHaveLength(5);
  });
  it("rejects duplicate IDs, unavailable quiz options, and incomplete coding problems", () => {
    expect(() => validateQuestions([sampleQuestions[0], sampleQuestions[0]])).toThrow("unique");
    expect(() => validateQuestions([{ ...sampleQuestions[3], correctOptionIndex: 100 }])).toThrow(
      "available",
    );
    expect(() => validateQuestions([{ ...sampleQuestions[0], tests: [] }])).toThrow("two tests");
    expect(() => validateQuestions([sampleQuestions[3]], ["coding"])).toThrow("format");
  });
  it("executes every reference Python solution against every sample test", () => {
    const payload = sampleQuestions
      .filter((q) => q.kind === "coding")
      .map((q) => ({ code: q.solution, tests: q.tests }));
    const script = `import sys, json\nresults = []\nfor question in json.load(sys.stdin):\n    namespace = {}\n    exec(question['code'], namespace)\n    results.append([bool(eval(test['expression'], namespace)) for test in question['tests']])\nprint(json.dumps(results))`;
    const results: boolean[][] = JSON.parse(
      execFileSync("python3", ["-c", script], { input: JSON.stringify(payload), encoding: "utf8" }),
    );
    expect(results).toHaveLength(3);
    expect(results.flat().every(Boolean)).toBe(true);
  });
  it("withholds all answer-bearing fields from the tutor", () => {
    for (const question of sampleQuestions) {
      const context = tutorProblem(question);
      expect(context).not.toHaveProperty("solution");
      expect(context).not.toHaveProperty("explanation");
      expect(context).not.toHaveProperty("tests");
      expect(context).not.toHaveProperty("numericAnswer");
      expect(context).not.toHaveProperty("correctOptionIndex");
      expect(context).not.toHaveProperty("hints");
      expect(context.title).toBe(question.title);
    }
  });
});
