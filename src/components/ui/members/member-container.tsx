import { MemberList } from "./member-list";
import { AddMemberButton } from "./add-member-button";
import { User } from "@/types/user";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship_with_user_names";
import { UserSession } from "@/types/user-session";

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
  // Find relationships where current user is either coach or coachee
  const userRelationships = relationships.filter(
    (rel) =>
      rel.coach_id === userSession.id || rel.coachee_id === userSession.id
  );

  // Get IDs of users in these relationships
  const associatedUserIds = new Set(
    userRelationships.flatMap((rel) => [rel.coach_id, rel.coachee_id])
  );

  // Filter users to only include those in the relationships
  const associatedUsers = users.filter((user) =>
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
        <h2 className="text-2xl font-semibold">Members</h2>
        <AddMemberButton
          onMemberAdded={onRefresh}
          openAddMemberDialog={openAddMemberDialog}
        />
      </div>
      <MemberList users={associatedUsers} />
    </div>
  );
}
