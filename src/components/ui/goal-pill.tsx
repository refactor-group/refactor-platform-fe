import { X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";

interface GoalPillProps {
  title: string;
  onUnlink?: () => void;
  className?: string;
}

/** Compact pill showing a linked goal title with tooltip. Optionally shows an unlink (X) button. */
export function GoalPill({ title, onUnlink, className }: GoalPillProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid="goal-pill"
              className="min-w-0 block rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground truncate"
            >
              {title}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {title}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {onUnlink && (
        <button
          type="button"
          aria-label="Unlink goal"
          onClick={onUnlink}
          className="rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
