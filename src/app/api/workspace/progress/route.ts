import { z } from "zod";
import { progressSchema } from "@/core/session";
import { saveProgress } from "@/server/workspace";
import { jsonEndpoint } from "@/server/http";
export const runtime = "nodejs";
export const POST = jsonEndpoint(
  z.object({ path: z.string(), session: progressSchema }),
  async ({ path, session }) => {
    await saveProgress(path, session);
    return { saved: true };
  },
  true,
);
