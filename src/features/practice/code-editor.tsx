"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { LANGUAGE_LABELS, type CodingLanguage } from "@/core/execution";
import { useMemo } from "react";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
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
  const languageExtensions = useMemo(
    () => [
      language === "python" ? python() : language === "javascript" ? javascript() : cpp(),
      indentUnit.of(language === "javascript" ? "  " : "    "),
      EditorState.tabSize.of(language === "javascript" ? 2 : 4),
      ...extensions,
    ],
    [language],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={languageExtensions}
      theme={theme}
      readOnly={readOnly}
      minHeight="290px"
      height="100%"
      aria-label={`${LANGUAGE_LABELS[language]} code editor`}
      basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: true }}
    />
  );
}
