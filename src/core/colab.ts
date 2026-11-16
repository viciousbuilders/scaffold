import { z } from "zod";
export const colabInputSchema = z.object({
  action: z.enum(["status", "connect", "disconnect", "run", "stop", "shutdown"]),
  questionId: z.string().min(1).max(200).optional(),
  code: z.string().max(20000).optional(),
  language: z.enum(["python", "cuda"]).optional(),
});
export const colabStatusSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  phase: z.enum(["idle", "connecting", "running", "stopping"]),
  output: z.string(),
  error: z.string().nullable(),
  succeeded: z.boolean().nullable(),
  generation: z.number(),
});
export type ColabStatus = z.infer<typeof colabStatusSchema>;
export function executionCode(code: string, language: "python" | "cuda") {
  if (language === "python") return code;
  // Send code as data, never interpolate it into a shell command.
  return `import pathlib, subprocess, tempfile\nwith tempfile.TemporaryDirectory(prefix='scaffold-') as folder:\n    source=pathlib.Path(folder)/'lab.cu'\n    source.write_text(${JSON.stringify(code)})\n    binary=str(pathlib.Path(folder)/'lab')\n    subprocess.run(['nvcc','-O2',str(source),'-o',binary],check=True)\n    subprocess.run([binary],check=True)\n`;
}
export function parseSseBlock(block: string): unknown | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  return JSON.parse(data);
}
