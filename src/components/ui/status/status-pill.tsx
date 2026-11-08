import { cn } from "@/components/lib/utils";
import { Pill } from "@/components/ui/pill";
import { ItemStatus, actionStatusToString } from "@/types/general";

interface StatusPillProps {
  status: ItemStatus;
  className?: string;
}

const STATUS_PILL_CLASSES: Record<ItemStatus, string> = {
  [ItemStatus.NotStarted]: "bg-fill text-ink-2",
  [ItemStatus.InProgress]: "bg-brand-tint text-brand-strong",
  [ItemStatus.OnHold]: "bg-on-hold-fill text-on-hold-text",
  [ItemStatus.Completed]: "bg-positive-tint text-positive",
  [ItemStatus.WontDo]: "bg-fill text-muted-foreground",
};

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <Pill data-status={status} className={cn(STATUS_PILL_CLASSES[status], className)}>
      {actionStatusToString(status)}
    </Pill>
  );
}
