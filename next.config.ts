import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  // Workspaces live outside the source tree; old builds and local credentials
  // must never become dependencies of the packaged server.
  outputFileTracingExcludes: {
    "/*": [
      "./dist/**/*",
      "./desktop-stage/**/*",
      "./server/**/*",
      "./.git/**/*",
      "./.env*",
      "./.next/standalone/**/*",
    ],
  },
};
export default nextConfig;
