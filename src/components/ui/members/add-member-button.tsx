"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";

interface AddMemberButtonProps {
  onMemberAdded: () => void;
}

export function AddMemberButton({ onMemberAdded }: AddMemberButtonProps) {
  const [open, setOpen] = useState(false);

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
      />
    </>
  );
}
