import { z } from "zod";
import { loadWorkspace, openWorkspace } from "@/server/workspace";
import { jsonEndpoint } from "@/server/http";
import { AiError } from "@/server/ai/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(await loadWorkspace());
  } catch (error) {
    return Response.json(
      { error: error instanceof AiError ? error.message : "Couldn't read the workspace folder." },
      { status: 422 },
    );
  }
}
export const POST = jsonEndpoint(
  z.object({ path: z.string().min(1).max(4096) }),
  ({ path }) => openWorkspace(path),
  true,
);
