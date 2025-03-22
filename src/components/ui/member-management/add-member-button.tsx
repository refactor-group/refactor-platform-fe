"use client";

import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";

export function AddMemberButton() {
  return (
    <DialogTrigger asChild>
      <Button variant="outline" size="sm">
        Add Coachee
      </Button>
    </DialogTrigger>
  );
}
