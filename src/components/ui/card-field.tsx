import type { MouseEvent } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Shared by the session cards (actions, suggestions, agreements, goals) so
// they read as one family: the design system's full-card shape and controls.

/** Face classes for BaseCardCompactEditable: flat, radius 12, padding 14×16, border darkens on hover. */
export const CARD_FACE = "rounded-xl px-4 py-3.5 shadow-none hover:border-border-hover";

/** The same shape for a card that isn't a flip card. */
export const CARD_SURFACE =
  "rounded-xl border border-border bg-background px-4 py-3.5 transition-colors hover:border-border-hover";

/** A card's title: 14/500. */
export const CARD_TITLE = "text-sm font-medium";

/** A card's edit textarea: radius 10, 14px text. */
export const CARD_TEXTAREA =
  "w-full rounded-input border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring";

/** The back face's "Done" link. */
export const CARD_DONE = "text-label font-medium text-brand transition-colors hover:text-brand/80";

/** A card field's trigger: a borderless 28px pill that fills on hover, like the status control. */
export const FIELD_TRIGGER =
  "flex h-7 max-w-[180px] items-center gap-1.5 rounded-full px-2 text-label font-medium text-foreground transition-colors duration-150 hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-fill disabled:pointer-events-none disabled:opacity-50";

/** The status menu's surface and rows, shared by the card's pickers. */
export const PICKER_CONTENT = "rounded-xl p-1.5 shadow-popover";
export const PICKER_ROW =
  "flex min-h-9 items-center gap-2.5 rounded-input px-2 text-item font-medium transition-colors";

export function FieldCaret() {
  return <ChevronDown className="h-[11px] w-[11px] shrink-0 text-muted-foreground" aria-hidden />;
}

/** Pill buttons inside a card (Edit, Delete, Save, Accept…): 28px, roomier on phones. */
export const CARD_BUTTON = "h-7 gap-1.5 px-3 text-label max-md:h-10 max-md:min-w-10";

/** A card field's label: 12.5/500 muted. */
export const FIELD_LABEL = "text-label font-medium text-muted-foreground";

/** The card's details (ⓘ) button: 28px, faint, fills on hover; flips the card. */
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
