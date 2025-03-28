"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { cn } from "@/components/lib/utils";

interface AddMemberButtonProps {
  onClick?: () => void;
}

export function AddMemberButton({ onClick }: AddMemberButtonProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleMouseEnter = (item: string) => {
    setHoveredItem(item);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  return (
    <>
      <button
        className={cn(
          "flex items-center rounded-lg border border-border bg-card p-4 text-left transition-all hover:shadow-md",
          hoveredItem === "member" && "shadow-md"
        )}
        onMouseEnter={() => handleMouseEnter("member")}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <span className="ml-4 text-lg font-medium">Organization Member</span>
        {hoveredItem === "member" && (
          <Plus className="ml-auto h-6 w-6 text-primary" />
        )}
      </button>
    </>
  );
}
