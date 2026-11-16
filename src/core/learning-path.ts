import type { Curriculum, Question } from "./schemas";

export type LearningStage = {
  id: string;
  title: string;
  focus: string;
  objective: string;
  milestone: string;
  questionIds: string[];
};
export const researchStages: LearningStage[] = [
  {
    id: "foundations",
    title: "Reason about models",
    focus: "Mathematics · probability",
    objective:
      "Connect gradients, uncertainty and numerical computation to the behaviour of a model.",
    milestone: "Derive a gradient, check it numerically and explain an uncertainty estimate.",
    questionIds: ["research-gradient", "research-bayes", "research-softmax"],
  },
  {
    id: "ml",
    title: "Build the learning loop",
    focus: "ML foundations · PyTorch",
    objective:
      "Understand the full path from examples to loss, gradients, updates and held-out evaluation.",
    milestone: "Train a small model independently and diagnose a deliberately broken run.",
    questionIds: ["research-linear-gradient", "research-training-loop", "research-leakage"],
  },
  {
    id: "autograd",
    title: "Understand the machinery",
    focus: "Autograd · representations",
    objective: "Build intuition for backpropagation and the shapes and masks used in attention.",
    milestone: "Trace gradients through a computation graph and implement causal attention.",
    questionIds: ["research-chain-rule", "research-autograd", "research-attention"],
  },
  {
    id: "systems",
    title: "Make training observable",
    focus: "Systems · GPUs",
    objective: "Measure memory and throughput, then explain a bottleneck using evidence.",
    milestone: "Produce a reproducible training profile with one measured improvement.",
    questionIds: ["research-memory", "research-profile", "research-reproduce"],
  },
  {
    id: "post-training",
    title: "Change model behaviour",
    focus: "SFT · preference learning",
    objective:
      "Understand what post-training optimizes and distinguish a real gain from evaluation leakage.",
    milestone: "Compare a base model and an SFT model on a frozen, held-out task.",
    questionIds: ["research-logprobs", "research-sft", "research-preferences"],
  },
  {
    id: "research",
    title: "Answer a research question",
    focus: "Agent evaluation · experiments",
    objective:
      "Bring your agent and memory experience into a controlled, falsifiable investigation.",
    milestone:
      "Publishable-quality evidence: a runnable experiment, ablations, uncertainty and an honest write-up.",
    questionIds: ["research-eval", "research-ablation", "research-report"],
  },
];
export const researchCurriculum: Curriculum = {
  title: "From understanding to research",
  goal: "Build mathematical, ML and training depth through independent implementation and reproducible experiments. Develop evidence for research engineering and applied ML work, and extend the path as experiments expose gaps.",
  level: "Intermediate",
  formats: ["coding", "written"],
  modules: researchStages.map((stage) => ({ title: stage.title, objective: stage.objective })),
};
const base = {
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
function coding(
  id: string,
  title: string,
  stage: number,
  description: string,
  starterCode: string,
  solution: string,
  tests: [string, string][],
  hints: string[],
  explanation: string,
): Question {
  return {
    ...base,
    id,
    title,
    topic: researchStages[stage].title,
    kind: "coding",
    description,
    starterCode,
    solution,
    tests: tests.map(([label, expression]) => ({ label, expression })),
    hints,
    explanation,
  };
}
function investigation(
  id: string,
  title: string,
  stage: number,
  description: string,
  checklist: string,
  url?: string,
  provider?: string,
): Question {
  return {
    ...base,
    id,
    title,
    topic: researchStages[stage].title,
    kind: "written",
    difficulty: "Hard",
    assessment: "self-review",
    description:
      description +
      "\n\n**Evidence to record:** " +
      checklist +
      "\n\nWork independently first. Use the answer area for results and links to your code or experiment. This activity is self-reviewed; completion is not a correctness certificate.",
    hints: [
      "Start with the smallest runnable case. State what you expect before running it.",
      "Compare a controlled baseline and change one thing at a time. Record failures as well as successes.",
    ],
    solution: "Review checklist: " + checklist,
    explanation:
      "Keep the implementation, configuration and results together. Explain what the evidence supports and what it does not. Revisit with a new example after using help.",
    ...(url ? { source: { provider: provider || "Reference", url, externalId: id } } : {}),
  };
}
export const researchQuestions: Question[] = [
  coding(
    "research-gradient",
    "Check a derivative without trusting it",
    0,
    "Implement `central_difference(f, x, h)` using a symmetric finite difference. Then use the tests to check several derivatives. In your own notes, explain why making h extremely small can make the estimate worse. Assume h > 0. Standard library only.",
    "def central_difference(f, x, h=1e-5):\n    pass\n",
    "def central_difference(f, x, h=1e-5):\n    return (f(x + h) - f(x - h)) / (2 * h)",
    [
      ["Quadratic", "abs(central_difference(lambda x: x*x, 3) - 6) < 1e-6"],
      ["Cubic", "abs(central_difference(lambda x: x**3, -2) - 12) < 1e-5"],
      ["Constant", "central_difference(lambda x: 7, 2) == 0"],
      ["Sine", "abs(central_difference(__import__('math').sin, 0) - 1) < 1e-6"],
    ],
    [
      "Estimate a slope using points on both sides of x.",
      "The distance between x+h and x-h is 2h.",
    ],
    "The central difference is (f(x+h)-f(x-h))/(2h). Truncation error decreases with h initially, but subtraction and floating-point roundoff eventually dominate.",
  ),
  {
    ...investigation(
      "research-bayes",
      "Update a belief, then question the assumptions",
      0,
      "A detector flags 90% of true positives and 5% of true negatives. The positive class has prevalence 1%. Derive P(positive class | flagged). Then repeat for prevalence 20%. Explain why detector accuracy alone is not enough.",
      "Two posterior calculations, a tree or contingency table, and a statement about how prevalence changes the result.",
    ),
    assessment: "checked",
    numericAnswer: 0.009 / 0.0585,
    description:
      "A detector has sensitivity 90% and false-positive rate 5%. The positive class has prevalence 1%. What is P(positive class | flagged)? Enter the posterior as a decimal or fraction. Use your working to derive it, then discuss how prevalence 20% would change the answer.",
    solution:
      "0.009 / (0.009 + 0.0495) = 2/13 ≈ 0.153846. At prevalence 20%, the posterior is 0.18 / (0.18 + 0.04) = 9/11 ≈ 0.818182.",
    explanation:
      "Use Bayes' rule. The denominator includes true flags and false flags. Automated checking verifies only the 1% prevalence answer; review the reasoning separately.",
  },
  coding(
    "research-softmax",
    "Make softmax survive large logits",
    0,
    "Implement `softmax(logits)` without NumPy. Inputs are finite numbers; return [] for empty input. The result must be invariant to adding a constant to every logit and must not overflow for [1000, 1001]. Explain the numerical trick after you implement it.",
    "import math\n\ndef softmax(logits):\n    pass\n",
    "import math\n\ndef softmax(logits):\n    if not logits:\n        return []\n    peak = max(logits)\n    values = [math.exp(x - peak) for x in logits]\n    total = sum(values)\n    return [x / total for x in values]",
    [
      ["Empty", "softmax([]) == []"],
      ["Equal logits", "softmax([0, 0]) == [0.5, 0.5]"],
      ["Large logits", "abs(softmax([1000, 1001])[1] - 0.7310585786300049) < 1e-9"],
      [
        "Shift invariance",
        "all(abs(a-b) < 1e-9 for a,b in zip(softmax([-1,2,4]), softmax([999,1002,1004])))",
      ],
      ["One class", "softmax([-2000]) == [1.0]"],
    ],
    [
      "Can you shift every input without changing the ratio?",
      "Subtract the largest logit before exponentiating.",
    ],
    "Subtracting the maximum cancels in the ratio and ensures every exponential is at most 1. These tests check values, not the quality of your explanation.",
  ),
  coding(
    "research-linear-gradient",
    "Derive and implement the loss gradient",
    1,
    "For predictions w*x+b and mean squared loss, implement `mse_gradient(xs, ys, w, b)` returning (dL/dw, dL/db). Lists have equal, positive length. Derive both expressions before coding. Do not use an autograd library.",
    "def mse_gradient(xs, ys, w, b):\n    pass\n",
    "def mse_gradient(xs, ys, w, b):\n    errors = [w*x+b-y for x,y in zip(xs, ys)]\n    n = len(xs)\n    return (2*sum(e*x for e,x in zip(errors,xs))/n, 2*sum(errors)/n)",
    [
      ["Simple fit", "mse_gradient([1,2], [2,4], 0, 0) == (-10.0, -6.0)"],
      ["At optimum", "mse_gradient([1,2], [2,4], 2, 0) == (0.0, 0.0)"],
      ["Bias term", "mse_gradient([0,0], [1,3], 0, 1) == (0.0, -2.0)"],
    ],
    [
      "Differentiate one squared error, then average.",
      "The chain rule introduces a factor of x for the weight gradient, but not for the bias.",
    ],
    "For error e_i=w*x_i+b-y_i, dL/dw=(2/n)Σe_i*x_i and dL/db=(2/n)Σe_i. Compare against finite differences to debug signs and factors.",
  ),
  investigation(
    "research-training-loop",
    "Train a model you can explain line by line",
    1,
    "In an external Python environment, build a small PyTorch classifier. Write the training loop yourself: batching, forward pass, loss, zero_grad, backward and optimizer step. First overfit one tiny batch. Then evaluate on held-out data without gradient tracking. Scaffold's browser runner does not run PyTorch.",
    "Runnable code link, package versions, seed, tiny-batch loss curve, held-out metric, and an explanation of train/eval and gradient reset.",
    "https://docs.pytorch.org/tutorials/beginner/basics/intro.html",
    "PyTorch",
  ),
  investigation(
    "research-leakage",
    "Debug an experiment that looks too good",
    1,
    "Design an experiment where preprocessing before the train/test split leaks information. Compare it with fitting preprocessing only on training data. Include a duplicate-example audit. Use a synthetic or openly licensed dataset.",
    "Split procedure, a reproducible leakage example, corrected results, and a short diagnosis of what inflated the original metric.",
  ),
  coding(
    "research-chain-rule",
    "Backpropagate through a tiny graph",
    2,
    "Let L=(a*b+c)^2. Implement `graph_gradient(a,b,c)` returning (dL/da, dL/db, dL/dc). Write out the intermediate node and local derivatives before coding. This is a small building block for understanding autograd.",
    "def graph_gradient(a, b, c):\n    pass\n",
    "def graph_gradient(a, b, c):\n    upstream = 2 * (a*b+c)\n    return (upstream*b, upstream*a, upstream)",
    [
      ["Positive values", "graph_gradient(2,3,1) == (42,28,14)"],
      ["Zero loss", "graph_gradient(2,3,-6) == (0,0,0)"],
      ["Negative path", "graph_gradient(-2,3,1) == (-30,20,-10)"],
    ],
    [
      "Name the intermediate z=a*b+c. First compute dL/dz.",
      "Multiply the upstream derivative by each local derivative.",
    ],
    "dL/dz=2z. Local derivatives of z are b, a and 1. Shared paths in a general graph require accumulating gradient contributions.",
  ),
  investigation(
    "research-autograd",
    "Build a tiny scalar autograd engine",
    2,
    "Implement scalar addition, multiplication, a nonlinearity and reverse-mode backpropagation. Support a variable reused along two graph paths. Compare analytical gradients against finite differences before consulting the reference implementation.",
    "Code link, graph traversal explanation, shared-variable test, finite-difference checks and one failure you debugged.",
    "https://github.com/karpathy/micrograd",
    "micrograd reference",
  ),
  investigation(
    "research-attention",
    "Implement and test causal attention",
    2,
    "In your external PyTorch environment, implement single-head scaled dot-product attention. Annotate every tensor shape. Apply a causal mask before softmax. Test that changing a future token cannot change an earlier token's output. Compare with a trusted library operation.",
    "Implementation, shape annotations, causal-invariance test, library comparison and explanation of the scale factor.",
    "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html",
    "PyTorch",
  ),
  {
    ...investigation("research-memory", "Account for the training memory", 3, "", ""),
    assessment: "checked",
    difficulty: "Medium",
    numericAnswer: 1.6,
    description:
      "A model has 100 million parameters. In this simplified accounting, FP32 parameters, gradients, first moments and second moments each use 4 bytes per parameter. How many **decimal GB** do these four arrays use in total? Ignore activations, temporary buffers and framework overhead. Enter a number in GB; explain in your working why actual peak memory is higher.",
    solution: "100,000,000 × 4 arrays × 4 bytes = 1,600,000,000 bytes = 1.6 decimal GB.",
    explanation:
      "This accounts for four FP32 arrays only. Activations, temporary workspaces, allocator behaviour and implementation details add memory. Mixed-precision training can use a different set of copies and dtypes.",
  },
  investigation(
    "research-profile",
    "Measure before optimizing",
    3,
    "Profile the small model you already trained. Record device, batch size, precision, step time and peak memory. If you have access to an NVIDIA GPU, include a CUDA profile; otherwise use CPU or MPS and document that limitation. Compare two batch sizes and identify one actual bottleneck. Synchronize asynchronous device work when timing.",
    "Profiler output or file link, reproducible timing method, memory numbers, two controlled runs and one supported optimization.",
    "https://docs.pytorch.org/tutorials/recipes/recipes/profiler_recipe.html",
    "PyTorch",
  ),
  investigation(
    "research-reproduce",
    "Make a run reproducible from a fresh checkout",
    3,
    "Package a previous experiment so another person can reproduce it. Separate training and evaluation, capture dependency versions and configuration, save a checkpoint, and verify that reloading reproduces the evaluation within a stated tolerance.",
    "Repository link, one run command, environment/configuration, data provenance, checkpoint/reload check and nondeterminism caveats.",
  ),
  coding(
    "research-logprobs",
    "Compute a masked token loss",
    4,
    "Implement `masked_nll(log_probs, mask)`. Inputs have equal length, log_probs contains natural log probabilities, and mask contains 0 or 1. Return the mean negative log probability over selected tokens, or 0.0 if no tokens are selected. This simplified function illustrates loss masking; it is not an SFT trainer.",
    "def masked_nll(log_probs, mask):\n    pass\n",
    "def masked_nll(log_probs, mask):\n    count = sum(mask)\n    return -sum(p*m for p,m in zip(log_probs,mask))/count if count else 0.0",
    [
      ["Masked prompt", "abs(masked_nll([-8,-1,-3], [0,1,1])-2) < 1e-9"],
      ["Empty", "masked_nll([], []) == 0.0"],
      ["All masked", "masked_nll([-2,-4], [0,0]) == 0.0"],
      ["Single token", "masked_nll([-3], [1]) == 3.0"],
    ],
    [
      "Count selected tokens rather than all tokens.",
      "The denominator is sum(mask). Guard the zero-token case.",
    ],
    "Ignoring prompt or padding tokens changes both the numerator and denominator. Real training operates on token logits and handles batching, shifting and reduction conventions.",
  ),
  investigation(
    "research-sft",
    "Run a small SFT experiment with a real baseline",
    4,
    "Choose a bounded tool-use or structured-output task with a deterministic checker. Freeze a held-out split before tuning. Measure the base model, fine-tune a small model in an external environment, then run the same evaluation. Inspect the chat template and exactly which tokens receive loss. No cloud compute is connected by Scaffold.",
    "Data/split provenance, base and SFT metrics, configuration, compute cost, failure examples, and a rerunnable evaluation command.",
    "https://huggingface.co/docs/trl/sft_trainer",
    "Hugging Face TRL",
  ),
  investigation(
    "research-preferences",
    "Decide whether preference training is justified",
    4,
    "Using failures from your SFT experiment, explain what a preference objective could change. Construct a few reviewed chosen/rejected pairs. Explain the difference between SFT, DPO and an on-policy RL approach. State which approach you would test next, or why more data/evaluation work comes first.",
    "Reviewed example pairs, objective-level explanation, a data-quality risk and a justified next experiment. Reading alone is not completion evidence.",
    "https://huggingface.co/docs/trl/dpo_trainer",
    "Hugging Face TRL",
  ),
  investigation(
    "research-eval",
    "Freeze an evaluation you can trust",
    5,
    "Choose a narrow agent/memory task and write a falsifiable research question. Define success, a simple baseline and a checker. Include unseen templates or environments and document how you prevent contamination. Audit several checker successes and failures manually.",
    "Task specification, frozen evaluation version, baseline, checker audit and explicit limits of the benchmark.",
  ),
  investigation(
    "research-ablation",
    "Run the experiment that could prove you wrong",
    5,
    "Compare the smallest useful baseline with your proposed change. Add an ablation that removes the component you believe matters. Use multiple seeds or task samples, record all runs, and report uncertainty using a method appropriate to your data.",
    "Run table, ablation, configurations, uncertainty calculation and a conclusion that could differ from your original hypothesis.",
  ),
  investigation(
    "research-report",
    "Turn results into a research artifact",
    5,
    "Write a concise report: question, related work, method, evaluation, results, failures and limitations. Include runnable code and enough detail to reproduce the central result. Ask a collaborator to challenge the strongest claim. A negative result is acceptable when the experiment is informative.",
    "Report and code links, reproducibility instructions, a claim-to-evidence table, limitations and an independent critique.",
  ),
];
