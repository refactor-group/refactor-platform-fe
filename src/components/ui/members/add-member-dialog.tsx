"use client";

import type React from "react";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserMutation } from "@/lib/api/organizations/users";
import { UserApi } from "@/lib/api/users";
import {
  organizationArchivedMessage,
  userAlreadyInOrganizationMessage,
} from "@/lib/api/organization-errors";
import {
  NewUser,
  Role,
  User,
  UserLookupResult,
  UserRoleState,
  isAdminOrSuperAdmin,
} from "@/types/user";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { type Option, None } from "@/types/option";
import { toast } from "sonner";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { isForbiddenError, PERMISSION_DENIED_MESSAGE } from "@/types/general";

/// Sentinel for the "no coach" option, since Select cannot hold an empty value.
const NO_COACH = "none";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
  /// Omitted for callers that only offer creating a brand new member
  currentUserRoleState?: UserRoleState;
  /// Candidates offered when pre-assigning a coach. Omitted hides the field.
  organizationMembers?: User[];
  /// Product name, threaded from the page rather than read from global config.
  productName: string;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  onMemberAdded,
  currentUserRoleState,
  organizationMembers,
  productName,
}: AddMemberDialogProps) {
  const { currentOrganizationId, currentOrganization } =
    useCurrentOrganization();

  const { createNested: createUserNested, attachExisting } = useUserMutation(
    currentOrganizationId,
  );
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
  });
  const [lookupEmail, setLookupEmail] = useState("");
  const [foundUser, setFoundUser] = useState<Option<UserLookupResult>>(None);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [existingRole, setExistingRole] = useState<Role>(Role.User);
  const [isAdding, setIsAdding] = useState(false);
  const [coachId, setCoachId] = useState<string>(NO_COACH);
  /// Identifies the newest lookup, so a slower earlier one cannot land on top of it.
  const lookupRequest = useRef(0);

  // Org admins get this too, not just super admins
  const canAddExisting =
    !!currentUserRoleState && isAdminOrSuperAdmin(currentUserRoleState);

  /// The chosen coach, or undefined to leave the key off the request entirely.
  const selectedCoachId = coachId === NO_COACH ? undefined : coachId;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newUser: NewUser = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      display_name: formData.displayName,
      email: formData.email,
      timezone: getBrowserTimezone(), // Default to browser timezone for new users
      ...(selectedCoachId ? { coach_id: selectedCoachId } : {}),
    };

    try {
      await createUserNested(currentOrganizationId, newUser);
      setFormData({
        firstName: "",
        lastName: "",
        displayName: "",
        email: "",
      });
      setCoachId(NO_COACH);
      onMemberAdded();
      const name = `${formData.firstName} ${formData.lastName}`;
      toast.success(`New Member ${name} added successfully`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(
        organizationArchivedMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "There was an error adding the member"),
      );
    }
  };

  const handleFind = async () => {
    const request = ++lookupRequest.current;
    setFoundUser(None);
    setLookupMessage(null);
    setIsLookingUp(true);

    try {
      const result = await UserApi.lookupByEmail(lookupEmail);
      // Editing the email, or starting another lookup, supersedes this one.
      // Without the check a slow reply repopulates the card for an address the
      // field no longer shows, and Add attaches that user instead.
      if (lookupRequest.current !== request) return;
      // None also covers a real user outside this admin's scope. The backend
      // makes those cases indistinguishable, so the copy must too.
      if (result.some) {
        setFoundUser(result);
      } else {
        setLookupMessage("No user found with that email.");
      }
    } catch (error) {
      if (lookupRequest.current !== request) return;
      console.error("Error looking up user:", error);
      setLookupMessage(
        isForbiddenError(error)
          ? PERMISSION_DENIED_MESSAGE
          : "There was an error looking up that email.",
      );
    } finally {
      if (lookupRequest.current === request) setIsLookingUp(false);
    }
  };

  const resetLookup = () => {
    setLookupEmail("");
    setFoundUser(None);
    setLookupMessage(null);
    setExistingRole(Role.User);
    setCoachId(NO_COACH);
  };

  // A found user belongs to the email that produced it, so editing the field
  // invalidates it. Without this the Add button can act on a stale selection
  // while the field shows a different address.
  const handleLookupEmailChange = (value: string) => {
    lookupRequest.current += 1;
    setLookupEmail(value);
    setFoundUser(None);
    setLookupMessage(null);
    setIsLookingUp(false);
  };

  const handleAddExisting = async () => {
    if (foundUser.none) return;
    const target = foundUser.val;
    setIsAdding(true);

    try {
      await attachExisting(
        currentOrganizationId,
        target.id,
        existingRole,
        selectedCoachId,
      );
      onMemberAdded();
      const name = `${target.first_name} ${target.last_name}`;
      toast.success(`${name} added to this organization`);
      resetLookup();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding existing user:", error);
      toast.error(
        userAlreadyInOrganizationMessage(error) ??
          organizationArchivedMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "There was an error adding the member"),
      );
    } finally {
      setIsAdding(false);
    }
  };

  /// Optional coach picker. `excludeId` keeps a member off their own coach list.
  const coachField = (excludeId?: string) =>
    organizationMembers &&
    organizationMembers.length > 0 && (
      <div className="space-y-2">
        <Label htmlFor="coach">Coach (optional)</Label>
        <Select value={coachId} onValueChange={setCoachId}>
          <SelectTrigger id="coach" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_COACH}>No coach</SelectItem>
            {organizationMembers
              .filter((member) => member.id !== excludeId)
              .map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );

  const createMemberForm = (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            placeholder="Enter first name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            placeholder="Enter last name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleInputChange}
            placeholder="Enter display name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email address"
            required
          />
        </div>
        {coachField()}
      </div>
      <div className="pt-4">
        <DialogFooter>
          <Button type="submit">Create Member</Button>
        </DialogFooter>
      </div>
    </form>
  );

  const addExistingForm = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add a user that already has an account. Adding them here gives them
        access to the organization{" "}
        {currentOrganization?.name ?? "you are viewing"} using their existing
        profile.
      </p>
      <div className="space-y-2">
        <Label htmlFor="lookupEmail">Email</Label>
        <div className="flex gap-2">
          <Input
            id="lookupEmail"
            name="lookupEmail"
            type="email"
            value={lookupEmail}
            onChange={(e) => handleLookupEmailChange(e.target.value)}
            placeholder="Enter email address"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleFind}
            disabled={isLookingUp || lookupEmail.trim().length === 0}
          >
            {isLookingUp ? "Finding..." : "Find"}
          </Button>
        </div>
      </div>
      {lookupMessage && (
        <p className="text-sm text-destructive">{lookupMessage}</p>
      )}
      {foundUser.some && (
        <div className="flex items-start justify-between gap-2 rounded-md border p-3">
          <div>
            <p className="font-medium">
              {foundUser.val.first_name} {foundUser.val.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {foundUser.val.email}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetLookup}
            aria-label={`Clear ${foundUser.val.first_name} ${foundUser.val.last_name}`}
          >
            Clear
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="existingRole">Role</Label>
        <Select
          value={existingRole}
          onValueChange={(value) => setExistingRole(value as Role)}
        >
          <SelectTrigger id="existingRole" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* "Member" is the recipient-facing word for Role.User */}
            <SelectItem value={Role.User}>Member</SelectItem>
            <SelectItem value={Role.Admin}>Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {coachField(foundUser.some ? foundUser.val.id : undefined)}
      <DialogFooter>
        <Button
          type="button"
          onClick={handleAddExisting}
          disabled={foundUser.none || isAdding}
        >
          Add to organization
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            {canAddExisting
              ? `Create a new member account, or add someone who already has a ${productName} account.`
              : "Create a new member account. They'll receive an email with a link to set up their password."}
          </DialogDescription>
        </DialogHeader>
        {canAddExisting ? (
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create new member</TabsTrigger>
              <TabsTrigger value="existing">Add existing member</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="mt-4">
              {createMemberForm}
            </TabsContent>
            <TabsContent value="existing" className="mt-4">
              {addExistingForm}
            </TabsContent>
          </Tabs>
        ) : (
          createMemberForm
        )}
      </DialogContent>
    </Dialog>
  );
}
