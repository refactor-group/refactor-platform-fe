import { useState } from "react";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { UserApi, useUserMutation } from "@/lib/api/organizations/users";
import {
  getUserDisplayRoles,
  getUserCoaches,
  getUserColleagues,
  getOrganizationMembershipRole,
} from "@/lib/utils/user-roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Send,
  UserPlus,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserMinus,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { AuthStore } from "@/lib/stores/auth-store";
import { Id, isForbiddenError, PERMISSION_DENIED_MESSAGE } from "@/types/general";
import {
  InviteStatus,
  Role,
  User,
  isAdminOrSuperAdmin,
  UserRoleState,
} from "@/types/user";
import {
  lastOrganizationAdminMessage,
  organizationArchivedMessage,
  roleChangeInvalidMessage,
  userBelongsToMultipleOrganizationsMessage,
  coachingHistoryMessage,
} from "@/lib/api/organization-errors";
import { toast } from "@/lib/toast";
import { AddRelationshipDialog } from "@/components/ui/members/add-relationship-dialog";

interface MemberCardProps {
  user: User;
  currentUserId: Id;
  userRelationships: CoachingRelationshipWithUserNames[];
  onRefresh: () => void;
  users: User[];
  currentUserRoleState: UserRoleState;
}

export function MemberCard({
  user,
  currentUserId,
  userRelationships,
  onRefresh,
  users,
  currentUserRoleState,
}: MemberCardProps) {
  const { currentOrganizationId, currentOrganization } =
    useCurrentOrganization();
  const { userSession } = useAuthStore((state: AuthStore) => state);

  // Extract user properties
  const { id: userId, first_name: firstName, last_name: lastName, email } = user;

  // Get display roles for this user
  const displayRoles = getUserDisplayRoles(user, currentOrganizationId, userRelationships);

  // Get coaches for this user
  const coaches = getUserCoaches(userId, userRelationships);
  const colleagues = getUserColleagues(userId, userRelationships);
  const { deleteNested: deleteUser, removeFromOrganization, updateRole } =
    useUserMutation(currentOrganizationId);

  const membershipRole = getOrganizationMembershipRole(
    user,
    currentOrganizationId
  );
  const isSelf = userSession.id === userId;
  // Guards a double-click from firing two PUTs.
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const handleRoleChange = async (role: Role) => {
    setPendingRole(role);
    setRoleError(null);
    try {
      await updateRole(currentOrganizationId, userId, role);
      toast.success(
        `${firstName} ${lastName} is ${
          role === Role.Admin ? "now" : "no longer"
        } an organization Admin`
      );
    } catch (error) {
      console.error("Error changing member role:", error);
      // An actionable state ("grant someone else Admin first"), not a failure:
      // it belongs on the row it concerns, where a toast wouldn't persist.
      const lastAdmin = lastOrganizationAdminMessage(error);
      if (lastAdmin) {
        setRoleError(lastAdmin);
        return;
      }
      toast.error(
        organizationArchivedMessage(error) ??
          roleChangeInvalidMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "Error changing member role")
      );
    } finally {
      setPendingRole(null);
    }
  };

  // Only admins and super admins can delete users (but not themselves)
  const canDeleteUser =
    currentUserRoleState.hasAccess &&
    userSession.id !== userId &&
    isAdminOrSuperAdmin(currentUserRoleState);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this member?")) {
      return;
    }

    try {
      await deleteUser(currentOrganizationId, userId);
      toast.success("Member deleted");
      onRefresh();
    } catch (error) {
      const history = coachingHistoryMessage(error, `${firstName} ${lastName}`);
      if (history !== null) {
        toast.error(history, {
          action: { label: "Remove from organization", onClick: () => setRemoveDialogOpen(true) },
        });
        return;
      }
      console.error("Error deleting member:", error);
      toast.error(
        userBelongsToMultipleOrganizationsMessage(error) ??
          organizationArchivedMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "Error deleting member")
      );
    }
  };

  const handleRemoveFromOrganization = async () => {
    setIsRemoving(true);

    try {
      await removeFromOrganization(currentOrganizationId, userId);
      toast.success(`${firstName} ${lastName} removed from this organization`);
      setRemoveDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error removing member from organization:", error);
      toast.error(
        lastOrganizationAdminMessage(error) ??
          organizationArchivedMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "Error removing member from this organization")
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const handleResendInvite = async () => {
    try {
      await UserApi.resendInvite(currentOrganizationId, userId);
      toast.success(`Invitation resent to ${email}`);
      onRefresh();
    } catch (err) {
      console.error("Error resending invitation:", err);
      toast.error(
        isForbiddenError(err) ? PERMISSION_DENIED_MESSAGE : "Couldn't resend the invitation"
      );
    }
  };

  const renderInviteStatusBadge = (status: InviteStatus | null) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "expired":
        return <Badge variant="destructive">Invitation Expired</Badge>;
      case "active":
      case null:
        return null;
      default: {
        const _exhaustive: never = status;
        throw new Error(`Unhandled invite status: ${_exhaustive}`);
      }
    }
  };

  const canResendInvite =
    user.invite_status === "expired" && isAdminOrSuperAdmin(currentUserRoleState);

  const [addRelationshipOpen, setAddRelationshipOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <h3 className="font-medium flex items-center gap-2">
          <span>
            {firstName} {lastName}
            {userId === currentUserId && " (You)"}
          </span>
          {renderInviteStatusBadge(user.invite_status)}
          {canResendInvite && (
            <Button
              variant="tertiary"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleResendInvite}
            >
              <Send className="mr-1 h-3 w-3" /> Resend
            </Button>
          )}
        </h3>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
        {displayRoles.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Roles:</span> {displayRoles.join(', ')}
          </p>
        )}
        {roleError && (
          <p role="alert" className="text-sm text-destructive">
            {roleError}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Coaches:</span> {coaches.length > 0 ? coaches.join(', ') : 'None'}
        </p>
        {colleagues.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Colleagues:</span> {colleagues.join(', ')}
          </p>
        )}
      </div>
      {isAdminOrSuperAdmin(currentUserRoleState) && (
        <DropdownMenu
          onOpenChange={(open) => {
            // A refusal from a previous attempt can be stale by the time the
            // menu is reopened (e.g. another member was made an admin since).
            if (open) setRoleError(null);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">
                Actions for {firstName} {lastName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAddRelationshipOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Pair with…
            </DropdownMenuItem>
            {/* Gated locally as well as by the menu's own admin check, so the
                guarantee survives a restructure of this menu. */}
            {isAdminOrSuperAdmin(currentUserRoleState) &&
              membershipRole.some &&
              !isSelf &&
              (membershipRole.val === Role.User ? (
                <DropdownMenuItem
                  onClick={() => handleRoleChange(Role.Admin)}
                  disabled={pendingRole !== null}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" /> Grant organization admin access
                </DropdownMenuItem>
              ) : membershipRole.val === Role.Admin ? (
                <DropdownMenuItem
                  onClick={() => handleRoleChange(Role.User)}
                  disabled={pendingRole !== null}
                >
                  <ShieldOff className="mr-2 h-4 w-4" /> Revoke organization admin access
                </DropdownMenuItem>
              ) : null)}
            {canDeleteUser && (
              <>
                {userId !== currentUserId && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => setRemoveDialogOpen(true)}>
                  <UserMinus className="mr-2 h-4 w-4" /> Remove from organization
                </DropdownMenuItem>
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

      {/* Remove from organization confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {firstName} {lastName} from{" "}
              {currentOrganization?.name ?? "this organization"}
            </AlertDialogTitle>
            {/* asChild because the description holds two paragraphs, and
                AlertDialogDescription renders a <p> that cannot nest them. */}
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  They immediately lose access to this organization&apos;s
                  coaching sessions, notes and actions.
                </p>
                <p>
                  <span className="italic text-foreground">
                    Nothing is deleted.
                  </span>{" "}
                  Their coaching history stays with the people they work with
                  here. Their account and other organizations are unaffected.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemoveFromOrganization();
              }}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {addRelationshipOpen && (
        <AddRelationshipDialog
          organizationId={currentOrganizationId}
          member={user}
          members={users}
          relationships={userRelationships}
          onClose={() => setAddRelationshipOpen(false)}
          onRelationshipsChanged={onRefresh}
        />
      )}
    </div>
  );
}
