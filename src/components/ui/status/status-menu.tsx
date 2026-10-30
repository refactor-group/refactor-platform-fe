"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
        {STATUS_COLUMN_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            data-status={s}
            data-current={s === status ? "true" : "false"}
            onSelect={() => select(s)}
            className="flex h-9 items-center gap-2.5 rounded-input px-2 text-item font-medium"
          >
            <StatusGlyph status={s} decorative />
            {actionStatusToString(s)}
            {s === status && (
              <Check className="ml-auto h-4 w-4 text-brand" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
