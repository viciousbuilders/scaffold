import "server-only";
import { z } from "zod";
import { AiError } from "./ai/service";

const windows = new Map<string, { count: number; until: number }>();

export function jsonEndpoint<T>(
  schema: z.ZodType<T>,
  handler: (data: T, signal: AbortSignal) => Promise<unknown>,
  localStorage = false,
) {
  return async (request: Request) => {
    try {
      const origin = request.headers.get("origin");
      const requestUrl = new URL(request.url);
      // Next can normalize its internal URL to localhost. Use the actual host
      // so same-origin requests through 127.0.0.1 also work.
      const host = new URL(`http://${request.headers.get("host") || requestUrl.host}`).hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
        return Response.json({ error: "Scaffold only accepts local requests." }, { status: 403 });
      const requestOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
      if (origin && origin !== requestOrigin)
        return Response.json({ error: "Requests must come from this app." }, { status: 403 });
      const now = Date.now();
      for (const [key, entry] of windows) if (entry.until <= now) windows.delete(key);
      const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
      const entry = windows.get(key) || { count: 0, until: now + 60_000 };
      if (!localStorage) {
        entry.count++;
        windows.set(key, entry);
      }
      if (!localStorage && entry.count > 20)
        return Response.json(
          { error: "Give the AI a moment. Please try again in a minute." },
          { status: 429 },
        );
      const body = await request.text();
      if (body.length > (localStorage ? 5_000_000 : 100_000))
        return Response.json({ error: "That request is too large." }, { status: 413 });
      const data = schema.parse(JSON.parse(body));
      return Response.json(await handler(data, request.signal));
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return Response.json(
          { error: "Some information is missing or invalid. Please try again." },
          { status: 400 },
        );
      if (error instanceof AiError)
        return Response.json({ error: error.message }, { status: error.status });
      return Response.json(
        { error: "Something went wrong. Your work is saved; please try again." },
        { status: 500 },
      );
    }
  };
}
