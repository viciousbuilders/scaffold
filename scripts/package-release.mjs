import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { smokeDesktop } from "./smoke-desktop.mjs";

const identity = process.env.SCAFFOLD_SIGNING_IDENTITY;
const profile = process.env.SCAFFOLD_NOTARY_PROFILE;
if (process.platform !== "darwin" || !identity || !profile) {
  throw new Error(
    "Mac releases require SCAFFOLD_SIGNING_IDENTITY and SCAFFOLD_NOTARY_PROFILE (a stored notarytool keychain profile).",
  );
}
const run = (command, args) => execFileSync(command, args, { stdio: "inherit" });
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const arch = process.env.SCAFFOLD_ARCH || process.arch;
if (!/^[\d.]+$/.test(version) || !["arm64", "x64"].includes(arch)) {
  throw new Error("Unsupported release version or architecture.");
}
run("npm", ["run", "desktop:package"]);
const bundle = resolve(`dist/Scaffold-darwin-${arch}/Scaffold.app`);
const output = resolve(`dist/release-${version}-${arch}`);
const staging = resolve(`dist/dmg-stage-${version}-${arch}`);
await rm(output, { recursive: true, force: true });
await rm(staging, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(staging, { recursive: true });
run("codesign", ["--verify", "--deep", "--strict", bundle]);
await smokeDesktop(bundle);
run("ditto", [bundle, `${staging}/Scaffold.app`]);
run("ln", ["-s", "/Applications", `${staging}/Applications`]);
await cp("docs/START-HERE.txt", `${staging}/START-HERE.txt`);
await cp("LICENSE", `${staging}/LICENSE.txt`);
await cp("docs/START-HERE.txt", `${output}/START-HERE.txt`);
await cp("LICENSE", `${output}/LICENSE.txt`);
const base = `Scaffold-${version}-${arch}`;
const dmg = `${output}/${base}.dmg`;
const zip = `${output}/${base}.zip`;
run("hdiutil", [
  "create",
  "-volname",
  "Scaffold",
  "-srcfolder",
  staging,
  "-ov",
  "-format",
  "UDZO",
  dmg,
]);
run("codesign", ["--sign", identity, "--timestamp", dmg]);
console.log("Submitting the signed disk image to Apple…");
const response = execFileSync(
  "xcrun",
  ["notarytool", "submit", dmg, "--keychain-profile", profile, "--wait", "--output-format", "json"],
  { encoding: "utf8", maxBuffer: 1024 * 1024 },
);
await writeFile(`${output}/notarization.json`, response);
const notarization = JSON.parse(response);
if (notarization.status !== "Accepted") {
  throw new Error(
    `Apple rejected the release: ${notarization.id} (${notarization.status}). Retrieve its notarytool log before publishing.`,
  );
}
run("xcrun", ["stapler", "staple", bundle]);
run("xcrun", ["stapler", "staple", dmg]);
run("xcrun", ["stapler", "validate", bundle]);
run("xcrun", ["stapler", "validate", dmg]);
run("codesign", ["--verify", "--deep", "--strict", bundle]);
run("spctl", ["--assess", "--type", "execute", "--verbose=2", bundle]);
run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", bundle, zip]);
const checksums = [];
for (const file of [`${base}.dmg`, `${base}.zip`, "START-HERE.txt", "LICENSE.txt"]) {
  const digest = createHash("sha256")
    .update(await readFile(`${output}/${file}`))
    .digest("hex");
  checksums.push(`${digest}  ${file}`);
}
await writeFile(`${output}/SHA256SUMS.txt`, `${checksums.join("\n")}\n`);
await rm(staging, { recursive: true, force: true });
console.log(`Signed, notarized release ready: ${output}`);
