"use client";

import type React from "react";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    setFormData({
      name: organization?.name ?? "",
      logo: organization?.logo ?? "",
    });
  }, [organization, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEdit) {
        await update(organization.id, {
          ...organization,
          name: formData.name,
          logo: formData.logo,
        });
        toast.success(`Organization "${formData.name}" updated`);
      } else {
        await create({
          ...defaultOrganization(),
          name: formData.name,
          logo: formData.logo,
        });
        toast.success(`Organization "${formData.name}" created`);
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving organization:", error);
      toast.error(
        isEdit
          ? "There was an error updating the organization"
          : "There was an error creating the organization"
      );
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
                required
              />
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
