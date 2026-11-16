import type { Question } from "./schemas";
import snapshot from "@/content/exercism/binary-search.json";

export type LibraryEntry = {
  id: string;
  title: string;
  subject: "Coding" | "Chess" | "Poker" | "Chinese" | "Reading";
  provider: string;
  mode: "Imported exercise" | "Platform link" | "Scaffold exercise" | "Self-guided";
  description: string;
  url?: string;
};
export const libraryEntries: LibraryEntry[] = [
  {
    id: "exercism-binary-search",
    title: "Binary search",
    subject: "Coding",
    provider: "Exercism",
    mode: "Imported exercise",
    description:
      "A pinned, MIT-licensed exercise with canonical test cases adapted to Python. Available offline after installation.",
    url: "https://github.com/exercism/problem-specifications/tree/main/exercises/binary-search",
  },
  {
    id: "leetcode-two-sum",
    title: "Two Sum",
    subject: "Coding",
    provider: "LeetCode",
    mode: "Platform link",
    description:
      "Solve on LeetCode; keep your approach, complexity analysis and retry notes here. No account sync or LeetCode judge in Scaffold.",
    url: "https://leetcode.com/problems/two-sum/",
  },
  {
    id: "leetcode-binary-search",
    title: "Binary Search",
    subject: "Coding",
    provider: "LeetCode",
    mode: "Platform link",
    description:
      "Practice invariants and boundary conditions on the original platform. Record your result yourself.",
    url: "https://leetcode.com/problems/binary-search/",
  },
  {
    id: "lichess-forks",
    title: "Recognize a fork",
    subject: "Chess",
    provider: "Lichess",
    mode: "Platform link",
    description:
      "Use Lichess's interactive board and validation. Record a puzzle URL, candidate moves and what you missed in Scaffold.",
    url: "https://lichess.org/training/fork",
  },
  {
    id: "lichess-endgame",
    title: "Think through an endgame",
    subject: "Chess",
    provider: "Lichess",
    mode: "Platform link",
    description:
      "Analyze an endgame before moving. Save the specific puzzle link and your reasoning; Scaffold does not infer your rating.",
    url: "https://lichess.org/training/endgame",
  },
  {
    id: "poker-call-ev",
    title: "Price a river call",
    subject: "Poker",
    provider: "Scaffold",
    mode: "Scaffold exercise",
    description:
      "Calculate expected value and break-even equity in a precisely defined offline scenario.",
  },
  {
    id: "poker-hand-review",
    title: "Review a hand by decisions",
    subject: "Poker",
    provider: "Your hand history",
    mode: "Self-guided",
    description:
      "Record a past hand, ranges, pot odds and assumptions. Evaluate the decision separately from the outcome.",
  },
  {
    id: "chinese-recall",
    title: "Use what you have learned",
    subject: "Chinese",
    provider: "Your material",
    mode: "Self-guided",
    description:
      "Retrieve useful vocabulary and write a short passage before checking your source. Keep corrections and retry later.",
  },
  {
    id: "reading-synthesis",
    title: "Read, close, explain",
    subject: "Reading",
    provider: "Your material",
    mode: "Self-guided",
    description:
      "Explain a selected chapter or paper from memory, then check one claim against the original. Casual reading can stay untracked.",
  },
];
const common = {
  kind: "written" as const,
  language: "python" as const,
  difficulty: "Medium" as const,
  examples: [],
  constraints: [],
  starterCode: "",
  tests: [],
  options: [],
  correctOptionIndex: null,
  numericAnswer: null,
  tolerance: 0.000001,
};
function linked(entry: LibraryEntry): Question {
  const prompts: Record<string, string> = {
    "leetcode-two-sum":
      "Open the original problem. Attempt it independently, then record your approach, time/space complexity, edge cases and the result reported by LeetCode. Do not copy the statement here. After help, retry with a different input.",
    "leetcode-binary-search":
      "Solve the original problem. Record your loop invariant, interval convention, edge cases and the result reported by LeetCode. Explain why the interval strictly shrinks.",
    "lichess-forks":
      "Open the Lichess fork training session. For a puzzle, list candidate moves before playing. Record the specific puzzle URL, your proposed line, the validated line and the tactical cue you missed. Do not use a guessed move as verified analysis.",
    "lichess-endgame":
      "Open an endgame puzzle on Lichess. Record the specific puzzle URL, position or FEN, your candidate move and plan. Play on Lichess, then compare its validated line with yours. Explain the relevant endgame idea.",
    "poker-hand-review":
      "Choose a completed hand. Record positions, stacks, actions, pot size and a plausible opponent range. Calculate pot odds and state the assumptions behind your equity estimate. Explain your decision without using the eventual win/loss as proof. Attach a solver result only if you actually checked it.",
    "chinese-recall":
      "Choose a short passage or a small set of useful expressions from your current material. Close it. Write a few sentences using those expressions, then check them and record specific corrections. Add the source title or URL and identify what to retrieve again next time.",
    "reading-synthesis":
      "Choose a chapter or paper. Record its title or URL. Close the source and explain its central claim, evidence and one limitation. Reopen it to check your explanation and record a correction or unresolved question. This is an optional active-reading activity, not a requirement for leisure reading.",
  };
  return {
    ...common,
    id: entry.id,
    title: entry.title,
    topic: entry.subject,
    assessment: "self-review",
    description:
      prompts[entry.id] +
      "\n\nCompletion is self-reported. Your notes and activity history stay in Scaffold; platform results are not synchronized.",
    hints: [
      "Write an independent attempt before checking the source or asking for help.",
      "Record the exact mistake and one different example to try later.",
    ],
    solution:
      "Review your original attempt against the source or trusted checker. State what you checked and what remains uncertain.",
    explanation:
      "Recording an activity is evidence of practice, not automatic proof of mastery. Revisit on an unfamiliar example without assistance.",
    ...(entry.url
      ? { source: { provider: entry.provider, url: entry.url, externalId: entry.id } }
      : {}),
  };
}
export function sourceQuestion(id: string): Question {
  const entry = libraryEntries.find((item) => item.id === id);
  if (!entry) throw new Error("Unknown exercise source.");
  if (id === "poker-call-ev")
    return {
      ...common,
      id,
      title: entry.title,
      topic: "Poker",
      description:
        "On the river, the pot is $100 **after your opponent's bet and before your call**. It costs $25 to call. You win 30% of the time, with no ties, no rake and no further betting. What is the expected value of calling, in dollars, relative to folding? Enter a number. In your working, calculate the break-even equity as well.",
      numericAnswer: 12.5,
      hints: [
        "When you win, your net gain relative to folding is the $100 already in the pot. When you lose, your loss is your $25 call.",
        "EV = p × 100 − (1−p) × 25.",
      ],
      solution: "0.30 × 100 − 0.70 × 25 = $12.50. Break-even equity is 25/(100+25) = 20%.",
      explanation:
        "The pot definition matters. Winning returns your call as part of the final pot, so its net gain is $100; losing costs $25. This calculation assumes the stated equity is correct and ignores rake and future action.",
    };
  if (id !== "exercism-binary-search") return linked(entry);
  // Snapshot is pinned to a commit and shipped with the upstream MIT notice.
  // Adapt upstream error cases to -1 and retain every canonical case in 8 groups.
  const cases = snapshot.canonical.cases;
  const groups = Array.from({ length: Math.min(8, cases.length) }, () => [] as string[]);
  cases.forEach((test, index) => {
    const expected = typeof test.expected === "number" ? test.expected : -1;
    groups[index % groups.length].push(
      `find(${JSON.stringify(test.input.array)}, ${test.input.value}) == ${expected}`,
    );
  });
  return {
    ...common,
    id,
    title: entry.title,
    topic: "Coding",
    kind: "coding",
    description:
      snapshot.instructions +
      "\n\n### Scaffold Python interface\nImplement `find(array, value)` returning the zero-based index, or **-1** when absent. The input is sorted with unique values. Use logarithmic search rather than a linear scan or built-in index lookup. Upstream missing-value errors are adapted to -1. Tests check behaviour; inspect your implementation's complexity separately.",
    starterCode: "def find(array, value):\n    pass\n",
    tests: groups.map((group, index) => ({
      label: `Canonical cases ${index + 1}`,
      expression: `all([${group.join(", ")}])`,
    })),
    hints: [
      "Track the interval that could still contain the target.",
      "Compare the middle value and discard the half that cannot contain the target.",
      "With inclusive bounds, move low to mid+1 or high to mid-1. Return -1 after the interval becomes empty.",
    ],
    solution:
      "def find(array, value):\n    low, high = 0, len(array) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if array[mid] == value:\n            return mid\n        if array[mid] < value:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1",
    explanation:
      "Maintain an inclusive interval containing every possible target position. Each comparison removes at least half of the remaining interval. Time is O(log n), extra space O(1). The adapter uses -1 instead of upstream missing-value errors; passing these adapted tests is not an Exercism platform submission.",
    source: {
      provider: "Exercism",
      url: entry.url!,
      externalId: "binary-search",
      version: snapshot.provenance.commit,
      license: "MIT",
      attribution:
        "Exercise instructions and canonical cases © Exercism contributors, MIT. Python interface, hints and reference solution adapted for Scaffold. The full MIT notice is included with Scaffold.",
    },
  };
}
