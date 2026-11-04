import { Check } from "lucide-react";

import { cn } from "@/components/lib/utils";

type CheckDiscSize = 16 | 20;
type CheckDiscTone = "brand" | "positive";

const SIZE_CLASSES: Record<CheckDiscSize, { disc: string; icon: string }> = {
  16: { disc: "h-4 w-4", icon: "h-2.5 w-2.5" },
  20: { disc: "h-5 w-5", icon: "h-3 w-3" },
};

const TONE_CLASSES: Record<CheckDiscTone, string> = {
  brand: "bg-primary",
  positive: "bg-positive-solid",
};

interface CheckDiscProps {
  size: CheckDiscSize;
  tone: CheckDiscTone;
  className?: string;
}

export function CheckDisc({ size, tone, className }: CheckDiscProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-white",
        SIZE_CLASSES[size].disc,
        TONE_CLASSES[tone],
        className
      )}
    >
      <Check className={SIZE_CLASSES[size].icon} strokeWidth={3} />
    </span>
  );
}
