import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { MemberCard } from "@/components/ui/member-management/member-card";
import { AddMemberDialog } from "@/components/ui/member-management/add-member-dialog";
import { AddMemberButton } from "@/components/ui/member-management/add-member-button";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship_with_user_names";
import { UserCategory } from "@/types/user-category";

interface MemberListProps {
  memberType: UserCategory;
  relationships: CoachingRelationshipWithUserNames[];
}

export function MemberList({ memberType, relationships }: MemberListProps) {
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);

  const title = memberType === "coach" ? "Coaches" : "Coachees";

  const members = relationships.map((rel) => ({
    id: memberType === "coach" ? rel.coachee_id : rel.coach_id,
    firstName:
      memberType === "coach" ? rel.coachee_first_name : rel.coach_first_name,
    lastName:
      memberType === "coach" ? rel.coachee_last_name : rel.coach_last_name,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Dialog
          open={isAddMemberDialogOpen}
          onOpenChange={setIsAddMemberDialogOpen}
        >
          <AddMemberButton memberType={memberType} />
          <AddMemberDialog
            open={isAddMemberDialogOpen}
            onOpenChange={setIsAddMemberDialogOpen}
            memberType={memberType}
          />
        </Dialog>
      </div>
      <div className="rounded-lg border bg-card">
        {members.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            No {title.toLowerCase()} found
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
