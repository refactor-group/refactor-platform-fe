"use client";


import { MainNav } from "@/components/ui/main-nav";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { JoinSessionPopover } from "@/components/ui/join-session-popover";
import { UserNav } from "@/components/ui/user-nav";
import { StickySessionTitle } from "@/components/ui/sticky-session-title";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";

export function SiteHeader() {
  const currentCoachingRelationshipId = useCoachingRelationshipStateStore(
    (state) => state.currentCoachingRelationshipId
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 pl-4 w-full max-w-screen-2xl items-center">
        <MainNav />
        <StickySessionTitle />
        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* <div className="w-full flex-1 md:w-auto md:flex-none">
            <CommandMenu />
          </div> */}
          <nav className="flex items-center gap-1">
            <JoinSessionPopover defaultRelationshipId={currentCoachingRelationshipId || undefined} />
            <div className="w-2" />
            <ModeToggle />
            <UserNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
