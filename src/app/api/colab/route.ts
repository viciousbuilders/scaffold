import { jsonEndpoint } from "@/server/http";
import { colabInputSchema } from "@/core/colab";
import { colabAction } from "@/server/colab/service";
import { loadWorkspace } from "@/server/workspace";
import { AiError } from "@/server/ai/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = jsonEndpoint(
  colabInputSchema,
  async ({ action, code, language, questionId }) => {
    try {
      if (action === "run") {
        const { session } = await loadWorkspace();
        if (!session.questions.some((q) => q.id === questionId && q.lab))
          throw new AiError("GPU runs must belong to a programming lab in this workspace.", 400);
      }
      return await colabAction(action, code, language);
    } catch (error) {
      throw new AiError(error instanceof Error ? error.message : "Colab request failed.", 400);
    }
  },
  true,
);
