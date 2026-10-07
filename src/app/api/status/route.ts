import { aiStatus } from "@/server/ai/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(await aiStatus());
  } catch {
    return Response.json({ connected: false, message: "Couldn't read AI settings." });
  }
}
