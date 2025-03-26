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
}

export function MemberContainer({
  users,
  relationships,
  userSession,
  onRefresh,
  isLoading,
}: MemberContainerProps) {
  // Check if current user is a coach in any relationship
  const isCoachInAnyRelationship = relationships.some(
    (rel) => rel.coach_id === userSession.id
  );

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
        {/* Only show the button if user is a coach to _some_ user within the
        scope of the organization. We may come back and add this directly to user
        data.  */}
        {isCoachInAnyRelationship && (
          <AddMemberButton onMemberAdded={onRefresh} />
        )}
      </div>
      <MemberList users={associatedUsers} />
    </div>
  );
}
