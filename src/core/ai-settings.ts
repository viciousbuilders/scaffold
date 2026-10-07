import { z } from "zod";

export const AI_PROVIDERS = ["codex", "claude", "opencode", "pi", "custom"] as const;
export const AI_LABELS = {
  codex: "Codex",
  claude: "Claude Code",
  opencode: "OpenCode",
  pi: "Pi",
  custom: "Custom CLI",
};
const text = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => !value.includes("\0"));
export const CliProfileSchema = z.object({
  executable: text.default(""),
  model: text.default(""),
  args: z
    .array(
      z
        .string()
        .max(4000)
        .refine((value) => !value.includes("\0")),
    )
    .max(64)
    .default([]),
});
export const AiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS).default("codex"),
  profiles: z
    .object({
      codex: CliProfileSchema.default({ executable: "", model: "", args: [] }),
      claude: CliProfileSchema.default({ executable: "", model: "", args: [] }),
      opencode: CliProfileSchema.default({ executable: "", model: "", args: [] }),
      pi: CliProfileSchema.default({ executable: "", model: "", args: [] }),
      custom: CliProfileSchema.default({ executable: "", model: "", args: [] }),
    })
    .default({
      codex: { executable: "", model: "", args: [] },
      claude: { executable: "", model: "", args: [] },
      opencode: { executable: "", model: "", args: [] },
      pi: { executable: "", model: "", args: [] },
      custom: { executable: "", model: "", args: [] },
    }),
});
export type AiProvider = (typeof AI_PROVIDERS)[number];
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type CliProfile = z.infer<typeof CliProfileSchema>;
export const AiStatusSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  connected: z.boolean(),
  authentication: z.enum(["verified", "unchecked", "unavailable"]),
  message: z.string(),
});
export const AiConfigurationSchema = z.object({
  settings: AiSettingsSchema,
  status: AiStatusSchema,
});
