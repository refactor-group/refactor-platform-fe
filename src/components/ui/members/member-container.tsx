import { MemberList } from "./member-list";
import { AddMemberButton } from "./add-member-button";
import { User, isAdminOrSuperAdmin, sortUsersAlphabetically } from "@/types/user";
import { CoachingRelationshipWithUserNames, isUserCoach } from "@/types/coaching_relationship";
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
    setIsACoach(isUserCoach(userSession.id, relationships));
  }, [relationships, userSession.id, setIsACoach]);

  // Sort users: current user first, then alphabetically by name
  const displayUsers = sortUsersAlphabetically(users, userSession.id);

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
        {(isACoach || isAdminOrSuperAdmin(currentUserRoleState)) && (
          <AddMemberButton
            onMemberAdded={onRefresh}
            openAddMemberDialog={openAddMemberDialog}
          />
        )}
      </div>
      <MemberList
        users={displayUsers}
        relationships={relationships}
        onRefresh={onRefresh}
        currentUserId={userSession.id}
      />
    </div>
  );
}
