import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleQuestions } from "@/core/sample";
import { tutorProblem } from "@/core/tutor-context";

const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/server/ai/service", () => ({
  aiCall: mock.call,
  AiError: class extends Error {
    constructor(
      message: string,
      readonly status = 502,
    ) {
      super(message);
    }
  },
}));
import { POST as tutor } from "@/app/api/tutor/route";
import { POST as grade } from "@/app/api/grade/route";

function request(path: string, body: unknown, origin = "http://localhost:3010") {
  return new Request(`http://localhost:3010/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin, "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
}
beforeEach(() => mock.call.mockReset());

describe("AI route boundaries", () => {
  it("rejects a different origin before invoking Codex", async () => {
    expect((await tutor(request("tutor", {}, "https://another-app.example"))).status).toBe(403);
    expect(mock.call).not.toHaveBeenCalled();
  });
  it("rejects malformed tutor requests", async () => {
    expect((await tutor(request("tutor", {}))).status).toBe(400);
    expect(mock.call).not.toHaveBeenCalled();
  });
  it("strips answer keys and solutions added to a tutor request", async () => {
    mock.call.mockResolvedValue({ reply: "What condition selects a positive value?" });
    const problem = {
      ...tutorProblem(sampleQuestions[0]),
      solution: "SECRET SOLUTION",
      tests: ["SECRET TEST"],
      correctOptionIndex: 0,
    };
    const response = await tutor(
      request("tutor", {
        problem,
        attempt: "pass",
        messages: [{ role: "user", content: "Where do I start?" }],
      }),
    );
    expect(response.status).toBe(200);
    const context = mock.call.mock.calls[0][3][0].content;
    expect(context).not.toContain("SECRET");
    expect(context).toContain("pass");
  });
  it("grades numeric and quiz answers without paying for an AI call", async () => {
    const response = await grade(request("grade", { question: sampleQuestions[2], answer: "1/6" }));
    expect(await response.json()).toMatchObject({ correct: true });
    expect(mock.call).not.toHaveBeenCalled();
  });
});
