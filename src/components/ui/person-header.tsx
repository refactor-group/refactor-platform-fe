"use client";

import { PersonAvatar } from "@/components/ui/avatar";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

interface PersonHeaderProps {
  userId: Id;
  initials: string;
  fullName: string;
  detail: Option<string>;
}

/** A dialog rail's 36px avatar and name, with an optional line beneath. */
export function PersonHeader({ userId, initials, fullName, detail }: PersonHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <PersonAvatar userId={userId} initials={initials} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{fullName}</p>
        {detail.some && <p className="truncate text-xs text-muted-foreground">{detail.val}</p>}
      </div>
    </div>
  );
}
