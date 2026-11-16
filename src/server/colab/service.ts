import "server-only";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { dataDirectory } from "@/server/workspace";
import { executionCode, parseSseBlock, type ColabStatus } from "@/core/colab";
class ColabHttpError extends Error {
  constructor(readonly status: number) {
    super(`Colab request failed (${status}). Check account access, quota or reconnect.`);
  }
}
const BASE = "https://colaboratory.googleapis.com";
const folder = () => join(dataDirectory(), "colab");
const authFile = () => join(folder(), "credentials.json");
const stateFile = () => join(folder(), "runtime.json");
const authSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  refresh_token: z.string().min(1),
});
let authCache: { token: string; until: number } | null = null;
let runtime: string | null = null;
let session: string | null = null;
let initialized = false;
let closing = false;
let task: Promise<void> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let state: ColabStatus = {
  configured: false,
  connected: false,
  phase: "idle",
  output: "",
  error: null,
  succeeded: null,
  generation: 0,
};
async function initialize() {
  if (initialized) return;
  try {
    authSchema.parse(JSON.parse(await readFile(authFile(), "utf8")));
    state.configured = true;
  } catch {}
  try {
    const saved = JSON.parse(await readFile(stateFile(), "utf8"));
    if (/^runtimes\/scaffold-[a-z0-9-]+$/.test(saved.runtime)) runtime = saved.runtime;
  } catch {}
  state.connected = !!runtime;
  initialized = true;
}
async function token() {
  if (authCache && authCache.until > Date.now()) return authCache.token;
  const auth = authSchema.parse(JSON.parse(await readFile(authFile(), "utf8")));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ ...auth, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw Error("Colab authorization expired. Reauthorize the local Colab connection.");
  const value = await response.json();
  authCache = { token: value.access_token, until: Date.now() + (value.expires_in - 60) * 1000 };
  return authCache.token;
}
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal:
      state.phase === "connecting" && controller
        ? AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new ColabHttpError(response.status);
  return response.status === 204 ? {} : response.json();
}
async function saveRuntime() {
  await mkdir(folder(), { recursive: true, mode: 0o700 });
  const temp = stateFile() + ".tmp";
  await writeFile(temp, JSON.stringify({ runtime, ready: state.connected }), { mode: 0o600 });
  await rename(temp, stateFile());
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function log(text: string) {
  state.output = (state.output + text).slice(-100000);
}
async function mcp(name: string, args: unknown, signal?: AbortSignal) {
  const response = await fetch(BASE + "/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: signal || AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`Colab execution request failed (${response.status}).`);
  let result: Record<string, unknown> | undefined;
  function event(value: unknown) {
    const e = value as {
      method?: string;
      params?: { message?: string };
      result?: Record<string, unknown>;
      error?: unknown;
    };
    if (e.error) throw Error("Colab returned a protocol error.");
    if (e.method === "notifications/progress" && e.params?.message) log(e.params.message);
    if (e.result) result = e.result;
  }
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done }).replace(/\r\n/g, "\n");
      let index;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const e = parseSseBlock(block);
        if (e) event(e);
      }
      if (chunk.done) break;
    }
    if (buffer.trim()) {
      const e = parseSseBlock(buffer);
      if (e) event(e);
    }
  } else event(await response.json());
  if (!result || result.isError) throw Error("Colab did not return a successful tool response.");
  let structured = result.structuredContent as Record<string, unknown> | undefined;
  if (!structured) {
    const content = result.content as { text?: string }[] | undefined;
    const text = content?.find((c) => c.text)?.text;
    if (text)
      try {
        structured = JSON.parse(text);
      } catch {}
  }
  return structured || {};
}
async function connect() {
  const subscription = await api("/v1beta/subscription");
  if (subscription.tier !== "SUBSCRIPTION_TIER_FREE")
    throw Error(
      "This connector is configured for free-tier access only; paid-tier compute is not enabled.",
    );
  if (runtime) {
    try {
      await api("/v1beta/" + runtime);
      state.connected = true;
      log("Reconnected to Scaffold's T4 runtime.\n");
      return;
    } catch (error) {
      if (!(error instanceof ColabHttpError && error.status === 404)) throw error;
      runtime = null;
      state.connected = false;
    }
  }
  const specs = await api("/v1beta/runtimespecs");
  const eligible = specs.runtimeSpecs?.some(
    (s: { eligible?: boolean; key: { variant: string; accelerator: string; shape: string } }) =>
      s.eligible &&
      s.key.variant === "VARIANT_GPU" &&
      s.key.accelerator === "T4" &&
      s.key.shape === "SHAPE_STANDARD",
  );
  if (!eligible) throw Error("A free standard T4 is not currently eligible for this account.");
  runtime = "runtimes/scaffold-" + crypto.randomUUID().replaceAll("-", "").slice(0, 18);
  await saveRuntime();
  if (closing || controller?.signal.aborted) {
    runtime = null;
    await unlink(stateFile()).catch(() => {});
    return;
  }
  log("Provisioning a free T4 GPU…\n");
  let operation;
  try {
    operation = await api(
      `/v1beta/runtimes?runtimeId=${runtime.slice(9)}&requestId=${crypto.randomUUID()}`,
      "POST",
      { runtimeSpec: { variant: "VARIANT_GPU", accelerator: "T4", shape: "SHAPE_STANDARD" } },
    );
  } catch (error) {
    // A definitive rejected creation allocated nothing; retain uncertain requests
    // for cleanup instead of losing their ownership record.
    if (error instanceof ColabHttpError && [400, 401, 403, 429].includes(error.status)) {
      runtime = null;
      await unlink(stateFile()).catch(() => {});
    }
    throw error;
  }
  const deadline = Date.now() + 300000;
  while (!operation.done && Date.now() < deadline) {
    await pause(2000);
    operation = await api("/v1/" + operation.name);
  }
  if (operation.done && operation.error) {
    runtime = null;
    await unlink(stateFile()).catch(() => {});
    throw Error("Colab refused the GPU allocation. Retry later.");
  }
  if (!operation.done)
    throw Error(
      "Colab could not allocate the T4. Disconnect to release the pending runtime, then retry later.",
    );
  state.connected = true;
  await saveRuntime();
  log("T4 connected. GPU time continues until you disconnect.\n");
}
async function run(code: string, language: "python" | "cuda") {
  if (!runtime || !state.connected) throw Error("Connect a Colab GPU first.");
  const sessionId = "scaffold-" + crypto.randomUUID().replaceAll("-", "").slice(0, 18);
  session = runtime + "/sessions/" + sessionId;
  try {
    await mcp("create_session", { parent: runtime, sessionId });
    const response = await mcp(
      "execute_code",
      { session, executionId: crypto.randomUUID(), code: executionCode(code, language) },
      controller!.signal,
    );
    if (response.executionError) {
      const error = response.executionError as {
        name: string;
        value: string;
        traceback?: string[];
      };
      throw Error((error.traceback?.join("\n") || `${error.name}: ${error.value}`).slice(-10000));
    }
    if (!state.output && response.stdout) log(String(response.stdout));
    if (response.stderr) log(String(response.stderr));
    if (response.result) log(String(response.result) + "\n");
    state.succeeded = true;
  } finally {
    const previous = session;
    session = null;
    if (previous)
      await mcp("delete_session", { name: previous }).catch(() => {
        log("Kernel cleanup failed; disconnect to release the runtime.\n");
      });
  }
}
function background(phase: "connecting" | "running", work: () => Promise<void>) {
  if (state.phase !== "idle") throw Error("A Colab operation is already active.");
  state = {
    ...state,
    phase,
    output: "",
    error: null,
    succeeded: null,
    generation: state.generation + 1,
  };
  controller = new AbortController();
  if (idleTimer) clearTimeout(idleTimer);
  task = work()
    .catch((error) => {
      state.error = error instanceof Error ? error.message : "Colab operation failed.";
      state.succeeded = false;
    })
    .finally(() => {
      state.phase = "idle";
      controller = null;
      if (runtime && !closing) {
        idleTimer = setTimeout(
          () => {
            void colabAction("disconnect").catch(() => {
              state.error = "Automatic GPU release failed. Use Release GPU to retry.";
            });
          },
          5 * 60 * 1000,
        );
        idleTimer.unref?.();
      }
    });
}
export async function colabAction(
  action: string,
  code?: string,
  language: "python" | "cuda" = "python",
) {
  await initialize();
  if (action === "shutdown") {
    closing = true;
    if (idleTimer) clearTimeout(idleTimer);
    controller?.abort();
    if (session) await mcp("delete_session", { name: session }).catch(() => {});
    await task;
    return { ...state };
  }
  if (closing && action !== "status") throw Error("Scaffold is closing; GPU work has stopped.");
  if (action === "connect") background("connecting", connect);
  if (action === "run") {
    if (!code?.trim()) throw Error("Write some code first.");
    background(state.connected ? "running" : "connecting", async () => {
      if (!state.connected) await connect();
      if (closing) return;
      state.phase = "running";
      await run(code, language);
    });
  }
  if (action === "stop") {
    if (state.phase !== "running") throw Error("No code execution is running.");
    state.phase = "stopping";
    controller?.abort();
    if (session) await mcp("delete_session", { name: session }).catch(() => {});
  }
  if (action === "disconnect") {
    if (state.phase !== "idle")
      throw Error("Stop or wait for the current operation before disconnecting.");
    if (idleTimer) clearTimeout(idleTimer);
    if (runtime) {
      try {
        await api("/v1beta/" + runtime, "DELETE");
      } catch (error) {
        if (!(error instanceof ColabHttpError && error.status === 404)) throw error;
      }
      runtime = null;
      session = null;
      await unlink(stateFile()).catch(() => {});
    }
    state.connected = false;
    state.error = null;
    log("GPU runtime released.\n");
  }
  return { ...state };
}
