import { useState } from "react";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserMutation } from "@/lib/api/organizations/users";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship_with_user_names";
import { OrganizationStateStore } from "@/lib/stores/organization-state-store";
import { AuthStore } from "@/lib/stores/auth-store";
import { Id } from "@/types/general";
import { User, Role } from "@/types/user";

interface MemberCardProps {
  firstName: string;
  lastName: string;
  email: string;
  userId: Id;
  userRelationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
  users: User[];
}

export function MemberCard({
  firstName,
  lastName,
  email,
  userId,
  userRelationships,
  onRefresh,
  users,
}: MemberCardProps) {
  const currentOrganizationId = useOrganizationStateStore(
    (state: OrganizationStateStore) => state.currentOrganizationId
  );
  const { userSession } = useAuthStore((state: AuthStore) => state);
  const { deleteNested: deleteUser } = useUserMutation(currentOrganizationId);

  // Check if current user is a coach in any of this user's relationships
  // and make sure we can't delete ourselves. Admins can delete any user.
  const canDeleteUser = userRelationships?.some(
    (rel) => rel.coach_id === userSession.id && userId !== userSession.id
  ) || (userSession.role === Role.Admin && userSession.id !== userId);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this member?")) {
      return;
    }

    try {
      await deleteUser(currentOrganizationId, userId);
      onRefresh();
    } catch (error) {
      console.error("Error deleting user:", error);
      // TODO: Show an error toast here once we start using toasts for showing operation results.
    }
  };

  // Placeholder – actual UI flows will be implemented later
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"coach" | "coachee">("coach");
  const [selectedMemberId, setSelectedMemberId] = useState<Id | null>(null);

  const handleCreateCoachingRelationship = () => {
    if (!selectedMemberId) return;
    if (assignMode === "coach") {
      console.log("Assign", selectedMemberId, "as coach for", userId);
    } else {
      console.log("Assign", selectedMemberId, "as coachee for", userId);
    }
    // TODO: call mutation
    setAssignDialogOpen(false);
    setSelectedMemberId(null);
  };

  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <h3 className="font-medium">
          {firstName} {lastName}
        </h3>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {userSession.role === Role.Admin && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setAssignMode("coach");
                  setAssignDialogOpen(true);
                }}
              >
                Assign Coach
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAssignMode("coachee");
                  setAssignDialogOpen(true);
                }}
              >
                Assign Coachee
              </DropdownMenuItem>
            </>
          )}
          {canDeleteUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assign Coach/Coachee Modal */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignMode === "coach" ? "Assign Coach" : "Assign Coachee"}
            </DialogTitle>
          </DialogHeader>
          <Select
            onValueChange={(val) => setSelectedMemberId(val as Id)}
            value={selectedMemberId ?? undefined}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((m) => m.id !== userId)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>{`${m.first_name} ${m.last_name}`}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleCreateCoachingRelationship}>{assignMode === "coach" ? "Assign as Coach" : "Assign as Coachee"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
