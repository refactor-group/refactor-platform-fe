"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Puzzle, Video } from "lucide-react";
import { cn } from "@/components/lib/utils";

import type { FC, ComponentType } from "react";

interface NavChild {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: NavChild[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Integrations",
    icon: Puzzle,
    children: [
      { title: "Meetings", href: "/settings/integrations", icon: Video },
    ],
  },
];

export const SettingsNav: FC = () => {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: vertical sidebar nav */}
      <nav className="hidden md:flex w-48 shrink-0 flex-col gap-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <span className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <group.icon className="h-4 w-4" />
              {group.title}
            </span>
            {group.children.map((child) => {
              const isActive = pathname.startsWith(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md pl-9 pr-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  {child.title}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Mobile: horizontal tabs (flat — only child items) */}
      <nav className="flex md:hidden gap-1 border-b pb-2 overflow-x-auto">
        {NAV_GROUPS.flatMap((group) =>
          group.children.map((child) => {
            const isActive = pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <child.icon className="h-4 w-4" />
                {child.title}
              </Link>
            );
          })
        )}
      </nav>
    </>
  );
};
