import type { Curriculum, Question } from "./schemas";

export const sampleCurriculum: Curriculum = {
  title: "Python for AI, one small step at a time",
  goal: "Build confidence writing Python, then use it to prepare data and understand model training. Mix in probability practice.",
  level: "Beginner",
  formats: ["coding", "written", "quiz"],
  modules: [
    {
      title: "Python building blocks",
      objective: "Get comfortable with functions, lists, loops and return values.",
    },
    { title: "Working with training data", objective: "Clean, scale and split small datasets." },
    {
      title: "Probability & model evaluation",
      objective: "Reason about uncertainty and measure predictions.",
    },
  ],
};

const common = {
  language: "python" as const,
  difficulty: "Easy" as const,
  options: [],
  correctOptionIndex: null,
  numericAnswer: null,
  tolerance: 0.0001,
  starterCode: "",
  tests: [],
  examples: [],
  constraints: [],
};
export const sampleQuestions: Question[] = [
  {
    ...common,
    id: "sample-positive",
    kind: "coding",
    title: "Keep the positive values",
    topic: "Python building blocks",
    description:
      "Before a dataset reaches a model, you often need to filter it.\n\nWrite `keep_positive(values)` to return a **new list** containing only the numbers greater than zero. Keep their original order and leave the input list unchanged.\n\nZero is not a positive number.",
    examples: [
      {
        input: "keep_positive([-2, 0, 3, -1, 5])",
        output: "[3, 5]",
        explanation: "Only 3 and 5 are greater than zero.",
      },
      {
        input: "keep_positive([])",
        output: "[]",
        explanation: "An empty input gives an empty list.",
      },
    ],
    constraints: [
      "values is a list of integers.",
      "0 ≤ len(values) ≤ 1,000",
      "Do not modify the input list.",
    ],
    starterCode:
      "def keep_positive(values):\n    # Return only the values greater than zero.\n    pass\n",
    tests: [
      { label: "Mixed values", expression: "keep_positive([-2, 0, 3, -1, 5]) == [3, 5]" },
      { label: "Empty list", expression: "keep_positive([]) == []" },
      { label: "No positive values", expression: "keep_positive([-5, -1, 0]) == []" },
      {
        label: "Keep order and duplicates",
        expression: "keep_positive([4, 2, 4, 1]) == [4, 2, 4, 1]",
      },
      {
        label: "Input stays unchanged",
        expression: "(lambda xs: (keep_positive(xs), xs)[1] == [-1, 2, 0])([-1, 2, 0])",
      },
    ],
    hints: [
      "Think about building a new list rather than removing items from the old one.",
      "A for loop lets you inspect each value. What condition tells you whether to keep it?",
      "Use result.append(value) inside an if block, then return result after the loop.",
    ],
    solution:
      "def keep_positive(values):\n    result = []\n    for value in values:\n        if value > 0:\n            result.append(value)\n    return result",
    explanation:
      "Start with an empty list. Visit each input value, append it only if it is greater than zero, and return the new list. This preserves order and does not mutate the input. Filtering is a common data preparation step.",
  },
  {
    ...common,
    id: "sample-mean",
    kind: "coding",
    title: "Find the average loss",
    topic: "Working with training data",
    description:
      "During model training, individual prediction errors are often combined into an average loss.\n\nWrite `mean_loss(losses)` to return the arithmetic mean of a list of numbers. Return `0.0` for an empty list.",
    examples: [
      {
        input: "mean_loss([0.2, 0.4, 0.6])",
        output: "0.4",
        explanation: "The total loss is 1.2, divided across three predictions.",
      },
    ],
    starterCode:
      "def mean_loss(losses):\n    # Handle empty input, then calculate the mean.\n    pass\n",
    constraints: [
      "losses contains finite, non-negative numbers.",
      "An empty list must return 0.0.",
    ],
    tests: [
      { label: "Three losses", expression: "abs(mean_loss([0.2, 0.4, 0.6]) - 0.4) < 1e-9" },
      { label: "Empty input", expression: "mean_loss([]) == 0.0" },
      { label: "One loss", expression: "mean_loss([0.7]) == 0.7" },
    ],
    hints: [
      "The mean is the total divided by the number of items.",
      "Check for an empty list before dividing. Python has sum() and len().",
    ],
    solution:
      "def mean_loss(losses):\n    if not losses:\n        return 0.0\n    return sum(losses) / len(losses)",
    explanation:
      "Guard against an empty list to avoid division by zero. For non-empty input, divide the sum by the count. Averaging losses makes batches of different sizes easier to compare.",
  },
  {
    ...common,
    id: "sample-dice",
    kind: "written",
    title: "Two dice, one total",
    topic: "Probability & model evaluation",
    description:
      "Roll two independent, fair six-sided dice. What is the probability that their sum is **7**?\n\nEnter your answer as a fraction, decimal, or percentage. For decimals, round to at least four decimal places. Use the working area to explain how you counted the outcomes.",
    numericAnswer: 1 / 6,
    hints: [
      "Count the equally likely ordered pairs first. How many choices does each die have?",
      "List the pairs that sum to 7. (1, 6) and (6, 1) are different outcomes.",
    ],
    solution: "1/6",
    explanation:
      "There are 6 × 6 = 36 equally likely ordered outcomes. Six have a sum of 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1). The probability is 6/36 = 1/6, approximately 16.67%.",
  },
  {
    ...common,
    id: "sample-split",
    kind: "quiz",
    title: "Why hold data back?",
    topic: "Working with training data",
    description:
      "You have a labelled dataset and are about to train a classifier. Why should you keep a separate test set that the model never sees during training?",
    options: [
      "To estimate how well it performs on unseen examples",
      "To make the training loss as low as possible",
      "To give the model more examples to memorise",
      "To avoid having to label the training data",
    ],
    correctOptionIndex: 0,
    hints: [
      "A model can perform well on examples it has already seen. What do you really want to know before using it?",
      "Think about the difference between memorising a practice exam and answering new questions.",
    ],
    solution: "To estimate how well it performs on unseen examples.",
    explanation:
      "A separate test set measures generalisation. Training performance alone can be misleading if a model memorises the data. Keep test data out of training and tuning decisions.",
  },
  {
    ...common,
    id: "sample-mse",
    kind: "coding",
    title: "Measure prediction error",
    topic: "Probability & model evaluation",
    difficulty: "Medium",
    description:
      "Write `mse(actual, predicted)` to calculate **mean squared error**. For each pair, square the difference between the prediction and actual value, then average the squared differences.\n\nReturn `0.0` if both lists are empty. The lists always have equal lengths.",
    examples: [
      {
        input: "mse([1, 2, 3], [1, 2, 5])",
        output: "1.3333333333",
        explanation: "Squared differences are 0, 0, and 4; their mean is 4/3.",
      },
    ],
    starterCode:
      "def mse(actual, predicted):\n    # Calculate the average squared difference.\n    pass\n",
    constraints: ["Both lists have the same length.", "All values are finite numbers."],
    tests: [
      {
        label: "One incorrect prediction",
        expression: "abs(mse([1, 2, 3], [1, 2, 5]) - 4/3) < 1e-9",
      },
      { label: "Perfect predictions", expression: "mse([2, 4], [2, 4]) == 0.0" },
      { label: "Empty input", expression: "mse([], []) == 0.0" },
      { label: "Negative values", expression: "mse([-1, 1], [1, -1]) == 4.0" },
    ],
    hints: [
      "Start by handling the empty case. Then think about pairing corresponding values.",
      "zip(actual, predicted) lets you visit pairs. Square each difference using ** 2.",
    ],
    solution:
      "def mse(actual, predicted):\n    if not actual:\n        return 0.0\n    squared_errors = [(a - p) ** 2 for a, p in zip(actual, predicted)]\n    return sum(squared_errors) / len(actual)",
    explanation:
      "Square each paired error so negative and positive errors cannot cancel, then average them. Larger errors contribute disproportionately. Mean squared error is a common regression loss.",
  },
];
