import { Card, CardContent } from "@/components/ui/card";
import { User } from "@/types/user";
import { MemberCard } from "./member-card";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Id } from "@/types/general";

interface MemberListProps {
  users: User[];
  relationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
  currentUserId: Id;
}

export function MemberList({
  users,
  relationships,
  onRefresh,
  currentUserId,
}: MemberListProps) {
  // Create a mapping of user IDs to their associated relationships
  const userRelationshipsMap = users.reduce((accumulator_map, user) => {
    accumulator_map[user.id] = relationships.filter(
      (rel) => rel.coach_id === user.id || rel.coachee_id === user.id
    );
    return accumulator_map;
  }, {} as Record<Id, CoachingRelationshipWithUserNames[]>);

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {users.map((user) => (
            <MemberCard
              key={user.id}
              user={user}
              currentUserId={currentUserId}
              userRelationships={userRelationshipsMap[user.id]}
              onRefresh={onRefresh}
              users={users}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
