import { cn } from "@/components/lib/utils";
import { ItemStatus, actionStatusToString } from "@/types/general";

interface StatusPillProps {
  status: ItemStatus;
  className?: string;
}

export const STATUS_PILL_CLASSES: Record<ItemStatus, string> = {
  [ItemStatus.NotStarted]: "bg-fill text-ink-2",
  [ItemStatus.InProgress]: "bg-brand-tint text-brand-strong",
  [ItemStatus.OnHold]: "bg-on-hold-fill text-on-hold-text",
  [ItemStatus.Completed]: "bg-positive-tint text-positive",
  [ItemStatus.WontDo]: "bg-fill text-muted-foreground",
};

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-[9px] text-pill font-medium",
        STATUS_PILL_CLASSES[status],
        className
      )}
    >
      {actionStatusToString(status)}
    </span>
  );
}
