"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";
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
import { useOrganizationMutation } from "@/lib/api/organizations";
import {
  organizationNameTakenMessage,
  organizationNameInvalidMessage,
  validateOrganizationName,
} from "@/lib/api/organization-errors";
import { Organization, defaultOrganization } from "@/types/organization";

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /// When provided, the dialog edits this organization; otherwise it creates one.
  organization?: Organization;
  onSaved: () => void;
}

export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
  onSaved,
}: OrganizationFormDialogProps) {
  const isEdit = organization !== undefined;
  const { create, update, isLoading } = useOrganizationMutation();

  const [formData, setFormData] = useState({ name: "", logo: "" });
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: organization?.name ?? "",
      logo: organization?.logo ?? "",
    });
    setNameError(null);
  }, [organization, open]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "name") setNameError(null);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Send exactly what we validate (and what the backend stores): the trimmed
    // name — so a whitespace-padded value can't pass the pre-check yet differ
    // from what hits the wire.
    const name = formData.name.trim();
    const invalidName = validateOrganizationName(name);
    if (invalidName !== null) {
      setNameError(invalidName);
      return;
    }

    try {
      if (isEdit) {
        await update(organization.id, {
          ...organization,
          name,
          logo: formData.logo,
        });
        toast.success(`Organization "${name}" updated`);
      } else {
        await create({
          ...defaultOrganization(),
          name,
          logo: formData.logo,
        });
        toast.success(`Organization "${name}" created`);
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving organization:", error);
      const nameError =
        organizationNameTakenMessage(error) ??
        organizationNameInvalidMessage(error);
      if (nameError !== null) {
        setNameError(nameError);
      } else {
        toast.error(
          isEdit
            ? "There was an error updating the organization"
            : "There was an error creating the organization"
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit organization" : "Add organization"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this organization's details."
              : "Create a new organization on the platform."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter organization name"
                aria-invalid={nameError !== null}
                required
              />
              {nameError && (
                <p className="text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                name="logo"
                value={formData.logo}
                onChange={handleInputChange}
                placeholder="Optional logo URL"
              />
            </div>
          </div>
          <div className="pt-4">
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isEdit ? "Save changes" : "Create organization"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
