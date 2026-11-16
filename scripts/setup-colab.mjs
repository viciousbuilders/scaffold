// Import an already-authorized Desktop OAuth grant; never print credential values.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
const [clientFile, tokenFile] = process.argv.slice(2);
if (!clientFile || !tokenFile) {
  console.error("Usage: node scripts/setup-colab.mjs /private/client.json /private/token.json");
  process.exit(1);
}
const client = JSON.parse(await readFile(resolve(clientFile), "utf8")).installed;
const token = JSON.parse(await readFile(resolve(tokenFile), "utf8"));
if (!client?.client_id || !client.client_secret || !token.refresh_token)
  throw Error("A Desktop OAuth client and Colab-authorized refresh token are required.");
if (
  !String(token.scope || "")
    .split(" ")
    .includes("https://www.googleapis.com/auth/colaboratory")
)
  throw Error("The grant must include the Colab scope.");
const folder = join(
  process.env.SCAFFOLD_DATA_DIR || join(homedir(), "Library", "Application Support", "Scaffold"),
  "colab",
);
await mkdir(folder, { recursive: true, mode: 0o700 });
await writeFile(
  join(folder, "credentials.json"),
  JSON.stringify({
    client_id: client.client_id,
    client_secret: client.client_secret,
    refresh_token: token.refresh_token,
  }),
  { mode: 0o600 },
);
console.log("Colab grant installed in local Application Support. Reopen Scaffold.");
