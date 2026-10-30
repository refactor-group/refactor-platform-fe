import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";

import { cn } from "@/components/lib/utils";

interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected: boolean;
}

export function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-fill text-foreground hover:bg-fill-hover",
        className
      )}
      {...props}
    />
  );
}

interface FilterChipProps {
  label: string;
  onClear: () => void;
  className?: string;
}

export function FilterChip({ label, onClear, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border bg-card pl-[9px] pr-1.5 text-xs font-medium text-foreground",
        className
      )}
    >
      {label}
      <button
        type="button"
        aria-label={`Clear ${label}`}
        onClick={onClear}
        className="text-faint transition-colors hover:text-foreground"
      >
        <X className="h-[13px] w-[13px]" />
      </button>
    </span>
  );
}
