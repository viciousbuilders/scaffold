import "server-only";
import { join } from "node:path";
import type { AiProvider, CliProfile } from "@/core/ai-settings";

export function cliRequest(
  provider: AiProvider,
  profile: CliProfile,
  directory: string,
  schema: string,
) {
  const model = profile.model ? ["--model", profile.model] : [];
  const schemaPath = join(directory, "response.schema.json");
  const resultPath = join(directory, "response.json");
  switch (provider) {
    case "codex":
      return {
        args: [
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "-c",
          'approval_policy="never"',
          "--cd",
          directory,
          "--color",
          "never",
          "--json",
          "--output-schema",
          schemaPath,
          "--output-last-message",
          resultPath,
          ...model,
          "-",
        ],
        env: {},
        resultPath,
      };
    case "claude":
      return {
        args: [
          "--print",
          "--output-format",
          "json",
          "--json-schema",
          schema,
          "--no-session-persistence",
          "--tools",
          "",
          "--strict-mcp-config",
          "--mcp-config",
          '{"mcpServers":{}}',
          "--disable-slash-commands",
          "--settings",
          '{"disableAllHooks":true}',
          ...model,
        ],
        env: {},
      };
    case "opencode":
      return {
        args: ["run", "--format", "json", "--agent", "scaffold-tutor", ...model],
        env: {
          OPENCODE_CONFIG_CONTENT: JSON.stringify({
            autoupdate: false,
            share: "disabled",
            permission: "deny",
            agent: {
              "scaffold-tutor": {
                description: "Scaffold tutor",
                mode: "primary",
                permission: "deny",
                tools: { "*": false },
              },
            },
          }),
        },
      };
    case "pi":
      return {
        args: [
          "--print",
          "--mode",
          "text",
          "--no-session",
          "--no-tools",
          "--no-extensions",
          "--no-skills",
          "--no-prompt-templates",
          "--no-context-files",
          ...model,
        ],
        env: {},
      };
    case "custom":
      return {
        // Arguments are passed directly, never interpreted by a shell. Prompts use stdin.
        args: profile.args.map((arg) =>
          arg
            .replaceAll("{model}", profile.model)
            .replaceAll("{schemaPath}", schemaPath)
            .replaceAll("{schema}", schema),
        ),
        env: {},
      };
  }
}

export function parseJsonReply(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return JSON.parse(fence ? fence[1] : trimmed);
}
export function cliReply(provider: AiProvider, stdout: string): unknown {
  if (provider === "claude") {
    const result = JSON.parse(stdout);
    if (result.is_error || (result.subtype && result.subtype !== "success"))
      throw new Error("CLI reported failure");
    return result.structured_output ?? parseJsonReply(result.result);
  }
  if (provider === "opencode") {
    const events = stdout
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    if (events.some((event) => event.type === "error")) throw new Error("CLI reported failure");
    const text = events
      .filter((event) => event.type === "text" && typeof event.part?.text === "string")
      .map((event) => event.part.text)
      .join("\n");
    return parseJsonReply(text);
  }
  return parseJsonReply(stdout);
}
