import { Card, CardContent } from "@/components/ui/card";
import { User, UserRoleState } from "@/types/user";
import { MemberCard } from "./member-card";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Id } from "@/types/general";

interface MemberListProps {
  users: User[];
  relationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
  currentUserId: Id;
  currentUserRoleState: UserRoleState;
}

export function MemberList({
  users,
  relationships,
  onRefresh,
  currentUserId,
  currentUserRoleState,
}: MemberListProps) {
  // Create a mapping of user IDs to their associated relationships
  const userRelationshipsMap = users.reduce<Record<Id, CoachingRelationshipWithUserNames[]>>(
  (accumulator_map, user) => {
    const userRelationships = relationships.filter(
      (relationship) =>
        relationship.coach_id === user.id || relationship.coachee_id === user.id
    );
    accumulator_map[user.id] = userRelationships;
    return accumulator_map;
  },
  {}
);

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {users.map((user) => (
            <MemberCard
              key={user.id}
              user={user}
              currentUserId={currentUserId}
              userRelationships={userRelationshipsMap[user.id] ?? []}
              onRefresh={onRefresh}
              users={users}
              currentUserRoleState={currentUserRoleState}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
