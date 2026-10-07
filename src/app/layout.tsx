import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WorkspaceBoundary } from "@/features/workspace/workspace-boundary";
import { PracticeActionsProvider } from "@/ui/practice-actions";
import { Header } from "@/ui/header";
import "katex/dist/katex.min.css";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Scaffold · Vicious Builders",
  applicationName: "Scaffold",
  description:
    "Your personal practice workspace for coding, quant questions and quizzes created with Codex.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <WorkspaceBoundary>
          <PracticeActionsProvider>
            <Header />
            {children}
          </PracticeActionsProvider>
        </WorkspaceBoundary>
      </body>
    </html>
  );
}
