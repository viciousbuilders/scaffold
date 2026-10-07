import { sessionSchema } from "@/core/session";
import { importLegacy } from "@/server/workspace";
import { jsonEndpoint } from "@/server/http";
export const runtime = "nodejs";
export const POST = jsonEndpoint(sessionSchema, importLegacy, true);
