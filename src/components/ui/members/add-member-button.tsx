"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";
import { AddMemberMode } from "@/lib/add-member-dialog-model";
import type { Option } from "@/types/option";
import { User, UserRoleState, isAdminOrSuperAdmin } from "@/types/user";

interface AddMemberButtonProps {
  onMemberAdded: () => void;
  /// Opens the AddMemberDialog in this mode
  openAddMemberDialog: Option<AddMemberMode>;
  currentUserRoleState: UserRoleState;
  /// Candidates offered when pre-assigning a coach
  organizationMembers?: User[];
  /// False hides adding an existing account, which has nothing to offer an
  /// admin of a single organization.
  canAddExistingMembers: boolean;
}

export function AddMemberButton({
  onMemberAdded,
  openAddMemberDialog,
  currentUserRoleState,
  organizationMembers,
  canAddExistingMembers,
}: AddMemberButtonProps) {
  const [open, setOpen] = useState(false);
  // The link's mode applies to the dialog it opens; the button always starts on Create.
  const [mode, setMode] = useState(AddMemberMode.Create);

  useEffect(() => {
    setOpen(openAddMemberDialog.some);
    if (openAddMemberDialog.some) setMode(openAddMemberDialog.val);
  }, [openAddMemberDialog]);

  const openFromButton = () => {
    setMode(AddMemberMode.Create);
    setOpen(true);
  };

  return (
    <>
      <Button onClick={openFromButton}>
        <Plus className="mr-2 h-4 w-4" />
        Add Member
      </Button>
      {open && (
        <AddMemberDialog
          onClose={() => setOpen(false)}
          onMemberAdded={onMemberAdded}
          organizationMembers={organizationMembers ?? []}
          canAddExisting={isAdminOrSuperAdmin(currentUserRoleState) && canAddExistingMembers}
          initialMode={mode}
        />
      )}
    </>
  );
}
