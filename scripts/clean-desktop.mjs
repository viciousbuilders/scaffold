import { rm } from "node:fs/promises";
// Clear generated artifacts before Next traces workspace filesystem operations.
for (const path of ["server", "desktop-stage", "dist", ".next/standalone"]) {
  await rm(path, { recursive: true, force: true });
}
