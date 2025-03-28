"use client";

import { useState } from "react";
import { AddCoachingSessionDialog } from "./add-coaching-session-dialog";
import { AddCoachingSessionButton } from "./add-coaching-session-button";
import { AddMemberButton } from "./add-member-button";

export default function CreateEntity() {
  const [open, setOpen] = useState(false);

  const onCoachingSessionAdded = () => {
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

        <AddMemberButton />
      </div>
    </div>
  );
}
