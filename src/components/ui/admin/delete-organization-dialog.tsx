"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { useOrganizationMutation } from "@/lib/api/organizations";
import { EntityApiError } from "@/types/entity-api-error";
import { Organization } from "@/types/organization";

interface DeleteOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
  onDeleted: () => void;
}

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  organization,
  onDeleted,
}: DeleteOrganizationDialogProps) {
  const { delete: deleteOrganization } = useOrganizationMutation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteOrganization(organization.id);
      toast.success(`Organization "${organization.name}" deleted`);
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting organization:", error);
      if (
        EntityApiError.isEntityApiError(error) &&
        error.data?.error === "organization_not_empty"
      ) {
        toast.error(
          error.data?.message ??
            "This organization still has members or coaching data and can't be deleted. Archive it instead."
        );
      } else {
        toast.error("There was an error deleting the organization");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete organization</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <strong>{organization.name}</strong> and may
            affect its members, coaching relationships, and sessions. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
