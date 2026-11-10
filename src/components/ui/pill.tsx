import type { ComponentProps } from "react";
import { cn } from "@/components/lib/utils";

/** The design system's 24px pill; callers supply its colour pair. */
export function Pill({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-[9px] text-pill font-medium",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
