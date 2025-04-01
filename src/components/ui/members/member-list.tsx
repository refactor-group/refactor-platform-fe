import { Card, CardContent } from "@/components/ui/card";
import { User } from "@/types/user";
import { MemberCard } from "./member-card";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship_with_user_names";

interface MemberListProps {
  users: User[];
  relationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
}

export function MemberList({
  users,
  relationships,
  onRefresh,
}: MemberListProps) {
  // Create a mapping of user IDs to their associated relationships
  const userRelationshipsMap = users.reduce((acc, user) => {
    acc[user.id] = relationships.filter(
      (rel) => rel.coach_id === user.id || rel.coachee_id === user.id
    );
    return acc;
  }, {} as Record<string, CoachingRelationshipWithUserNames[]>);

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {users.map((user) => (
            <MemberCard
              key={user.id}
              firstName={user.first_name}
              lastName={user.last_name}
              email={user.email}
              userId={user.id}
              userRelationships={userRelationshipsMap[user.id]}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
