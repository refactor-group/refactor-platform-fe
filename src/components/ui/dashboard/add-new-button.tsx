"use client";

import { Plus, Calendar, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { isAdminOrSuperAdmin } from "@/types/user";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { cn } from "@/components/lib/utils";

interface AddNewButtonProps {
  onCreateSession: () => void;
  className?: string;
}

export function AddNewButton({ onCreateSession, className }: AddNewButtonProps) {
  const router = useRouter();
  const currentUserRoleState = useCurrentUserRole();
  const { isACoach } = useAuthStore((state) => state);
  const { currentOrganizationId } = useCurrentOrganization();

  // Determine potential actions based on user role (regardless of org selection)
  const couldAddSession = isACoach;
  const couldAddMember = isAdminOrSuperAdmin(currentUserRoleState);
  const hasPotentialActions = couldAddSession || couldAddMember;

  // Don't render button if user has no potential actions (e.g., coachee-only user)
  if (!hasPotentialActions) {
    return null;
  }

  // Disable button if no organization is selected
  const isDisabled = !currentOrganizationId;

  // Determine which actions are currently available (with org selected)
  const canAddSession = couldAddSession && !!currentOrganizationId;
  const canAddMember = couldAddMember && !!currentOrganizationId;

  const handleAddMember = () => {
    router.push(`/organizations/${currentOrganizationId}/members?addMember=true`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn("gap-2", className)} disabled={isDisabled}>
          <Plus className="h-4 w-4" />
          Add New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canAddSession && (
          <DropdownMenuItem onClick={onCreateSession}>
            <Calendar className="h-4 w-4 mr-2" />
            Coaching session
          </DropdownMenuItem>
        )}
        {canAddMember && (
          <DropdownMenuItem onClick={handleAddMember}>
            <Users className="h-4 w-4 mr-2" />
            Organization member
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
