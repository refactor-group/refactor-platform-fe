"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useRouter } from "next/navigation";

import { cn } from "@/components/lib/utils";

interface AddMemberButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

export function AddMemberButton({ disabled, onClick }: AddMemberButtonProps) {
  const router = useRouter();
  const { currentOrganizationId } = useOrganizationStateStore((state) => state);
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
          "flex items-center rounded-lg border border-border bg-card p-4 text-left",
          disabled
            ? "text-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
            : "bg-card text-black hover:shadow-md transition-all dark:bg-gray-800 dark:text-white"
        )}
        onMouseEnter={() => handleMouseEnter("member")}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!disabled) {
            // Navigate to the Members page and display the AddMemberDialog
            router.push(
              `/organizations/${currentOrganizationId}/members?addMember=true`
            );
            onClick;
          }
        }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <span className="ml-4 text-lg font-medium">Organization Member</span>
        {!disabled && hoveredItem === "member" && (
          <Plus className="ml-auto h-6 w-6 text-primary" />
        )}
      </button>
    </>
  );
}
