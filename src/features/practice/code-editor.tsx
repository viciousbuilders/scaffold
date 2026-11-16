"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { LANGUAGE_LABELS, type CodingLanguage } from "@/core/execution";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { linter, lintGutter, openLintPanel } from "@codemirror/lint";
import { postApi } from "@/ui/api";
import { pythonToolsResult } from "@/core/python-tools";
import { tags } from "@lezer/highlight";

const extensions = [
  EditorView.lineWrapping,
  Prec.highest(
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: tags.keyword, color: "var(--code-keyword)" },
        { tag: tags.comment, color: "var(--muted)", fontStyle: "italic" },
        { tag: [tags.string, tags.docString], color: "var(--code-string)" },
        { tag: [tags.number, tags.bool, tags.null], color: "var(--code-number)" },
        { tag: tags.function(tags.variableName), color: "var(--code-function)" },
      ]),
    ),
  ),
  Prec.highest(
    EditorView.theme({
      "&": {
        fontSize: "13.5px",
        backgroundColor: "var(--editor-background)",
        color: "var(--foreground)",
      },
      ".cm-content": {
        fontFamily: "var(--font-mono), monospace",
        padding: "14px 0",
        minHeight: "260px",
      },
      ".cm-gutters": {
        backgroundColor: "var(--editor-background)",
        border: "none",
        color: "var(--muted)",
        paddingRight: "16px",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono), monospace",
        lineHeight: "1.8",
        backgroundColor: "var(--editor-background)",
      },
      ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--surface-hover)" },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor": { borderLeftColor: "var(--accent)" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "var(--accent-soft)",
      },
    }),
  ),
];

export default function CodeEditor({
  value,
  onChange,
  theme,
  readOnly,
  language,
}: {
  value: string;
  onChange: (value: string) => void;
  theme: "light" | "dark";
  readOnly: boolean;
  language: CodingLanguage;
}) {
  const editor = useRef<EditorView | null>(null);
  useEffect(
    () => () => {
      editor.current = null;
    },
    [],
  );
  const [formatting, setFormatting] = useState(false);
  const [message, setMessage] = useState("");
  const format = useCallback(async (view: EditorView) => {
    if (view.state.readOnly) return;
    const original = view.state.doc.toString();
    setFormatting(true);
    setMessage("");
    try {
      const result = await postApi(
        "python-tools",
        { action: "format", code: original },
        pythonToolsResult,
      );
      // Never overwrite typing or a different question opened during the request.
      if (editor.current !== view || view.state.doc.toString() !== original || view.state.readOnly)
        return;
      if (result.code !== original)
        view.dispatch({
          changes: { from: 0, to: original.length, insert: result.code },
          userEvent: "input.format",
        });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Formatting unavailable.");
    } finally {
      setFormatting(false);
    }
  }, []);

  const languageExtensions = useMemo(
    () => [
      language === "python" ? python() : language === "javascript" ? javascript() : cpp(),
      indentUnit.of(language === "javascript" ? "  " : "    "),
      EditorState.tabSize.of(language === "javascript" ? 2 : 4),
      // CodeMirror stores these handlers; they access the editor only on a keypress.
      // eslint-disable-next-line react-hooks/refs
      keymap.of([
        indentWithTab,
        ...(language === "python"
          ? [
              {
                key: "Mod-Shift-f",
                run: (view: EditorView) => {
                  void format(view);
                  return true;
                },
              },
              { key: "Mod-Shift-m", run: openLintPanel },
            ]
          : []),
      ]),
      ...(language === "python"
        ? [
            lintGutter(),
            linter(
              async (view) => {
                const code = view.state.doc.toString();
                try {
                  const result = await postApi(
                    "python-tools",
                    { action: "lint", code },
                    pythonToolsResult,
                  );
                  if (view.state.doc.toString() !== code) return [];
                  return result.diagnostics;
                } catch {
                  return [
                    {
                      from: 0,
                      to: 0,
                      severity: "info" as const,
                      message: "Python diagnostics unavailable. Edit to retry.",
                    },
                  ];
                }
              },
              { delay: 650 },
            ),
          ]
        : []),
      ...extensions,
    ],
    [language, format],
  );
  return (
    <div className="code-workspace">
      {language === "python" && (
        <div className="code-toolbar">
          <span>
            Python <span className="code-tool-label">· Ruff</span>
          </span>
          <div>
            <button
              type="button"
              className="text-button"
              onClick={() => editor.current && openLintPanel(editor.current)}
            >
              Problems
            </button>
            <button
              type="button"
              className="text-button"
              title="Format Python (⌘/Ctrl Shift F)"
              disabled={readOnly || formatting}
              onClick={() => editor.current && void format(editor.current)}
            >
              {formatting ? "Formatting…" : "Format"}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="code-tool-error" role="status">
          {message}
        </p>
      )}
      <CodeMirror
        className="code-mirror-panel"
        onCreateEditor={(view) => {
          editor.current = view;
        }}
        value={value}
        onChange={onChange}
        extensions={languageExtensions}
        theme={theme}
        readOnly={readOnly}
        minHeight="290px"
        height="100%"
        aria-label={`${LANGUAGE_LABELS[language]} code editor`}
        basicSetup={{
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightSelectionMatches: true,
        }}
      />
    </div>
  );
}
