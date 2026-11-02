import type { MouseEvent } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CARD_FACE = "rounded-xl px-4 py-3.5 shadow-none hover:border-border-hover";

export const CARD_SURFACE =
  "rounded-xl border border-border bg-background px-4 py-3.5 transition-colors hover:border-border-hover";

export const CARD_TITLE = "text-sm font-medium";

export const CARD_TEXTAREA =
  "w-full rounded-input border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring";

export const CARD_DONE = "text-label font-medium text-brand transition-colors hover:text-brand/80";

export const FIELD_TRIGGER =
  "flex h-7 max-w-[180px] items-center gap-1.5 rounded-full px-2 text-label font-medium text-foreground transition-colors duration-150 hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-fill disabled:pointer-events-none disabled:opacity-50";

export const PICKER_CONTENT = "rounded-xl p-1.5 shadow-popover";
export const PICKER_ROW =
  "flex min-h-9 items-center gap-2.5 rounded-input px-2 text-item font-medium transition-colors";

export function FieldCaret() {
  return <ChevronDown className="h-[11px] w-[11px] shrink-0 text-muted-foreground" aria-hidden />;
}

export const CARD_BUTTON = "h-7 gap-1.5 px-3 text-label max-md:h-10 max-md:min-w-10";

export const FIELD_LABEL = "text-label font-medium text-muted-foreground";

export function CardDetailsButton({
  label,
  tooltip,
  onClick,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick();
  };
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-menu"
            aria-label={label}
            onClick={handleClick}
            className="shrink-0 text-faint"
          >
            <Info />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
