import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { researchQuestions, researchStages, researchCurriculum } from "@/core/learning-path";
import { libraryEntries, sourceQuestion } from "@/core/source-library";
import { curriculumSchema, questionSchema, validateQuestions } from "@/core/schemas";
import { EMPTY, progressSchema, type Draft } from "@/core/session";
import { freshAttempt, reviewReason, withAttempt } from "@/core/practice-progress";
const draft: Draft = {
  answer: "my attempt",
  working: "my reasoning",
  hintCount: 0,
  revealed: false,
  completed: false,
  tutorMessages: [],
  feedback: null,
};

describe("research curriculum and source adapters", () => {
  it("has a coherent ordered path with unique, valid activities and explicit assessments", () => {
    curriculumSchema.parse(researchCurriculum);
    const questions = [
      ...researchQuestions,
      ...libraryEntries.map((entry) => sourceQuestion(entry.id)),
    ];
    for (const q of questions) questionSchema.parse(q);
    validateQuestions(questions);
    expect(researchStages.flatMap((stage) => stage.questionIds)).toEqual(
      researchQuestions.map((q) => q.id),
    );
    for (const q of researchQuestions) {
      expect(researchStages.some((stage) => stage.title === q.topic)).toBe(true);
      if (q.kind === "written" && q.numericAnswer === null)
        expect(q.assessment).toBe("self-review");
    }
    expect(sourceQuestion("exercism-binary-search").source).toMatchObject({
      provider: "Exercism",
      license: "MIT",
    });
    expect(sourceQuestion("leetcode-two-sum").assessment).toBe("self-review");
    expect(() => sourceQuestion("arbitrary-url")).toThrow("Unknown");
  });
  it("executes all reference implementations against all bundled and imported checks", () => {
    const questions = [
      ...researchQuestions,
      ...libraryEntries.map((entry) => sourceQuestion(entry.id)),
    ].filter((q) => q.kind === "coding");
    const script = `import json, sys\nfor q in json.load(sys.stdin):\n    ns={}\n    exec(q['solution'], ns)\n    for test in q['tests']:\n        assert eval(test['expression'], ns), (q['id'], test['label'])\nprint('ok')`;
    expect(
      execFileSync("python3", ["-c", script], {
        input: JSON.stringify(questions),
        encoding: "utf8",
      }).trim(),
    ).toBe("ok");
  });
  it("does not claim external activity or AI feedback is deterministic evidence", () => {
    const recorded = withAttempt(draft, null, "self-review");
    expect(recorded.completed).toBe(true);
    expect(recorded.attempts?.[0]).toMatchObject({
      correct: null,
      evidence: "self-review",
      answer: "my attempt",
    });
    expect(
      withAttempt(draft, { correct: true, feedback: "Looks plausible" }, "ai-feedback")
        .attempts?.[0].evidence,
    ).toBe("ai-feedback");
  });
  it("retains assisted and failed evidence across a fresh independent retry", () => {
    const q = researchQuestions[0];
    const failed = withAttempt(
      { ...draft, hintCount: 1 },
      { correct: false, feedback: "Wrong sign" },
      "tests",
    );
    expect(reviewReason(q, failed)).toBe("Retry without help");
    const fresh = freshAttempt(failed, q);
    expect(fresh.answer).toBe(q.starterCode);
    expect(fresh.attempts).toEqual(failed.attempts);
    expect(fresh.completed).toBe(false);
    expect(fresh.hintCount).toBe(0);
    expect(reviewReason(q, fresh)).toBeNull();
    const passed = withAttempt(
      { ...fresh, answer: "a new answer" },
      { correct: true, feedback: "Passed" },
      "tests",
    );
    expect(passed.attempts).toHaveLength(2);
    expect(reviewReason(q, passed)).toBeNull();
    expect(failed.attempts).toHaveLength(1);
  });
  it("archives changed, unsubmitted work before starting fresh and records tutor assistance", () => {
    const withHelp = {
      ...draft,
      tutorMessages: [{ role: "assistant" as const, content: "Try the chain rule" }],
    };
    expect(reviewReason(researchQuestions[0], withHelp)).toBe("Retry without help");
    const fresh = freshAttempt(withHelp, researchQuestions[0]);
    expect(fresh.attempts?.[0]).toMatchObject({
      answer: "my attempt",
      working: "my reasoning",
      evidence: "draft",
      correct: null,
      tutorUsed: true,
    });
    expect(fresh.tutorMessages).toEqual([]);
  });
  it("loads legacy drafts and round-trips new history while bounding its size", () => {
    const previous = { ...EMPTY, drafts: { old: draft } };
    expect(progressSchema.parse(previous).drafts.old).toEqual(draft);
    let current = draft;
    for (let index = 0; index < 105; index++) current = withAttempt(current, null, "self-review");
    expect(current.attempts).toHaveLength(100);
    expect(
      progressSchema.parse({ ...EMPTY, drafts: { new: current } }).drafts.new.attempts,
    ).toHaveLength(100);
  });
});
