import { MemberList } from "./member-list";
import { AddMemberButton } from "./add-member-button";
import { User } from "@/types/user";
import { Role } from "@/types/user";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { UserSession } from "@/types/user-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useEffect } from "react";

interface MemberContainerProps {
  users: User[];
  relationships: CoachingRelationshipWithUserNames[];
  userSession: UserSession;
  onRefresh: () => void;
  isLoading: boolean;
  openAddMemberDialog: boolean;
}

export function MemberContainer({
  users,
  relationships,
  userSession,
  onRefresh,
  isLoading,
  /// Force the AddMemberDialog to open
  openAddMemberDialog,
}: MemberContainerProps) {
    const { setIsACoach, isACoach } = useAuthStore((state) => state);

    // Check if current user is a coach in any relationship
    useEffect(() => {
      setIsACoach(
        relationships.some((rel) => rel.coach_id === userSession.id)
      );
    }, [relationships, userSession.id, setIsACoach]);
  
    // Find relationships where current user is either coach or coachee
    const userRelationships = relationships.filter(
      (rel) =>
        rel.coach_id === userSession.id || rel.coachee_id === userSession.id
    );

  // Get IDs of users in these relationships
  const associatedUserIds = new Set(
    userRelationships.flatMap((rel) => [rel.coach_id, rel.coachee_id])
  );

  // If the current user is an admin, show all users. Otherwise, only show users
  // that are associated with the current user in a coaching relationship.
  const displayUsers = (userSession.role === Role.Admin) ? users : users.filter((user) =>
      associatedUserIds.has(user.id)
    );

  if (isLoading) {
    return (
      <div className="py-4 text-center text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-semibold">Members</h3>
        {/* Only show the button if user is a coach to _some_ user within the
        scope of the organization or if user is an admin. We may come back and add this directly to user
        data.  */}
        {(isACoach || userSession.role === Role.Admin) && (
          <AddMemberButton
            onMemberAdded={onRefresh}
            openAddMemberDialog={openAddMemberDialog}
          />
        )}
      </div>
      <MemberList
        users={displayUsers}
        relationships={userRelationships}
        onRefresh={onRefresh}
      />
    </div>
  );
}
