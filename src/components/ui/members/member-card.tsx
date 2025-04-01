import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserMutation } from "@/lib/api/organizations/users";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship_with_user_names";
import { OrganizationStateStore } from "@/lib/stores/organization-state-store";
import { AuthStore } from "@/lib/stores/auth-store";

interface MemberCardProps {
  firstName: string;
  lastName: string;
  email?: string;
  userId: string;
  userRelationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
}

export function MemberCard({
  firstName,
  lastName,
  email,
  userId,
  userRelationships,
  onRefresh,
}: MemberCardProps) {
  const currentOrganizationId = useOrganizationStateStore(
    (state: OrganizationStateStore) => state.currentOrganizationId
  );
  const { userSession } = useAuthStore((state: AuthStore) => state);
  const { deleteNested: deleteUser } = useUserMutation(currentOrganizationId);

  // Check if current user is a coach in any of this user's relationships
  // and make sure we can't delete ourselves
  const canDeleteUser = userRelationships.some(
    (rel) => rel.coach_id === userSession.id && userId !== userSession.id
  );

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this member?")) {
      return;
    }

    try {
      await deleteUser(currentOrganizationId, userId);
      onRefresh(); // Call refresh after successful deletion
    } catch (error) {
      console.error("Error deleting user:", error);
      // You might want to show an error toast here
    }
  };

  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <h3 className="font-medium">
          {firstName} {lastName}
        </h3>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
      </div>
      {canDeleteUser && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
