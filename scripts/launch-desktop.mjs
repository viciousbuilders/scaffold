import electron from "electron";
import { spawn } from "node:child_process";
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["desktop/main.cjs", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
