"use client";

import { useState } from "react";
import { AddCoachingSessionDialog } from "./add-coaching-session-dialog";
import { AddCoachingSessionButton } from "./add-coaching-session-button";
import { AddMemberButton } from "./add-member-button";
import { useRouter } from "next/navigation";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";

export default function CreateEntity() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currentOrganizationId } = useOrganizationStateStore((state) => state);

  const onCoachingSessionAdded = () => {
    setOpen(false);
  };

  const onMemberButtonClicked = () => {
    router.push(`/organizations/${currentOrganizationId}/members`);
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

        <AddMemberButton onClick={onMemberButtonClicked} />
      </div>
    </div>
  );
}
