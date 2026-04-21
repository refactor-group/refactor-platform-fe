import { cn } from "@/components/lib/utils";

export function CountPill({
  count,
  className,
}: {
  count: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground",
        className
      )}
    >
      {count}
    </span>
  );
}
