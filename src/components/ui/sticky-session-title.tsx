"use client";

import { useStickyTitle } from "@/lib/contexts/sticky-title-context";

export function StickySessionTitle() {
  const ctx = useStickyTitle();

  // Outside StickyTitleProvider (e.g. dashboard) → render nothing
  if (!ctx) return null;

  const { titleData, isVisible } = ctx;
  const show = isVisible && titleData !== null;

  return (
    <div
      className={`flex items-center overflow-hidden transition-all duration-300 ease-in-out ${
        show ? "max-w-md opacity-100" : "max-w-0 opacity-0"
      }`}
    >
      <div className="flex items-center whitespace-nowrap pl-1">
        <span className="text-sm font-semibold truncate max-w-[200px] lg:max-w-[300px]">
          {titleData?.names}
        </span>
        <span className="mx-1.5 text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground truncate max-w-[180px] lg:max-w-[260px]">
          {titleData?.date}
        </span>
      </div>
    </div>
  );
}
