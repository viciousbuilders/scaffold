import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { trainingCurriculum, trainingQuestions, trainingStages } from "@/core/training-path";
import { researchQuestions } from "@/core/learning-path";
import { curriculumSchema, questionSchema, validateQuestions } from "@/core/schemas";

it("keeps training stages ordered, question IDs distinct and environments explicit", () => {
  curriculumSchema.parse(trainingCurriculum);
  for (const q of trainingQuestions) questionSchema.parse(q);
  validateQuestions([...researchQuestions, ...trainingQuestions]);
  expect(trainingStages.flatMap((stage) => stage.questionIds)).toEqual(
    trainingQuestions.map((q) => q.id),
  );
  expect(trainingQuestions).toHaveLength(12);
  expect(trainingQuestions.filter((q) => q.lab)).toHaveLength(10);
  for (const q of trainingQuestions.filter((q) => q.lab)) {
    expect(q.assessment).toBe("self-review");
    expect(q.starterCode).toContain(q.language === "cuda" ? "TODO" : "NotImplementedError");
    expect(q.lab?.setup).toContain(q.lab?.filename);
  }
  expect(() => validateQuestions([{ ...trainingQuestions[1], assessment: "checked" }])).toThrow(
    "self-review",
  );
});
it("executes local reference checks and parses every external Python starter and solution", () => {
  const script = `import json, sys, ast\nfor q in json.load(sys.stdin):\n    if q.get('lab') and q['language']=='python':\n        ast.parse(q['starterCode'])\n        ast.parse(q['solution'])\n    if q['kind']=='coding':\n        ns={}\n        exec(q['solution'], ns)\n        for test in q['tests']:\n            assert eval(test['expression'], ns), (q['id'],test['label'])\nprint('ok')`;
  expect(
    execFileSync("python3", ["-c", script], {
      input: JSON.stringify(trainingQuestions),
      encoding: "utf8",
    }).trim(),
  ).toBe("ok");
});
it.skipIf(!process.env.SCAFFOLD_TORCH_PYTHON)(
  "runs every CPU PyTorch reference lab in an isolated environment",
  () => {
    const labs = trainingQuestions.filter((q) => q.lab?.environment === "pytorch");
    expect(labs).toHaveLength(7);
    const script = `import json,sys\nfor q in json.load(sys.stdin):\n    print(q['id'], flush=True)\n    exec(compile(q['solution'],q['lab']['filename'],'exec'), {'__name__':'__main__'})\nprint('All CPU PyTorch labs passed')`;
    const output = execFileSync(process.env.SCAFFOLD_TORCH_PYTHON!, ["-c", script], {
      input: JSON.stringify(labs),
      encoding: "utf8",
      timeout: 90000,
    });
    expect(output).toContain("All CPU PyTorch labs passed");
  },
  100000,
);
