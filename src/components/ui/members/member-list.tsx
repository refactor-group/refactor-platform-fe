import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { User, UserRoleState } from "@/types/user";
import { MemberCard } from "./member-card";
import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
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
  // Each user's relationships; kept between renders so each card's own memos hold.
  const userRelationshipsMap = useMemo(
    () =>
      users.reduce<Record<Id, CoachingRelationshipWithUserNames[]>>((accumulator_map, user) => {
        accumulator_map[user.id] = relationships.filter(
          (relationship) => relationship.coach_id === user.id || relationship.coachee_id === user.id
        );
        return accumulator_map;
      }, {}),
    [users, relationships]
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
