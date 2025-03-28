"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { AddCoachingSessionDialog } from "./add-coaching-session-dialog";
import { AddCoachingSessionButton } from "./add-coaching-session-button";

interface CreateEntityProps {
  onCreateCoachingSession?: () => void;
  onCreateMember?: () => void;
}

export default function CreateEntity({
  onCreateCoachingSession,
  onCreateMember,
}: CreateEntityProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleMouseEnter = (item: string) => {
    setHoveredItem(item);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const onCoachingSessionAdded = () => {
    if (onCreateCoachingSession) onCreateCoachingSession();
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Create</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AddCoachingSessionDialog
          open={open}
          onOpenChange={setOpen}
          onCoachingSessionAdded={onCoachingSessionAdded}
          dialogTrigger={<AddCoachingSessionButton />}
        />

        <button
          className={cn(
            "flex items-center rounded-lg border border-border bg-card p-4 text-left transition-all hover:shadow-md",
            hoveredItem === "member" && "shadow-md"
          )}
          onMouseEnter={() => handleMouseEnter("member")}
          onMouseLeave={handleMouseLeave}
          onClick={onCreateMember}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <span className="ml-4 text-lg font-medium">Organization Member</span>
          {hoveredItem === "member" && (
            <Plus className="ml-auto h-6 w-6 text-primary" />
          )}
        </button>
      </div>
    </div>
  );
}
