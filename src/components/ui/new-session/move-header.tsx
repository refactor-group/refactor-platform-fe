"use client";

import { PersonAvatar } from "@/components/ui/avatar";
import type { MoverModel } from "@/lib/new-session-dialog-model";

export function MoveHeader({ userId, initials, fullName, currently }: MoverModel) {
  return (
    <div className="flex items-center gap-3">
      <PersonAvatar userId={userId} initials={initials} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{currently}</p>
      </div>
    </div>
  );
}
