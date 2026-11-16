import type { Question, Feedback } from "./schemas";
import type { Draft, Attempt } from "./session";

export function usedHelp(draft: Draft) {
  return (
    draft.revealed ||
    draft.hintCount > 0 ||
    draft.tutorMessages.some((message) => message.role === "assistant")
  );
}

export function hasWork(question: Question, draft: Draft) {
  return Boolean(
    (draft.answer.trim() && draft.answer !== question.starterCode) ||
    draft.working.trim() ||
    draft.hintCount ||
    draft.revealed ||
    draft.feedback ||
    draft.tutorMessages.length,
  );
}
export function reviewReason(question: Question, draft: Draft): string | null {
  if (draft.reviewRequested) return "Saved for review";
  if (usedHelp(draft)) return "Retry without help";
  if (draft.feedback?.correct === false) return "Revisit a mistake";
  if (!draft.completed && hasWork(question, draft)) return "Finish your attempt";
  return null;
}
export function withAttempt(
  draft: Draft,
  feedback: Feedback | null,
  evidence: Attempt["evidence"],
  at = new Date().toISOString(),
): Draft {
  const correct =
    evidence === "self-review" || evidence === "draft" ? null : (feedback?.correct ?? false);
  const attempt: Attempt = {
    at,
    answer: draft.answer,
    working: draft.working,
    hints: draft.hintCount,
    revealed: draft.revealed,
    tutorUsed: draft.tutorMessages.some((message) => message.role === "assistant"),
    evidence,
    correct,
    feedback:
      feedback?.feedback ||
      (evidence === "draft"
        ? "Unsubmitted work archived before retry."
        : "Activity recorded by you; not independently checked."),
  };
  return {
    ...draft,
    feedback,
    completed: correct === true || evidence === "self-review",
    attempts: [...(draft.attempts || []), attempt].slice(-100),
  };
}
export function freshAttempt(draft: Draft, question: Question): Draft {
  const last = draft.attempts?.at(-1);
  const changed =
    !last ||
    last.answer !== draft.answer ||
    last.working !== draft.working ||
    last.hints !== draft.hintCount ||
    last.revealed !== draft.revealed ||
    !!last.tutorUsed !== draft.tutorMessages.some((message) => message.role === "assistant");
  const saved = hasWork(question, draft) && changed ? withAttempt(draft, null, "draft") : draft;
  return {
    ...saved,
    answer: question.starterCode,
    working: "",
    hintCount: 0,
    revealed: false,
    completed: false,
    feedback: null,
    tutorMessages: [],
    reviewRequested: false,
  };
}
