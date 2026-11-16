const { readFile, unlink } = require("node:fs/promises");
const { join } = require("node:path");
// Independent of the renderer and local server, including after a server crash.
async function releaseColab(dataDir, request = fetch) {
  const folder = join(dataDir, "colab"),
    file = join(folder, "runtime.json");
  let saved;
  try {
    saved = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return;
    throw e;
  }
  if (!/^runtimes\/scaffold-[a-z0-9-]+$/.test(saved.runtime))
    throw Error("Unrecognized GPU ownership record.");
  const auth = JSON.parse(await readFile(join(folder, "credentials.json"), "utf8"));
  const refresh = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ ...auth, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!refresh.ok) throw Error("Google authorization must be renewed to release the GPU.");
  const { access_token } = await refresh.json();
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await request("https://colaboratory.googleapis.com/v1beta/" + saved.runtime, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok || (response.status === 404 && saved.ready !== false)) {
      await unlink(file).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      return;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error(
    "GPU release could not be confirmed. Keep Scaffold open and retry; its ownership record is retained.",
  );
}
module.exports = { releaseColab };
