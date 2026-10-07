"use client";

import { ArrowUp, LoaderCircle } from "lucide-react";
import { useId } from "react";

export function Composer({
  value,
  onChange,
  onSend,
  busy,
  placeholder,
  label,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  placeholder: string;
  label: string;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <form
      className={`composer ${compact ? "compact" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && !busy) onSend();
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        maxLength={6000}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (value.trim() && !busy) onSend();
          }
        }}
      />
      <div className="composer-bottom">
        {!compact && <span>Enter to send · Shift + Enter for a new line</span>}
        <button
          type="submit"
          className="icon-button send-button"
          aria-label={busy ? "Waiting for AI" : "Send message"}
          disabled={busy || !value.trim()}
        >
          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={18} />}
        </button>
      </div>
    </form>
  );
}
