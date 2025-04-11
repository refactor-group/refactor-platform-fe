"use client";

import { CommandMenu } from "@/components/ui/command-menu";
import { MainNav } from "@/components/ui/main-nav";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { UserNav } from "@/components/ui/user-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full max-w-screen-2xl border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 pl-4 pt-2 max-w-screen-2xl items-start">
        <MainNav />
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          {/* <div className="w-full flex-1 md:w-auto md:flex-none">
            <CommandMenu />
          </div> */}
          <nav className="flex items-center">
            <ModeToggle />
            <UserNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
