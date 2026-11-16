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
    "A personal learning workspace for any topic, with projects, practice, notes and review.",
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
