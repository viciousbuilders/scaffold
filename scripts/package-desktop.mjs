import { packager } from "@electron/packager";
import { smokeDesktop } from "./smoke-desktop.mjs";
import { smokeDesktopShell } from "./smoke-desktop-shell.mjs";
await smokeDesktop();
await smokeDesktopShell();
const paths = await packager({
  dir: "desktop-stage",
  name: "Scaffold",
  platform: "darwin",
  arch: process.env.SCAFFOLD_ARCH || process.arch,
  out: "dist",
  overwrite: true,
  icon: "desktop/assets/icon.icns",
  appBundleId: "com.viciousbuilders.scaffold",
  appCategoryType: "public.app-category.education",
  prune: false,
  asar: false,
  ...(process.env.SCAFFOLD_SIGNING_IDENTITY
    ? { osxSign: { identity: process.env.SCAFFOLD_SIGNING_IDENTITY } }
    : {}),
});
console.log(`Local app: ${paths[0]}/Scaffold.app`);
