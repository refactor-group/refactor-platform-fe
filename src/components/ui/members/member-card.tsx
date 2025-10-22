import { useState } from "react";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { useUserMutation } from "@/lib/api/organizations/users";
import { getUserDisplayRoles, getUserCoaches } from "@/lib/utils/user-roles";
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
  DialogDescription,
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
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { AuthStore } from "@/lib/stores/auth-store";
import { Id } from "@/types/general";
import { User, Role, isAdminOrSuperAdmin } from "@/types/user";
import { RelationshipRole } from "@/types/relationship-role";
import { useCoachingRelationshipMutation } from "@/lib/api/coaching-relationships";
import { toast } from "sonner";

interface MemberCardProps {
  user: User;
  currentUserId: Id;
  userRelationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
  users: User[];
}

interface Member {
  id: Id;
  first_name: string;
  last_name: string;
}

export function MemberCard({
  user,
  currentUserId,
  userRelationships,
  onRefresh,
  users,
}: MemberCardProps) {
  const { currentOrganizationId } = useCurrentOrganization();
  const { isACoach, userSession } = useAuthStore((state: AuthStore) => state);
  const currentUserRoleState = useCurrentUserRole();

  // Extract user properties
  const { id: userId, first_name: firstName, last_name: lastName, email } = user;

  // Get display roles for this user
  const displayRoles = getUserDisplayRoles(user, currentOrganizationId, userRelationships);

  // Get coaches for this user
  const coaches = getUserCoaches(userId, userRelationships);
  const { error: deleteError, deleteNested: deleteUser } = useUserMutation(
    currentOrganizationId
  );
  const { error: createError, createNested: createRelationship } =
    useCoachingRelationshipMutation(currentOrganizationId);

  console.log("is a coach", isACoach);

  // Check if current user is a coach in any of this user's relationships
  // and make sure we can't delete ourselves. Admins and SuperAdmins can delete any user.
  const canDeleteUser =
    currentUserRoleState.hasAccess &&
    userSession.id !== userId &&
    (
      userRelationships?.some(
        (rel) => rel.coach_id === userSession.id
      ) ||
      isAdminOrSuperAdmin(currentUserRoleState)
    );

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this member?")) {
      return;
    }
    await deleteUser(currentOrganizationId, userId);
    onRefresh();

    if (deleteError) {
      console.error("Error deleting member:", deleteError);
      toast.error("Error deleting member");
      onRefresh();
      return;
    }
    toast.success("Member deleted successfully");
    onRefresh();
  };

  const handleAssignMember = (val: string) => {
    const user = users.find((m) => m.id === val);
    if (!user) return;
    const member: Member = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
    };
    setAssignedMember(member);
  };

  // Placeholder – actual UI flows will be implemented later
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<RelationshipRole>(RelationshipRole.Coach);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [assignedMember, setAssignedMember] = useState<Member | null>(null);

  const handleCreateCoachingRelationship = async () => {
    if (!selectedMember || !assignedMember) return;

    try {
      if (assignMode === RelationshipRole.Coach) {
        console.log("Assign", selectedMember.id, "as coach for", userId);
        await createRelationship(currentOrganizationId, {
          coach_id: assignedMember.id,
          coachee_id: selectedMember.id,
        });
      } else {
        console.log("Assign", selectedMember.id, "as coachee for", userId);
        await createRelationship(currentOrganizationId, {
          coach_id: selectedMember.id,
          coachee_id: assignedMember.id,
        });
      }

      toast.success(
        `Successfully assigned ${assignedMember.first_name} ${assignedMember.last_name} as ${assignMode} for ${selectedMember.first_name} ${selectedMember.last_name}`
      );
      onRefresh();
      setAssignDialogOpen(false);
      setSelectedMember(null);
      setAssignedMember(null);
    } catch (error) {
      toast.error(`Error assigning ${assignMode}`);
      console.error("Error creating coaching relationship:", error);
    }
  };

  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <h3 className="font-medium">
          {firstName} {lastName}
          {userId === currentUserId && " (You)"}
        </h3>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
        {displayRoles.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Roles:</span> {displayRoles.join(', ')}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Coaches:</span> {coaches.length > 0 ? coaches.join(', ') : 'None'}
        </p>
      </div>
      {(isAdminOrSuperAdmin(currentUserRoleState) || canDeleteUser) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isAdminOrSuperAdmin(currentUserRoleState) && (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    setAssignMode(RelationshipRole.Coach);
                    setAssignDialogOpen(true);
                    setSelectedMember({
                      id: userId,
                      first_name: firstName,
                      last_name: lastName,
                    });
                  }}
                >
                  Assign Coach
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setAssignMode(RelationshipRole.Coachee);
                    setAssignDialogOpen(true);
                    setSelectedMember({
                      id: userId,
                      first_name: firstName,
                      last_name: lastName,
                    });
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
      )}

      {/* Assign Coach/Coachee Modal */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignMode === RelationshipRole.Coach ? "Assign Coach" : "Assign Coachee"}
            </DialogTitle>
            <DialogDescription>
              Select a member to be their{" "}
              {assignMode.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          <Select
            onValueChange={(val) => handleAssignMember(val)}
            value={assignedMember?.id?.toString()}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((m) => m.id !== userId)
                .map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id.toString()}
                  >{`${m.first_name} ${m.last_name}`}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleCreateCoachingRelationship}>
              {assignMode === RelationshipRole.Coach ? "Assign as Coach" : "Assign as Coachee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
