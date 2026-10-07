"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, TerminalSquare, CircleAlert, LoaderCircle } from "lucide-react";
import {
  AI_LABELS,
  AI_PROVIDERS,
  AiSettingsSchema,
  AiConfigurationSchema,
  type AiSettings,
  type AiProvider,
} from "@/core/ai-settings";
import { postApi } from "@/ui/api";

export function AiSettingsMenu() {
  const [saved, setSaved] = useState<ReturnType<typeof AiConfigurationSchema.parse> | null>(null);
  const [draft, setDraft] = useState<AiSettings>(AiSettingsSchema.parse({}));
  const [argumentsText, setArgumentsText] = useState("[]");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/ai/settings", { signal: abort.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Couldn't load AI settings.");
        const configuration = AiConfigurationSchema.parse(data);
        setSaved(configuration);
        setDraft(configuration.settings);
        setArgumentsText(JSON.stringify(configuration.settings.profiles.custom.args, null, 2));
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && menu.current) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      abort.abort();
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const provider = draft.provider;
  const profile = draft.profiles[provider];
  function updateProfile(key: "model" | "executable", value: string) {
    setDraft((current) => ({
      ...current,
      profiles: {
        ...current.profiles,
        [provider]: { ...current.profiles[provider], [key]: value },
      },
    }));
  }
  async function save() {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    try {
      const args = JSON.parse(argumentsText);
      const settings = AiSettingsSchema.parse({
        ...draft,
        profiles: { ...draft.profiles, custom: { ...draft.profiles.custom, args } },
      });
      if (settings.provider === "custom" && !settings.profiles.custom.executable)
        throw new Error("Enter your CLI executable first.");
      const result = await postApi("ai/settings", settings, AiConfigurationSchema);
      setSaved(result);
      setDraft(result.settings);
    } catch (err) {
      setError(
        err instanceof Error && !(err.name === "ZodError" || err instanceof SyntaxError)
          ? err.message
          : "Check the fields. Arguments must be a JSON array of strings.",
      );
    } finally {
      setBusy(false);
    }
  }
  const label = saved ? AI_LABELS[saved.settings.provider] : "AI";
  const dirty =
    saved &&
    (JSON.stringify(draft) !== JSON.stringify(saved.settings) ||
      argumentsText !== JSON.stringify(saved.settings.profiles.custom.args, null, 2));
  return (
    <details className="connection ai-settings" ref={menu}>
      <summary
        className="navbar-control ai-provider-button"
        aria-label={`AI settings: ${label}`}
        title={saved?.status.message || "Choose your AI CLI"}
      >
        {loading || busy ? (
          <LoaderCircle className="navbar-control-icon spin" size={16} aria-hidden="true" />
        ) : saved && !saved.status.connected ? (
          <CircleAlert
            className="navbar-control-icon ai-unavailable"
            size={16}
            aria-hidden="true"
          />
        ) : (
          <TerminalSquare
            className={`navbar-control-icon ${saved?.status.connected ? "ai-available" : ""}`}
            size={16}
            aria-hidden="true"
          />
        )}
        <span className="navbar-control-label">{label}</span>
        <ChevronDown className="navbar-control-chevron" size={12} aria-hidden="true" />
      </summary>
      <div className="connection-popover">
        <strong>AI settings</strong>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy || loading}>
            <label htmlFor="ai-provider">Provider</label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(event) =>
                setDraft({ ...draft, provider: event.target.value as AiProvider })
              }
            >
              {AI_PROVIDERS.map((id) => (
                <option key={id} value={id}>
                  {AI_LABELS[id]}
                </option>
              ))}
            </select>
            <label htmlFor="ai-model">
              Model <span>optional</span>
            </label>
            <input
              id="ai-model"
              value={profile.model}
              onChange={(event) => updateProfile("model", event.target.value)}
              placeholder={
                provider === "opencode" ? "provider/model · or CLI default" : "Use CLI default"
              }
              autoComplete="off"
            />
            <details className="ai-advanced" open={provider === "custom" || undefined}>
              <summary>Command settings</summary>
              <label htmlFor="ai-executable">Executable</label>
              <input
                id="ai-executable"
                value={profile.executable}
                onChange={(event) => updateProfile("executable", event.target.value)}
                placeholder={
                  provider === "custom" ? "/absolute/path/to/cli" : `Auto-detect ${provider}`
                }
                autoComplete="off"
                spellCheck={false}
              />
              {provider === "custom" && (
                <>
                  <label htmlFor="ai-arguments">
                    Arguments <span>JSON array</span>
                  </label>
                  <textarea
                    id="ai-arguments"
                    rows={3}
                    value={argumentsText}
                    onChange={(event) => setArgumentsText(event.target.value)}
                    spellCheck={false}
                  />
                  <p className="ai-command-help">
                    The command receives a prompt on stdin and must return JSON on stdout. Arguments
                    can use {"{model}"}, {"{schema}"} and {"{schemaPath}"}.
                  </p>
                </>
              )}
            </details>
          </fieldset>
          <p className="ai-status" role="status">
            {dirty
              ? "Save to use this provider. Sign in through its CLI in Terminal."
              : saved?.status.message || "Choose the CLI you use in Terminal."}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" type="submit" disabled={busy || loading}>
            {busy || loading ? "Checking…" : dirty || !saved ? "Save & check" : "Check connection"}
          </button>
        </form>
      </div>
    </details>
  );
}
