import type { Feedback, Question } from "./schemas";

export function parseNumericAnswer(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const percent = raw.endsWith("%");
  const value = percent ? raw.slice(0, -1).trim() : raw;
  const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const fraction = value.split("/").map((part) => part.trim());
  let result: number;
  if (fraction.length === 2 && fraction.every((part) => numberPattern.test(part))) {
    const denominator = Number(fraction[1]);
    if (denominator === 0) return null;
    result = Number(fraction[0]) / denominator;
  } else if (numberPattern.test(value)) {
    result = Number(value);
  } else return null;
  result = percent ? result / 100 : result;
  return Number.isFinite(result) ? result : null;
}

export function gradeAnswer(question: Question, answer: string): Feedback | null {
  if (question.kind === "quiz") {
    const index = /^\d+$/.test(answer) ? Number(answer) : -1;
    const correct = index === question.correctOptionIndex;
    return {
      correct,
      feedback: correct
        ? "Correct. Your reasoning is on the right track."
        : "Not quite. Revisit the concept or ask your tutor for a hint.",
    };
  }
  if (question.kind === "written" && question.numericAnswer !== null) {
    const number = parseNumericAnswer(answer);
    if (number === null)
      return {
        correct: false,
        feedback:
          "Enter a number, fraction, or percentage in the answer field. Put your reasoning in the working area.",
      };
    const correct =
      Math.abs(number - question.numericAnswer) <=
      question.tolerance + Number.EPSILON * Math.max(1, Math.abs(question.numericAnswer));
    return {
      correct,
      feedback: correct
        ? "Correct. Nice work."
        : "Not quite. Check your assumptions and arithmetic, or ask for a hint.",
    };
  }
  return null;
}
