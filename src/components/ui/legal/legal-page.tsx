import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export const LegalPage = ({ title, lastUpdated, children }: LegalPageProps) => (
  <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
    <header className="mb-10">
      <Link href="/" className="inline-flex items-center gap-2">
        <div className={cn(buttonVariants({ variant: "ghost" }), "w-9 px-0")}>
          <Icons.refactor_logo className="h-7 w-7" />
          <span className="sr-only">Refactor</span>
        </div>
        <span className="text-sm font-medium">Refactor Coach</span>
      </Link>

      <h1 className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        Last updated: {lastUpdated}
      </p>
    </header>

    <div
      className={cn(
        "prose prose-neutral max-w-none dark:prose-invert",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h2:text-base prose-h2:mt-10 prose-h3:text-sm",
        "prose-p:text-sm prose-li:text-sm prose-td:text-sm prose-th:text-sm",
        "prose-a:underline prose-a:underline-offset-4"
      )}
    >
      {children}
    </div>

    <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground">
      <nav className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/" className="hover:text-foreground">
          Sign in
        </Link>
      </nav>
    </footer>
  </main>
);
