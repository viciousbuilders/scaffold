import { z } from "zod";
export const pythonToolsInput = z.object({
  action: z.enum(["lint", "format"]),
  code: z.string().max(100_000),
});
export const pythonToolsResult = z.object({
  code: z.string(),
  diagnostics: z.array(
    z.object({
      from: z.number().int().nonnegative(),
      to: z.number().int().nonnegative(),
      severity: z.enum(["error", "warning"]),
      message: z.string(),
      source: z.string(),
    }),
  ),
});
export type PythonToolsResult = z.infer<typeof pythonToolsResult>;
