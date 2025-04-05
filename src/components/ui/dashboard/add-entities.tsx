"use client";

import { AddCoachingSessionButton } from "./add-coaching-session-button";
import { AddMemberButton } from "./add-member-button";
import { useRouter } from "next/navigation";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

interface AddEntitiesProps {
  onCreateSession: () => void;
}

export default function AddEntities({ onCreateSession }: AddEntitiesProps) {
  const router = useRouter();
  const { currentOrganizationId } = useOrganizationStateStore((state) => state);
  const { isCoach } = useAuthStore((state) => state);

  const onMemberButtonClicked = () => {
    router.push(`/organizations/${currentOrganizationId}/members`);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
        Add New
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AddCoachingSessionButton
          disabled={!isCoach || !currentOrganizationId}
          onClick={onCreateSession}
        />

        <AddMemberButton
          disabled={!isCoach || !currentOrganizationId}
          onClick={onMemberButtonClicked}
        />
      </div>
    </div>
  );
}