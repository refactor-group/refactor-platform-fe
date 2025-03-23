"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AddMemberDialog } from "./add-member-dialog";
import { useState } from "react";
import { Plus } from "lucide-react";

export function AddMemberButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </DialogTrigger>
      <AddMemberDialog open={open} onOpenChange={setOpen} />
    </Dialog>
  );
}
