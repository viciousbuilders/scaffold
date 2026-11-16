import { z } from "zod";
import { libraryEntries } from "@/core/source-library";
import { addLearningContent } from "@/server/workspace";
import { jsonEndpoint } from "@/server/http";

export const runtime = "nodejs";
const input = z.object({
  path: z.string().min(1),
  collection: z
    .string()
    .refine(
      (id) =>
        id === "research" || id === "training" || libraryEntries.some((entry) => entry.id === id),
    ),
});
export const POST = jsonEndpoint(
  input,
  ({ path, collection }) => addLearningContent(path, collection),
  true,
);
