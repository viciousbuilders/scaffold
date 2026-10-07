import type { z } from "zod";

export async function postApi<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Couldn't finish that request. Please try again.",
    );
  return schema.parse(data);
}
