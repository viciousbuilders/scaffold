import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { releaseColab } = createRequire(import.meta.url)("../desktop/colab-cleanup.cjs");
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "scaffold-close-"));
  await mkdir(join(dir, "colab"));
  await writeFile(
    join(dir, "colab/credentials.json"),
    JSON.stringify({ client_id: "x", client_secret: "x", refresh_token: "x" }),
  );
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it("deletes only the persisted owned runtime and clears its record after confirmation", async () => {
  const file = join(dir, "colab/runtime.json");
  await writeFile(file, JSON.stringify({ runtime: "runtimes/scaffold-own", ready: true }));
  const fetcher = vi.fn(async (url: string) =>
    url.includes("oauth2") ? Response.json({ access_token: "secret" }) : Response.json({}),
  );
  await releaseColab(dir, fetcher);
  expect(fetcher.mock.calls[1][0]).toBe(
    "https://colaboratory.googleapis.com/v1beta/runtimes/scaffold-own",
  );
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
});
it("does nothing without an ownership record and rejects foreign runtime names", async () => {
  const fetcher = vi.fn();
  await releaseColab(dir, fetcher);
  expect(fetcher).not.toHaveBeenCalled();
  await writeFile(
    join(dir, "colab/runtime.json"),
    JSON.stringify({ runtime: "runtimes/another-app" }),
  );
  await expect(releaseColab(dir, fetcher)).rejects.toThrow("ownership");
  expect(fetcher).not.toHaveBeenCalled();
});
it("retains the ownership record when network release fails", async () => {
  const file = join(dir, "colab/runtime.json");
  await writeFile(file, JSON.stringify({ runtime: "runtimes/scaffold-own" }));
  await expect(
    releaseColab(
      dir,
      vi.fn(async () => {
        throw Error("offline");
      }),
    ),
  ).rejects.toThrow("offline");
  expect(JSON.parse(await readFile(file, "utf8")).runtime).toBe("runtimes/scaffold-own");
});
it("clears a confirmed-ready runtime already removed by Colab", async () => {
  const file = join(dir, "colab/runtime.json");
  await writeFile(file, JSON.stringify({ runtime: "runtimes/scaffold-own", ready: true }));
  await releaseColab(
    dir,
    vi.fn(async (url: string) =>
      url.includes("oauth2")
        ? Response.json({ access_token: "x" })
        : new Response("", { status: 404 }),
    ),
  );
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
});
