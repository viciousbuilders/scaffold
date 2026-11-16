import { jsonEndpoint } from "@/server/http";
import { pythonToolsInput } from "@/core/python-tools";
import { pythonTools } from "@/server/python-tools";
import { AiError } from "@/server/ai/service";
export const runtime = "nodejs";
export const POST = jsonEndpoint(
  pythonToolsInput,
  async ({ action, code }) => {
    try {
      return pythonTools(action, code);
    } catch {
      throw new AiError("Fix Python syntax errors before formatting.", 400);
    }
  },
  true,
);
