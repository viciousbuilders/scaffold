import sharp from "sharp";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const symbol = await readFile("public/scaffold-mark.svg", "utf8");
const path = symbol.match(/<path[^>]*\/>/)[0].replace('stroke="currentColor"', 'stroke="#e58e5f"');
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="64" y="64" width="896" height="896" rx="200" fill="#1c1815"/><g transform="translate(192 192) scale(16)">${path}</g></svg>`;
await mkdir("desktop/assets", { recursive: true });
await writeFile("desktop/assets/icon.svg", icon);
await sharp(Buffer.from(icon)).png().toFile("desktop/assets/icon.png");
const directory = "desktop/assets/icon.iconset";
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    await sharp(Buffer.from(icon))
      .resize(size * scale)
      .png()
      .toFile(`${directory}/icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`);
  }
}
execFileSync("iconutil", ["-c", "icns", directory, "-o", "desktop/assets/icon.icns"]);
await rm(directory, { recursive: true, force: true });
console.log("Scaffold icon: SVG, PNG, and macOS ICNS.");
