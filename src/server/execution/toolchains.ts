import "server-only";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, delimiter } from "node:path";
import { tmpdir } from "node:os";
import { runProcess } from "./process";

async function executable(override: string | undefined, names: string[], extras: string[] = []) {
  const paths = override
    ? [override]
    : [
        ...(process.env.PATH || "")
          .split(delimiter)
          .flatMap((directory) => names.map((name) => join(directory, name))),
        ...extras,
      ];
  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {}
  }
  return null;
}
export async function toolchains() {
  const [cpp, nvcc] = await Promise.all([
    executable(
      process.env.SCAFFOLD_CPP_COMPILER,
      ["clang++", "g++"],
      ["/usr/bin/clang++", "/usr/bin/g++", "/opt/homebrew/bin/g++"],
    ),
    executable(process.env.SCAFFOLD_CUDA_COMPILER, ["nvcc"], ["/usr/local/cuda/bin/nvcc"]),
  ]);
  const cppProbe = cpp ? await runProcess(cpp, ["--version"], tmpdir(), 5000) : null;
  let cudaMessage =
    "CUDA execution needs the NVIDIA CUDA toolkit and an NVIDIA GPU. You can edit CUDA questions on this Mac.";
  let cudaAvailable = false;
  if (nvcc && process.platform !== "darwin") {
    const [probe, smi] = await Promise.all([
      runProcess(nvcc, ["--version"], tmpdir(), 5000),
      executable(undefined, ["nvidia-smi"], ["/usr/bin/nvidia-smi"]),
    ]);
    const gpu = smi ? await runProcess(smi, ["-L"], tmpdir(), 5000) : null;
    cudaAvailable = !probe.error && !!gpu && !gpu.error && /GPU \d+/.test(gpu.stdout);
    cudaMessage = cudaAvailable
      ? "Local NVIDIA GPU and CUDA compiler ready."
      : "CUDA compiler found, but no NVIDIA GPU is available to run the tests.";
  }
  return {
    cpp: {
      binary: cpp,
      available: !!cppProbe && !cppProbe.error,
      message:
        cppProbe && !cppProbe.error
          ? "Local C++17 compiler ready."
          : "Install the Xcode command line tools (xcode-select --install), or set SCAFFOLD_CPP_COMPILER.",
    },
    cuda: { binary: nvcc, available: cudaAvailable, message: cudaMessage },
  };
}
