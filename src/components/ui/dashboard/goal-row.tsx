import { ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GoalRowProps {
  title: string;
  actionsCompleted: number;
  actionsTotal: number;
  linkedSessionCount: number;
}

export function GoalRow({
  title,
  actionsCompleted,
  actionsTotal,
  linkedSessionCount,
}: GoalRowProps) {
  const percent =
    actionsTotal > 0
      ? Math.round((actionsCompleted / actionsTotal) * 100)
      : 0;

  return (
    <div className="flex items-center gap-4 py-3 transition-colors hover:bg-muted/30 rounded-md px-3 -mx-3">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate text-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {actionsCompleted}/{actionsTotal} actions &middot;{" "}
          {linkedSessionCount}{" "}
          {linkedSessionCount === 1 ? "session" : "sessions"}
        </p>
      </div>

      <div className="w-20 shrink-0 hidden sm:block">
        <Progress
          value={percent}
          className="h-1 [&>div]:bg-foreground/25"
        />
      </div>

      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-10 text-right">
        {percent}%
      </span>

      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25 shrink-0" />
    </div>
  );
}
