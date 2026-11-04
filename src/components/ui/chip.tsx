import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";

import { cn } from "@/components/lib/utils";

type ChipSize = "sm" | "md";

const CHIP_SIZE_CLASSES: Record<ChipSize, string> = {
  sm: "h-6 px-2.5 text-xs",
  md: "h-11 modal:h-9 px-4 text-[13px]",
};

interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected: boolean;
  size?: ChipSize;
}

export function Chip({ selected, size = "sm", className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        CHIP_SIZE_CLASSES[size],
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
