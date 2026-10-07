import type { Question } from "./schemas";

// Explicit allowlist: tutor never receives answer keys, tests, hints, or solutions.
export function tutorProblem(question: Question) {
  const { kind, language, title, topic, description, examples, constraints, options } = question;
  return { kind, language, title, topic, description, examples, constraints, options };
}
