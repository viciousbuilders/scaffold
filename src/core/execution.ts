import { z } from "zod";
export const languageSchema = z.enum(["python", "javascript", "cpp", "cuda"]);
export type CodingLanguage = z.infer<typeof languageSchema>;
export const LANGUAGE_LABELS: Record<CodingLanguage, string> = {
  python: "Python 3",
  javascript: "JavaScript",
  cpp: "C++17",
  cuda: "CUDA C++",
};
export const executionResultSchema = z.object({
  tests: z.array(
    z.object({ label: z.string(), passed: z.boolean(), error: z.string().nullable() }),
  ),
  output: z.string(),
  error: z.string().nullable(),
});
export type ExecutionResult = z.infer<typeof executionResultSchema>;
export const runtimeCapabilitySchema = z.object({ available: z.boolean(), message: z.string() });
export const nativeCapabilitiesSchema = z.object({
  cpp: runtimeCapabilitySchema,
  cuda: runtimeCapabilitySchema,
});
