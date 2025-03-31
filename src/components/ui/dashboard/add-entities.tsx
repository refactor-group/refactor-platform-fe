"use client";

import { useState } from "react";
import { AddCoachingSessionDialog } from "./add-coaching-session-dialog";
import { AddCoachingSessionButton } from "./add-coaching-session-button";
import { AddMemberButton } from "./add-member-button";
import { useRouter } from "next/navigation";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

export default function AddEntities() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currentOrganizationId } = useOrganizationStateStore((state) => state);
  const { isCoach } = useAuthStore((state) => state);

  const onCoachingSessionAdded = () => {
    setOpen(false);
  };

  const onMemberButtonClicked = () => {
    router.push(`/organizations/${currentOrganizationId}/members`);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
        Add New
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AddCoachingSessionDialog
          open={open}
          onOpenChange={setOpen}
          onCoachingSessionAdded={onCoachingSessionAdded}
          dialogTrigger={
            <AddCoachingSessionButton
              disabled={!isCoach || !currentOrganizationId}
            />
          }
        />

        {/* TODO: Refactor the AddMemberButton and AddMemberDialog to work just like
            AddCoachingSessionDialog does above, where the dialog is the parent container
            and it accepts a AddMemberButton as the dialogTrigger parameter.
        */}
        <AddMemberButton
          disabled={!isCoach || !currentOrganizationId}
          onClick={onMemberButtonClicked}
        />
      </div>
    </div>
  );
}
