import { Separator } from "@/components/ui/separator";

interface YearDividerProps {
  year: number;
}

export function YearDivider({ year }: YearDividerProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-6">
      <Separator className="flex-1 bg-border/40" />
      <span className="text-xs text-muted-foreground/70 tabular-nums">
        {year}
      </span>
      <Separator className="flex-1 bg-border/40" />
    </div>
  );
}
