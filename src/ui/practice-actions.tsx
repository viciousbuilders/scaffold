"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
const ActionsContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
}>({ target: null, setTarget: () => {} });
export function PracticeActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <ActionsContext.Provider value={{ target, setTarget }}>{children}</ActionsContext.Provider>
  );
}
export function PracticeActionsSlot() {
  const { setTarget } = useContext(ActionsContext);
  return <div className="header-practice-actions" ref={setTarget} />;
}
export function PracticeActions({ children }: { children: ReactNode }) {
  const { target } = useContext(ActionsContext);
  return target ? createPortal(children, target) : null;
}
