import { rm } from "node:fs/promises";
// Remove previous staging before Next traces workspace filesystem operations.
// Keep completed release archives in dist; that directory is excluded by Next.
for (const path of ["server", "desktop-stage", ".next/standalone"]) {
  await rm(path, { recursive: true, force: true });
}
