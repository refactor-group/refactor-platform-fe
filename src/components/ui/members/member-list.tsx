import { Card, CardContent } from "@/components/ui/card";
import { User } from "@/types/user";
import { MemberCard } from "./member-card";

interface MemberListProps {
  users: User[];
}

export function MemberList({ users }: MemberListProps) {
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
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
