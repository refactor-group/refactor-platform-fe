import { Card, CardContent } from "@/components/ui/card";
import { AddMemberContainer } from "./add-member-container";
import { User } from "@/types/user";

interface MemberListProps {
  users: User[];
}

export function MemberList({ users }: MemberListProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Members</h2>
          <AddMemberContainer />
        </div>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-medium">{user.display_name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
