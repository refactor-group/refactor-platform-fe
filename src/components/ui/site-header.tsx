"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/lib/utils";
import { OrgAvatar } from "@/components/ui/avatar";
import { JoinSessionMenu } from "@/components/ui/join-session/join-session-menu";
import { UserMenu } from "@/components/ui/user-menu";
import { GlobalSearch } from "@/components/ui/search/global-search";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useOrganizationSync } from "@/lib/hooks/use-organization-sync";
import { useShowSessionSwitcher } from "@/lib/hooks/use-show-session-switcher";

export function SiteHeader() {
  useOrganizationSync();

  return (
    <header className="sticky top-0 z-50 h-14 w-full border-b border-hairline bg-background">
      <div className="flex h-full items-center gap-1.5 pl-4 pr-4 sm:gap-2 sm:pl-5">
        <OrganizationHomeLink />
        <div className="mx-1 hidden h-6 w-px bg-hairline sm:block" />
        <DestinationNav />
        <div className="flex-1" />
        <GlobalSearch />
        <JoinSessionSlot />
        <UserMenu />
      </div>
    </header>
  );
}

function OrganizationHomeLink() {
  const { currentOrganization } = useCurrentOrganization();
  const name = currentOrganization?.name;

  return (
    <Link
      href="/dashboard"
      aria-label={name ?? "Dashboard"}
      className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2.5 rounded-lg sm:justify-start"
    >
      <OrgAvatar name={name} logo={currentOrganization?.logo} className="shrink-0" />
      {name && (
        <span className="hidden max-w-[240px] truncate whitespace-nowrap text-[15px] font-medium tracking-[-0.01em] sm:block">
          {name}
        </span>
      )}
    </Link>
  );
}

const DESTINATIONS = [
  { href: "/dashboard", label: "Dashboard", mobile: false },
  { href: "/actions", label: "Actions", mobile: true },
] as const;

function DestinationNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className="flex shrink-0 items-center gap-1">
      {DESTINATIONS.map(({ href, label, mobile }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-[34px] items-center rounded-full px-3.5 text-sm font-medium transition-colors duration-150 sm:h-9",
              mobile ? "flex" : "hidden sm:flex",
              isActive
                ? "bg-fill text-foreground"
                : "text-ink-2 hover:bg-fill-hover"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function JoinSessionSlot() {
  const showSessionSwitcher = useShowSessionSwitcher();
  if (!showSessionSwitcher) return null;
  return <JoinSessionMenu />;
}
