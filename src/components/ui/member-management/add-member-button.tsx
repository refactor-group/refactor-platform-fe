"use client";

import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { UserCategory } from "@/types/user-category";

interface AddMemberButtonProps {
  memberType: UserCategory;
}

export function AddMemberButton({ memberType }: AddMemberButtonProps) {
  return (
    <DialogTrigger asChild>
      <Button variant="outline" size="sm">
        Add {memberType}
      </Button>
    </DialogTrigger>
  );
}
