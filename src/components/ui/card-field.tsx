import { ChevronDown } from "lucide-react";

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
