import { z } from "zod";
import { questionSchema } from "@/core/schemas";
import { jsonEndpoint } from "@/server/http";
import { runNative } from "@/server/execution/native";
import { toolchains } from "@/server/execution/toolchains";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const { cpp, cuda } = await toolchains();
  return Response.json({
    cpp: { available: cpp.available, message: cpp.message },
    cuda: { available: cuda.available, message: cuda.message },
  });
}
export const POST = jsonEndpoint(
  z.object({
    language: z.enum(["cpp", "cuda"]),
    code: z.string().max(16000),
    tests: questionSchema.shape.tests.min(1),
  }),
  ({ language, code, tests }, signal) => runNative(language, code, tests, signal),
  true,
);
