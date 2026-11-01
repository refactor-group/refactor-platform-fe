"use client";

import { ChevronDown } from "lucide-react";
import { StatusGlyph } from "@/components/ui/status/status-glyph";
import { StatusMenu } from "@/components/ui/status/status-menu";
import { StatusPill } from "@/components/ui/status/status-pill";
import { ItemStatus, actionStatusToString } from "@/types/general";

interface ActionStatusControlProps {
  status: ItemStatus;
  onStatusChange: (status: ItemStatus) => void;
}

/** The full action card's status control: glyph, pill and caret in one hover pill that opens the status menu. */
export function ActionStatusControl({ status, onStatusChange }: ActionStatusControlProps) {
  return (
    <StatusMenu status={status} onStatusChange={onStatusChange}>
      <button
        type="button"
        aria-label={`Status: ${actionStatusToString(status)}`}
        // Keeps the click from expanding, flipping or dragging the card.
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="-ml-1 flex h-7 items-center gap-1.5 rounded-full pl-1 pr-1.5 transition-colors duration-150 hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-fill"
      >
        <StatusGlyph status={status} decorative />
        <StatusPill status={status} />
        <ChevronDown className="h-[11px] w-[11px] text-muted-foreground" aria-hidden />
      </button>
    </StatusMenu>
  );
}
