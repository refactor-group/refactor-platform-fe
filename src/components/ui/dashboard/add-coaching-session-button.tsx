"use client";

import { useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { cn } from "@/components/lib/utils";

interface AddCoachingSessionButtonProps {
  onClick?: () => void;
}

export function AddCoachingSessionButton({
  onClick,
}: AddCoachingSessionButtonProps) {
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
          hoveredItem === "coaching" && "shadow-md"
        )}
        onMouseEnter={() => handleMouseEnter("coaching")}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <span className="ml-4 text-lg font-medium">Coaching Session</span>
        {hoveredItem === "coaching" && (
          <Plus className="ml-auto h-6 w-6 text-primary" />
        )}
      </button>
    </>
  );
}
