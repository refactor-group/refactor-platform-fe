"use client";

import type { ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_COLUMN_ORDER } from "@/components/ui/actions/utils";
import { StatusGlyph } from "@/components/ui/status/status-glyph";
import { ItemStatus, actionStatusToString } from "@/types/general";

interface StatusMenuProps {
  status: ItemStatus;
  onStatusChange: (status: ItemStatus) => void;
  children: ReactNode;
  align?: "start" | "end";
}

export function StatusMenu({
  status,
  onStatusChange,
  children,
  align = "start",
}: StatusMenuProps) {
  const select = (next: ItemStatus) => {
    if (next !== status) onStatusChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[180px] rounded-xl p-1.5">
        {/* A radio group so screen readers announce which status is selected. */}
        <DropdownMenuPrimitive.RadioGroup
          value={status}
          onValueChange={(next) => select(next as ItemStatus)}
        >
          {STATUS_COLUMN_ORDER.map((s) => (
            <DropdownMenuPrimitive.RadioItem
              key={s}
              value={s}
              data-status={s}
              data-current={s === status ? "true" : "false"}
              className="relative flex h-9 cursor-default select-none items-center gap-2.5 rounded-input px-2 text-item font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
            >
              <StatusGlyph status={s} decorative />
              {actionStatusToString(s)}
              <DropdownMenuPrimitive.ItemIndicator className="ml-auto">
                <Check className="h-4 w-4 text-brand" aria-hidden />
              </DropdownMenuPrimitive.ItemIndicator>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
