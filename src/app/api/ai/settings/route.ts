import { AiSettingsSchema } from "@/core/ai-settings";
import { readAiSettings, saveAiSettings } from "@/server/ai/settings";
import { aiStatus } from "@/server/ai/service";
import { jsonEndpoint } from "@/server/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    const settings = await readAiSettings();
    return Response.json({ settings, status: await aiStatus(settings) });
  } catch {
    return Response.json(
      { error: "Couldn't read AI settings. Check ai.json in Scaffold's application data folder." },
      { status: 503 },
    );
  }
}
export const POST = jsonEndpoint(
  AiSettingsSchema,
  async (input) => {
    const settings = await saveAiSettings(input);
    return { settings, status: await aiStatus(settings) };
  },
  true,
);
