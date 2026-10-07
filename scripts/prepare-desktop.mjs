import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("package.json", "utf8"));
await rm("server", { recursive: true, force: true });
await cp(".next/standalone", "server", {
  recursive: true,
  filter: (source) => !/\/\.env(?:\.|$)/.test(source),
});
await cp("public", "server/public", { recursive: true });
await mkdir("server/.next", { recursive: true });
await cp(".next/static", "server/.next/static", { recursive: true });
await rm("desktop-stage", { recursive: true, force: true });
await mkdir("desktop-stage", { recursive: true });
await cp("server", "desktop-stage/server", { recursive: true });
await cp("desktop", "desktop-stage/desktop", { recursive: true });
await writeFile(
  "desktop-stage/package.json",
  JSON.stringify({
    name: "scaffold",
    productName: "Scaffold",
    version: manifest.version,
    description: manifest.description,
    license: manifest.license,
    main: "desktop/main.cjs",
  }),
);
