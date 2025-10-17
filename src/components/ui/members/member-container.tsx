import { MemberList } from "./member-list";
import { AddMemberButton } from "./add-member-button";
import { User, isAdminOrSuperAdmin } from "@/types/user";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { UserSession } from "@/types/user-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
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
    const currentUserRoleState = useCurrentUserRole();
    const { currentOrganization } = useCurrentOrganization();

    // Check if current user is a coach in ANY relationship
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

  // If the current user is an Admin or SuperAdmin, show all users. Otherwise, only show users
  // that are associated with the current user in a coaching relationship.
  const filteredUsers = isAdminOrSuperAdmin(currentUserRoleState)
    ? users
    : users.filter((user) => associatedUserIds.has(user.id));

  // Sort users to show current user first
  const displayUsers = [...filteredUsers].sort((a, b) => {
    if (a.id === userSession.id) return -1;
    if (b.id === userSession.id) return 1;
    return 0;
  });

  if (isLoading) {
    return (
      <div className="py-4 text-center text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-semibold">Members</h3>
          {currentOrganization && (
            <p className="text-sm text-muted-foreground">
              of {currentOrganization.name}
            </p>
          )}
        </div>
        {/* Only show the button if user is a coach to _some_ user within the
        scope of the organization or if user is an Admin or SuperAdmin. We may come back and add this directly to user
        data.  */}
        {(isACoach || isAdminOrSuperAdmin(currentUserRoleState)) && (
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
        currentUserId={userSession.id}
      />
    </div>
  );
}
