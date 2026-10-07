import { packager } from "@electron/packager";
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
