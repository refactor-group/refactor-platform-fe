"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";
import { UserRoleState } from "@/types/user";

interface AddMemberButtonProps {
  onMemberAdded: () => void;
  /// Force the AddMemberDialog to open
  openAddMemberDialog: boolean;
  currentUserRoleState: UserRoleState;
}

export function AddMemberButton({
  onMemberAdded,
  openAddMemberDialog,
  currentUserRoleState,
}: AddMemberButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(openAddMemberDialog);
  }, [openAddMemberDialog]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Member
      </Button>
      <AddMemberDialog
        open={open}
        onOpenChange={setOpen}
        onMemberAdded={onMemberAdded}
        currentUserRoleState={currentUserRoleState}
      />
    </>
  );
}
