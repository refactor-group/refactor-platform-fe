"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddMemberDialog, AddMemberTab } from "./add-member-dialog";
import type { Option } from "@/types/option";
import { User, UserRoleState } from "@/types/user";

interface AddMemberButtonProps {
  onMemberAdded: () => void;
  /// Opens the AddMemberDialog on this tab
  openAddMemberDialog: Option<AddMemberTab>;
  currentUserRoleState: UserRoleState;
  /// Candidates offered when pre-assigning a coach
  organizationMembers?: User[];
  productName: string;
  /// False hides the add-existing-member tab, which has nothing to offer an
  /// admin of a single organization.
  canAddExistingMembers: boolean;
}

export function AddMemberButton({
  onMemberAdded,
  openAddMemberDialog,
  currentUserRoleState,
  organizationMembers,
  productName,
  canAddExistingMembers,
}: AddMemberButtonProps) {
  const [open, setOpen] = useState(false);
  // The link's tab applies to the dialog it opens; the button always starts on Create.
  const [tab, setTab] = useState(AddMemberTab.Create);

  useEffect(() => {
    setOpen(openAddMemberDialog.some);
    if (openAddMemberDialog.some) setTab(openAddMemberDialog.val);
  }, [openAddMemberDialog]);

  const openFromButton = () => {
    setTab(AddMemberTab.Create);
    setOpen(true);
  };

  return (
    <>
      <Button onClick={openFromButton}>
        <Plus className="mr-2 h-4 w-4" />
        Add Member
      </Button>
      <AddMemberDialog
        open={open}
        onOpenChange={setOpen}
        onMemberAdded={onMemberAdded}
        currentUserRoleState={currentUserRoleState}
        organizationMembers={organizationMembers}
        productName={productName}
        canAddExistingMembers={canAddExistingMembers}
        initialTab={tab}
      />
    </>
  );
}
