import type { Curriculum, Question } from "./schemas";
import type { LearningStage } from "./learning-path";

export const trainingStages: LearningStage[] = [
  {
    id: "tensors",
    title: "Program with tensors",
    focus: "Shapes · strides · broadcasting",
    objective: "Translate array layouts and shape reasoning into working tensor code.",
    milestone: "Explain a tensor's layout and write a shape-safe PyTorch operation.",
    questionIds: ["training-strides", "training-broadcast"],
  },
  {
    id: "gradients",
    title: "Control the gradients",
    focus: "Autograd · optimizer steps",
    objective:
      "Trace gradients, distinguish leaf tensors and update parameters without retaining unwanted graphs.",
    milestone: "Verify gradients analytically and implement an SGD step without .data.",
    questionIds: ["training-autograd", "training-sgd"],
  },
  {
    id: "loops",
    title: "Write reliable training code",
    focus: "Optimization · checkpoints",
    objective: "Build a complete learning loop, debug convergence and resume a run faithfully.",
    milestone:
      "Fit a tiny dataset and reproduce the next optimizer step after loading a checkpoint.",
    questionIds: ["training-fit", "training-checkpoint"],
  },
  {
    id: "gpu-model",
    title: "Understand GPU execution",
    focus: "Launch grids · measurement",
    objective: "Map work to GPU threads and measure asynchronous device operations correctly.",
    milestone:
      "Cover boundary elements exactly once and produce a reproducible CPU/MPS/CUDA timing.",
    questionIds: ["training-launch", "training-benchmark"],
  },
  {
    id: "kernels",
    title: "Write your first GPU kernels",
    focus: "CUDA C++ · Triton",
    objective:
      "Implement bounded memory accesses and validate GPU output against a trusted reference.",
    milestone:
      "Write vector-add kernels that handle non-multiple sizes and report correctness before speed.",
    questionIds: ["training-cuda-add", "training-triton-add"],
  },
  {
    id: "efficiency",
    title: "Train with memory in mind",
    focus: "Gradient accumulation · AMP",
    objective:
      "Preserve the training objective while changing batch execution and numerical precision.",
    milestone:
      "Match full-batch gradients with accumulation, then run and inspect an AMP training step.",
    questionIds: ["training-accumulation", "training-amp"],
  },
];
export const trainingCurriculum: Curriculum = {
  title: "PyTorch & GPU programming",
  goal: "Write, debug and measure the code behind model training, from tensor operations to GPU kernels and efficient training.",
  level: "Intermediate",
  formats: ["coding", "written"],
  modules: trainingStages.map((s) => ({ title: s.title, objective: s.objective })),
};
const common = {
  difficulty: "Medium" as const,
  language: "python" as const,
  examples: [],
  constraints: [],
  tests: [],
  options: [],
  correctOptionIndex: null,
  numericAnswer: null,
  tolerance: 0.000001,
};
const torchIntro = "https://docs.pytorch.org/tutorials/beginner/basics/intro.html";
export const LAB_ENVIRONMENTS = {
  pytorch: "PyTorch · CPU / MPS / CUDA",
  cuda: "CUDA C++ · NVIDIA GPU",
  triton: "Triton · NVIDIA GPU",
  "pytorch-cuda": "PyTorch AMP · NVIDIA GPU",
};
function local(
  id: string,
  title: string,
  stage: number,
  description: string,
  starterCode: string,
  solution: string,
  tests: [string, string][],
): Question {
  return {
    ...common,
    id,
    title,
    topic: trainingStages[stage].title,
    kind: "coding",
    description,
    starterCode,
    solution,
    tests: tests.map(([label, expression]) => ({ label, expression })),
    hints: [
      "Write down the mapping from logical coordinates to storage or execution indices.",
      "Test an empty case and a boundary that does not divide evenly.",
    ],
    explanation:
      "The checks verify these cases. Explain your indexing assumptions and try another shape or launch size.",
  };
}
function lab(
  id: string,
  title: string,
  stage: number,
  description: string,
  filename: string,
  starterCode: string,
  solution: string,
  url = torchIntro,
  environment: NonNullable<Question["lab"]>["environment"] = "pytorch",
): Question {
  const setup =
    environment === "cuda"
      ? `On an NVIDIA GPU machine with the CUDA toolkit:\nnvcc -O2 ${filename} -o vector_add\n./vector_add`
      : environment === "triton"
        ? `On an NVIDIA GPU machine with compatible PyTorch and Triton installed:\npython ${filename}\nUse the linked tutorial for platform setup.`
        : environment === "pytorch-cuda"
          ? `On an NVIDIA GPU machine, install a CUDA-enabled PyTorch build using the official selector, then:\npython ${filename}`
          : `In your own Python environment:\npython3 -m venv .venv\nsource .venv/bin/activate\npython -m pip install torch\npython ${filename}\nStart on CPU; later compare an available MPS or CUDA device.`;
  return {
    ...common,
    id,
    title,
    topic: trainingStages[stage].title,
    kind: "written",
    assessment: "self-review",
    language: environment === "cuda" ? "cuda" : "python",
    difficulty: stage >= 4 ? "Hard" : "Medium",
    description:
      description +
      "\n\nComplete the TODO in the code editor, download the file and run its checks in the stated environment. Record the command, output, device and a short explanation in the results area. External results are recorded by you; Scaffold does not execute or verify this lab.",
    starterCode,
    solution,
    hints: [
      "Read the checks first. Predict shapes, values and failure cases before writing code.",
      "Make the smallest correct implementation, then compare it with the reference. Preserve evidence of a failure you debugged.",
    ],
    explanation:
      "Run the included checks before drawing a conclusion. Record package versions, hardware and assumptions. Transfer the idea to your research model after the small example works.",
    source: {
      provider: environment === "cuda" ? "NVIDIA" : environment === "triton" ? "Triton" : "PyTorch",
      url,
      externalId: id,
    },
    lab: { environment, filename, setup },
  };
}
function pythonLab(
  id: string,
  title: string,
  stage: number,
  description: string,
  filename: string,
  imports: string,
  signature: string,
  body: string,
  checks: string,
  url?: string,
  environment?: NonNullable<Question["lab"]>["environment"],
): Question {
  const prefix = imports + "\n\n" + signature + "\n";
  const suffix = "\n\n" + checks + "\nprint('All lab checks passed')\n";
  return lab(
    id,
    title,
    stage,
    description,
    filename,
    prefix + "    raise NotImplementedError('Complete this function')\n" + suffix,
    prefix + body + "\n" + suffix,
    url,
    environment,
  );
}
export const trainingQuestions: Question[] = [
  local(
    "training-strides",
    "Locate a value without flattening the tensor",
    0,
    "Implement `storage_offset(indices, strides, offset=0)` for a strided tensor. Each logical index contributes index × stride; offset is the base position. Inputs have equal length and valid indices. Return the storage position in elements. This standard-library exercise runs in Scaffold; it prepares you to reason about views and transposes.",
    "def storage_offset(indices, strides, offset=0):\n    pass\n",
    "def storage_offset(indices, strides, offset=0):\n    return offset + sum(i*s for i,s in zip(indices,strides))",
    [
      ["Contiguous matrix", "storage_offset([1,2], [4,1]) == 6"],
      ["Transposed view", "storage_offset([2,1], [1,4]) == 6"],
      ["Nonzero base", "storage_offset([1,1], [3,1], 7) == 11"],
      ["Scalar", "storage_offset([], [], 9) == 9"],
    ],
  ),
  pythonLab(
    "training-broadcast",
    "Center rows without a Python loop",
    0,
    "Implement `center_rows(x)` for a floating 2D PyTorch tensor by subtracting each row's mean. Preserve shape and device. Use tensor operations, not Python loops. Explain why keepdim matters and how broadcasting aligns dimensions.",
    "center_rows.py",
    "import torch",
    "def center_rows(x):",
    "    return x - x.mean(dim=1, keepdim=True)",
    "x = torch.tensor([[1., 2., 6.], [2., 4., 9.]])\ny = center_rows(x)\nassert y.shape == x.shape and y.device == x.device\nassert torch.allclose(y, x - x.mean(dim=1, keepdim=True))\nassert torch.allclose(y.mean(dim=1), torch.zeros(2), atol=1e-6)\nassert torch.equal(x, torch.tensor([[1., 2., 6.], [2., 4., 9.]]))\nassert torch.allclose(center_rows(torch.tensor([[5.]])), torch.zeros(1, 1))",
  ),
  pythonLab(
    "training-autograd",
    "Check autograd against an analytical gradient",
    1,
    "Return the gradient of sum(x**3 + 2*x) with respect to x. Work on a detached clone, leave the caller's tensor and .grad untouched, and return a detached gradient. Explain leaf tensors, requires_grad and why backward accumulates gradients.",
    "autograd_check.py",
    "import torch",
    "def polynomial_gradient(x):",
    "    leaf = x.detach().clone().requires_grad_(True)\n    loss = (leaf**3 + 2*leaf).sum()\n    loss.backward()\n    return leaf.grad.detach().clone()",
    "x = torch.tensor([-2., 0., 3.], requires_grad=True)\ng = polynomial_gradient(x)\nassert torch.allclose(g, torch.tensor([14., 2., 29.]))\nassert x.grad is None\nassert not g.requires_grad\nassert torch.allclose(polynomial_gradient(torch.tensor([1.])), torch.tensor([5.]))",
    "https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html",
  ),
  pythonLab(
    "training-sgd",
    "Write one optimizer step safely",
    1,
    "Update a leaf parameter in place using its gradient and a learning rate, then clear its gradient to None. Avoid .data. Explain why the update should not become part of the next computation graph. Return nothing.",
    "sgd_step.py",
    "import torch",
    "def sgd_step(parameter, learning_rate):",
    "    with torch.no_grad():\n        parameter.add_(parameter.grad, alpha=-learning_rate)\n    parameter.grad = None",
    "p = torch.tensor([1., -2.], requires_grad=True)\np.square().sum().backward()\nsgd_step(p, 0.1)\nassert torch.allclose(p, torch.tensor([0.8, -1.6]))\nassert p.is_leaf and p.grad is None\np.square().sum().backward()\nassert torch.allclose(p.grad, torch.tensor([1.6, -3.2]))",
  ),
  pythonLab(
    "training-fit",
    "Fit a tiny model with your own training loop",
    2,
    "Learn y=3x−1 on x=[−2,−1,0,1,2] using two scalar parameters initialized at zero. Implement the forward pass, MSE, gradient reset, backward and an SGD update. Return detached weight and bias. After it works, deliberately omit zero_grad and explain the effect.",
    "fit_line.py",
    "import torch",
    "def fit_line():",
    "    x = torch.tensor([-2., -1., 0., 1., 2.])\n    y = 3*x - 1\n    w = torch.tensor(0., requires_grad=True)\n    b = torch.tensor(0., requires_grad=True)\n    optimizer = torch.optim.SGD([w, b], lr=0.05)\n    for _ in range(200):\n        optimizer.zero_grad(set_to_none=True)\n        loss = ((w*x + b - y)**2).mean()\n        loss.backward()\n        optimizer.step()\n    return w.detach(), b.detach()",
    "w, b = fit_line()\nassert abs(w.item() - 3) < 0.01\nassert abs(b.item() + 1) < 0.01\nassert not w.requires_grad and not b.requires_grad\nprint({'weight': w.item(), 'bias': b.item()})",
  ),
  pythonLab(
    "training-checkpoint",
    "Resume Adam without losing its state",
    2,
    "Save model and Adam optimizer state after one update, load both into fresh objects, and compare the next update with an uninterrupted run. Return the maximum parameter difference after that next step. Use the same fixed data. Explain why saving weights alone changes the resumed optimization trajectory.",
    "resume_adam.py",
    "import torch\nimport tempfile\nfrom pathlib import Path",
    "def resumed_difference():",
    "    torch.manual_seed(7)\n    x = torch.tensor([[1.], [2.], [3.]])\n    y = 3*x - 1\n    model = torch.nn.Linear(1, 1)\n    optimizer = torch.optim.Adam(model.parameters(), lr=0.03)\n    def step(m, opt):\n        opt.zero_grad(set_to_none=True)\n        (m(x) - y).square().mean().backward()\n        opt.step()\n    step(model, optimizer)\n    with tempfile.TemporaryDirectory() as folder:\n        path = Path(folder) / 'checkpoint.pt'\n        torch.save({'model': model.state_dict(), 'optimizer': optimizer.state_dict()}, path)\n        state = torch.load(path, weights_only=True)\n    restored = torch.nn.Linear(1, 1)\n    restored.load_state_dict(state['model'])\n    restored_optimizer = torch.optim.Adam(restored.parameters(), lr=0.03)\n    restored_optimizer.load_state_dict(state['optimizer'])\n    step(model, optimizer)\n    step(restored, restored_optimizer)\n    return max((a-b).abs().max().item() for a,b in zip(model.parameters(), restored.parameters()))",
    "difference = resumed_difference()\nassert difference < 1e-7, difference\nprint({'maximum_parameter_difference': difference})",
    "https://docs.pytorch.org/tutorials/beginner/saving_loading_models.html",
  ),
  local(
    "training-launch",
    "Map a launch grid to valid elements",
    3,
    "Simulate a 1D GPU launch in Python. Implement `launch_indices(n, block_size)` returning the valid global indices in launch order. Use ceil(n/block_size) blocks and block_size threads per block, with a bounds guard. n is nonnegative and block_size is positive. Do not shortcut to list(range(n)); explicitly model blocks and threads. Explain why the final block needs a guard.",
    "def launch_indices(n, block_size):\n    pass\n",
    "def launch_indices(n, block_size):\n    result = []\n    for block in range((n + block_size - 1)//block_size):\n        for thread in range(block_size):\n            index = block*block_size + thread\n            if index < n:\n                result.append(index)\n    return result",
    [
      ["Empty", "launch_indices(0, 256) == []"],
      ["Partial block", "launch_indices(5, 4) == [0,1,2,3,4]"],
      ["Boundary", "launch_indices(257, 256) == list(range(257))"],
      ["Single-thread blocks", "launch_indices(3, 1) == [0,1,2]"],
    ],
  ),
  pythonLab(
    "training-benchmark",
    "Time device work rather than just dispatch",
    3,
    "Implement `benchmark_ms(op, device, warmup=3, repeats=10)`. Warm up, synchronize the chosen device before and after the timed region, run op repeatedly and return mean milliseconds. Handle CPU, MPS and CUDA. Use the same operation, shapes and dtype when comparing devices; record hardware and versions. Do not infer GPU speed from CPU-only results.",
    "benchmark_device.py",
    "import torch\nimport time\nimport math",
    "def benchmark_ms(op, device, warmup=3, repeats=10):",
    "    def synchronize():\n        if device.type == 'cuda':\n            torch.cuda.synchronize(device)\n        elif device.type == 'mps':\n            torch.mps.synchronize()\n    for _ in range(warmup):\n        op()\n    synchronize()\n    start = time.perf_counter()\n    for _ in range(repeats):\n        op()\n    synchronize()\n    return (time.perf_counter() - start)*1000/repeats",
    "device = torch.device('cpu')\na = torch.randn(64, 64, device=device)\nms = benchmark_ms(lambda: a @ a, device, warmup=1, repeats=3)\nassert math.isfinite(ms) and ms > 0\nprint({'device': str(device), 'mean_ms': ms, 'torch': torch.__version__})",
    "https://docs.pytorch.org/tutorials/recipes/recipes/benchmark.html",
  ),
];
const cudaScaffold = `#include <cuda_runtime.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define CUDA_CHECK(expr) do { cudaError_t e = (expr); if (e != cudaSuccess) { std::fprintf(stderr, "%s\\n", cudaGetErrorString(e)); std::exit(1); } } while (0)

__global__ void vector_add(const float* a, const float* b, float* c, int n) {
    // TODO: calculate global index, guard n, then write one sum.
}

int main() {
    for (int n : {0, 1, 257, 1025}) {
        if (n == 0) continue; // An empty input needs no launch.
        std::vector<float> a(n), b(n), c(n);
        for (int i=0; i<n; ++i) { a[i]=float(i)*0.25f; b[i]=-float(i)*0.125f; }
        float *da, *db, *dc;
        size_t bytes = n*sizeof(float);
        CUDA_CHECK(cudaMalloc(&da, bytes));
        CUDA_CHECK(cudaMalloc(&db, bytes));
        CUDA_CHECK(cudaMalloc(&dc, bytes));
        CUDA_CHECK(cudaMemcpy(da, a.data(), bytes, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(db, b.data(), bytes, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemset(dc, 0xff, bytes));
        int block = 256;
        vector_add<<<(n+block-1)/block, block>>>(da, db, dc, n);
        CUDA_CHECK(cudaGetLastError());
        CUDA_CHECK(cudaDeviceSynchronize());
        CUDA_CHECK(cudaMemcpy(c.data(), dc, bytes, cudaMemcpyDeviceToHost));
        for (int i=0; i<n; ++i) {
            if (!std::isfinite(c[i]) || std::fabs(c[i]-(a[i]+b[i])) > 1e-6f) {
                std::fprintf(stderr, "Mismatch at n=%d, i=%d\\n", n, i); return 1;
            }
        }
        CUDA_CHECK(cudaFree(da)); CUDA_CHECK(cudaFree(db)); CUDA_CHECK(cudaFree(dc));
    }
    std::puts("All lab checks passed");
}
`;
trainingQuestions.push(
  lab(
    "training-cuda-add",
    "Write and validate a CUDA C++ kernel",
    4,
    "Complete the vector-add kernel. The host harness allocates memory, initializes the output with a sentinel, launches partial blocks, checks errors and validates results. Study blockIdx, blockDim and threadIdx. Compile and run on an NVIDIA machine; use Compute Sanitizer to check invalid accesses before benchmarking. The file contains its own main(), so run it externally rather than through Scaffold's function-only CUDA runner.",
    "vector_add.cu",
    cudaScaffold,
    cudaScaffold.replace(
      "    // TODO: calculate global index, guard n, then write one sum.",
      "    int i = blockIdx.x * blockDim.x + threadIdx.x;\n    if (i < n) c[i] = a[i] + b[i];",
    ),
    "https://docs.nvidia.com/cuda/cuda-programming-guide/",
    "cuda",
  ),
  pythonLab(
    "training-triton-add",
    "Express a masked kernel in Triton",
    4,
    "Complete the kernel using program_id, arange, masked loads and a masked store. The wrapper and correctness checks are included. Explain how a Triton program differs from one CUDA thread. After correctness, use the linked tutorial's benchmark approach to compare against torch addition on the same GPU.",
    "triton_add.py",
    "import torch\nimport triton\nimport triton.language as tl\n\nif not torch.cuda.is_available():\n    raise SystemExit('This lab requires an NVIDIA GPU and a compatible Triton installation.')\n\n@triton.jit",
    "def add_kernel(a, b, out, n, BLOCK: tl.constexpr):",
    "    offsets = tl.program_id(0) * BLOCK + tl.arange(0, BLOCK)\n    mask = offsets < n\n    x = tl.load(a + offsets, mask=mask, other=0)\n    y = tl.load(b + offsets, mask=mask, other=0)\n    tl.store(out + offsets, x + y, mask=mask)",
    "def add(a, b):\n    out = torch.empty_like(a)\n    if a.numel():\n        add_kernel[(triton.cdiv(a.numel(), 256),)](a, b, out, a.numel(), BLOCK=256)\n    return out\n\nfor n in (0, 1, 257, 1025):\n    a = torch.randn(n, device='cuda')\n    b = torch.randn(n, device='cuda')\n    torch.testing.assert_close(add(a, b), a + b)",
    "https://triton-lang.org/main/getting-started/tutorials/01-vector-add.html",
    "triton",
  ),
  pythonLab(
    "training-accumulation",
    "Accumulate gradients without changing the objective",
    5,
    "Implement the gradient of mean squared error for a linear model x@weight by processing microbatches. Normalize each microbatch's summed loss by the total number of target elements, including a short final batch. Return the accumulated gradient. Transfer this reasoning to the loss masking in your research path.",
    "gradient_accumulation.py",
    "import torch\nimport torch.nn.functional as F",
    "def accumulated_gradient(x, y, weight, microbatch):",
    "    w = weight.detach().clone().requires_grad_(True)\n    for start in range(0, len(x), microbatch):\n        prediction = x[start:start+microbatch] @ w\n        loss = F.mse_loss(prediction, y[start:start+microbatch], reduction='sum') / y.numel()\n        loss.backward()\n    return w.grad.detach().clone()",
    "torch.manual_seed(4)\nx = torch.randn(5, 3)\ny = torch.randn(5, 1)\nw = torch.randn(3, 1, requires_grad=True)\nexpected, = torch.autograd.grad(F.mse_loss(x @ w, y), w)\nfor size in (1, 2, 5, 9):\n    actual = accumulated_gradient(x, y, w, size)\n    torch.testing.assert_close(actual, expected)\nassert w.grad is None",
  ),
  pythonLab(
    "training-amp",
    "Train one step with autocast and gradient scaling",
    5,
    "Implement a CUDA FP16 mixed-precision step using autocast and GradScaler. Reset gradients, compute loss inside autocast, then scale backward, step and update the scaler outside it. Return a detached loss. After the checks pass, compare a fixed batch and seed with FP32 and explain precision, memory and overflow trade-offs. Add AMP to the small model from your research path only after the baseline works.",
    "amp_step.py",
    "import torch\nimport torch.nn.functional as F\n\nif not torch.cuda.is_available():\n    raise SystemExit('This lab requires an NVIDIA GPU with CUDA-enabled PyTorch.')",
    "def amp_step(model, optimizer, scaler, x, y):",
    "    optimizer.zero_grad(set_to_none=True)\n    with torch.autocast(device_type='cuda', dtype=torch.float16):\n        loss = F.mse_loss(model(x), y)\n    scaler.scale(loss).backward()\n    scaler.step(optimizer)\n    scaler.update()\n    return loss.detach()",
    "torch.manual_seed(9)\nmodel = torch.nn.Linear(4, 1).cuda()\noptimizer = torch.optim.SGD(model.parameters(), lr=0.01)\nscaler = torch.amp.GradScaler('cuda', init_scale=128.)\nx = torch.randn(16, 4, device='cuda')\ny = torch.randn(16, 1, device='cuda')\nbefore = [p.detach().clone() for p in model.parameters()]\nloss = amp_step(model, optimizer, scaler, x, y)\nassert torch.isfinite(loss).item() and not loss.requires_grad\nassert all(torch.isfinite(p).all().item() for p in model.parameters())\nassert any(not torch.equal(a, b) for a, b in zip(before, model.parameters()))\nprint({'loss': loss.item(), 'scale': scaler.get_scale(), 'device': torch.cuda.get_device_name()})",
    "https://docs.pytorch.org/docs/stable/notes/amp_examples.html",
    "pytorch-cuda",
  ),
);
