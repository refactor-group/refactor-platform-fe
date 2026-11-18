"use client";

import { Info } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export enum InfoButtonSize {
  /** 32px, beside a field label. */
  Label = "label",
  /** 40px, at the right edge of a choice card. */
  Card = "card",
}

interface InfoButtonProps {
  /** What it explains; names the button ("About {title}") and heads the popover. */
  title: string;
  info: string;
  size: InfoButtonSize;
  className?: string;
}

/** An (i) that explains what a field or choice means, on click or tap. See the style guide. */
export function InfoButton({ title, info, size, className }: InfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          className={cn(
            "flex items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-fill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            size === InfoButtonSize.Label ? "-my-2 h-8 w-8" : "h-10 w-10",
            className
          )}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align={size === InfoButtonSize.Label ? "start" : "end"} className="w-64 p-3 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-muted-foreground">{info}</p>
      </PopoverContent>
    </Popover>
  );
}
