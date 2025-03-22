import { MemberCard } from "@/components/ui/member-management/member-card";

interface MemberListProps {
  title?: string;
  members: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
}

export function MemberList({ title, members }: MemberListProps) {
  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <div className="rounded-lg border bg-card">
        {members.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            No {title?.toLowerCase() || "members"} found
          </div>
        ) : (
          <div>
            {members.map((member, index) => (
              <div key={member.id} className={index !== 0 ? "border-t" : ""}>
                <MemberCard
                  firstName={member.firstName}
                  lastName={member.lastName}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
