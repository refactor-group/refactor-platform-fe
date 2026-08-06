"use client";

import type React from "react";

import { useState } from "react";
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
  UserLookupResult,
  UserRoleState,
  isAdminOrSuperAdmin,
} from "@/types/user";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { toast } from "sonner";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { isForbiddenError, PERMISSION_DENIED_MESSAGE } from "@/types/general";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
  /// Omitted for callers that only offer creating a brand new member
  currentUserRoleState?: UserRoleState;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  onMemberAdded,
  currentUserRoleState,
}: AddMemberDialogProps) {
  const { currentOrganizationId } = useCurrentOrganization();

  const { createNested: createUserNested, attachExisting } = useUserMutation(
    currentOrganizationId
  );
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
  });
  const [lookupEmail, setLookupEmail] = useState("");
  const [foundUser, setFoundUser] = useState<UserLookupResult | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [existingRole, setExistingRole] = useState<Role>(Role.User);
  const [isAdding, setIsAdding] = useState(false);

  // Org admins get this too, not just super admins
  const canAddExisting =
    !!currentUserRoleState && isAdminOrSuperAdmin(currentUserRoleState);

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
    };

    try {
      await createUserNested(currentOrganizationId, newUser);
      setFormData({
        firstName: "",
        lastName: "",
        displayName: "",
        email: "",
      });
      onMemberAdded();
      toast.success(`New Member ${formData.firstName} ${formData.lastName} added successfully`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(
        organizationArchivedMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "There was an error adding the member")
      );
    }
  };

  const handleFind = async () => {
    setFoundUser(null);
    setLookupMessage(null);
    setIsLookingUp(true);

    try {
      const result = await UserApi.lookupByEmail(lookupEmail);
      // A null result also covers a real user outside this admin's scope. The
      // backend makes those cases indistinguishable, so the copy must too.
      if (result) {
        setFoundUser(result);
      } else {
        setLookupMessage("No user found with that email.");
      }
    } catch (error) {
      console.error("Error looking up user:", error);
      setLookupMessage(
        isForbiddenError(error)
          ? PERMISSION_DENIED_MESSAGE
          : "There was an error looking up that email."
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const resetLookup = () => {
    setLookupEmail("");
    setFoundUser(null);
    setLookupMessage(null);
    setExistingRole(Role.User);
  };

  // A found user belongs to the email that produced it, so editing the field
  // invalidates it. Without this the Add button can act on a stale selection
  // while the field shows a different address.
  const handleLookupEmailChange = (value: string) => {
    setLookupEmail(value);
    setFoundUser(null);
    setLookupMessage(null);
  };

  const handleAddExisting = async () => {
    if (!foundUser) return;
    setIsAdding(true);

    try {
      await attachExisting(currentOrganizationId, foundUser.id, existingRole);
      onMemberAdded();
      toast.success(
        `${foundUser.first_name} ${foundUser.last_name} added to this organization`
      );
      resetLookup();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding existing user:", error);
      toast.error(
        userAlreadyInOrganizationMessage(error) ??
          organizationArchivedMessage(error) ??
          (isForbiddenError(error)
            ? PERMISSION_DENIED_MESSAGE
            : "There was an error adding the member")
      );
    } finally {
      setIsAdding(false);
    }
  };

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
        This person already has a Refactor account. Adding them here gives them
        access to this organization using their existing profile.
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
            Find
          </Button>
        </div>
      </div>
      {lookupMessage && (
        <p className="text-sm text-destructive">{lookupMessage}</p>
      )}
      {foundUser && (
        <div className="flex items-start justify-between gap-2 rounded-md border p-3">
          <div>
            <p className="font-medium">
              {foundUser.first_name} {foundUser.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{foundUser.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetLookup}
            aria-label={`Clear ${foundUser.first_name} ${foundUser.last_name}`}
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
      <DialogFooter>
        <Button
          type="button"
          onClick={handleAddExisting}
          disabled={!foundUser || isAdding}
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
              ? "Create a new member account, or add someone who already has a Refactor account."
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
