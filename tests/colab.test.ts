import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executionCode, parseSseBlock } from "@/core/colab";
let folder: string;
beforeEach(async () => {
  vi.resetModules();
  folder = await mkdtemp(join(tmpdir(), "scaffold-colab-"));
  vi.stubEnv("SCAFFOLD_DATA_DIR", folder);
  await mkdir(join(folder, "colab"));
  await writeFile(
    join(folder, "colab/credentials.json"),
    JSON.stringify({ client_id: "test", client_secret: "test", refresh_token: "test" }),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});
async function idle(action: (a: string) => Promise<{ phase: string }>) {
  for (let i = 0; i < 100; i++) {
    const value = await action("status");
    if (value.phase === "idle") return value;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw Error("operation stayed busy");
}
it("parses SSE multiline payloads and wraps CUDA source as data", () => {
  expect(parseSseBlock('event: message\ndata: {"ok":\ndata: true}')).toEqual({ ok: true });
  expect(parseSseBlock(": heartbeat")).toBeNull();
  expect(executionCode("print(1)", "python")).toBe("print(1)");
  expect(executionCode("int main() { return 0; }", "cuda")).toContain("subprocess.run(['nvcc'");
});
it("connects only a free eligible T4, streams execution, cleans kernels and releases its runtime", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = String(input),
        body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      calls.push({ url, body });
      if (url.includes("oauth2"))
        return Response.json({ access_token: "private-token", expires_in: 3600 });
      if (url.endsWith("/subscription")) return Response.json({ tier: "SUBSCRIPTION_TIER_FREE" });
      if (url.endsWith("/runtimespecs"))
        return Response.json({
          runtimeSpecs: [
            {
              eligible: true,
              key: { variant: "VARIANT_GPU", accelerator: "T4", shape: "SHAPE_STANDARD" },
            },
          ],
        });
      if (url.includes("/mcp")) {
        const params = body.params as { name: string; arguments: Record<string, unknown> };
        if (params.name === "create_session") {
          expect(params.arguments.parent).toMatch(/^runtimes\/scaffold-/);
          return Response.json({ result: { structuredContent: {} } });
        }
        if (params.name === "delete_session")
          return Response.json({ result: { structuredContent: {} } });
        return new Response(
          "data: " +
            JSON.stringify({
              method: "notifications/progress",
              params: { message: "GPU output\n" },
            }) +
            "\n\ndata: " +
            JSON.stringify({ result: { structuredContent: { stdout: "GPU output\n" } } }) +
            "\n\n",
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      return Response.json({ done: true });
    }),
  );
  const { colabAction } = await import("@/server/colab/service");
  await colabAction("connect");
  expect(await idle(colabAction)).toMatchObject({ connected: true, error: null });
  await colabAction("run", "print(1)", "python");
  expect(await idle(colabAction)).toMatchObject({ output: "GPU output\n", succeeded: true });
  expect(JSON.stringify(calls.filter((c) => c.url.includes("/mcp")))).toContain("delete_session");
  expect(JSON.stringify(await colabAction("status"))).not.toContain("private-token");
  expect(await colabAction("disconnect")).toMatchObject({ connected: false });
});
it("does not allocate paid-tier compute", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        String(url).includes("oauth2")
          ? { access_token: "private", expires_in: 3600 }
          : { tier: "SUBSCRIPTION_TIER_PRO" },
      ),
    ),
  );
  const { colabAction } = await import("@/server/colab/service");
  await colabAction("connect");
  const result = await idle(colabAction);
  expect(result).toHaveProperty("connected", false);
  expect(JSON.stringify(result)).toContain("free-tier access only");
  expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
});
it("shutdown prevents new work even if the renderer calls Run again", async () => {
  const { colabAction } = await import("@/server/colab/service");
  await colabAction("shutdown");
  await expect(colabAction("run", "print(1)")).rejects.toThrow("closing");
  expect(await colabAction("status")).toHaveProperty("phase", "idle");
});
it("idle releases an owned GPU without resetting its timer on status polling", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("oauth2"))
          return Response.json({ access_token: "x", expires_in: 3600 });
        if (String(url).endsWith("/subscription"))
          return Response.json({ tier: "SUBSCRIPTION_TIER_FREE" });
        if (String(url).endsWith("/runtimespecs"))
          return Response.json({
            runtimeSpecs: [
              {
                eligible: true,
                key: { variant: "VARIANT_GPU", accelerator: "T4", shape: "SHAPE_STANDARD" },
              },
            ],
          });
        return Response.json({ done: true });
      }),
    );
    const { colabAction } = await import("@/server/colab/service");
    await colabAction("connect");
    // Wait for the async ownership write and idle-timer installation, not just
    // the earlier connected flag. Disk I/O can settle later on CI runners.
    await vi.waitFor(async () => {
      expect(await colabAction("status")).toMatchObject({ phase: "idle", connected: true });
    });
    await vi.advanceTimersByTimeAsync(300001);
    await vi.waitFor(async () => {
      expect(await colabAction("status")).toHaveProperty("connected", false);
    });
    expect(vi.mocked(fetch).mock.calls.some(([, opts]) => opts?.method === "DELETE")).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
