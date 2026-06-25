"use client";

import { useState } from "react";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrganizationApi } from "@/lib/api/organizations";
import { Organization, isOrganizationArchived } from "@/types/organization";
import { OrganizationFormDialog } from "./organization-form-dialog";
import { DeleteOrganizationDialog } from "./delete-organization-dialog";
import { OrganizationArchivedByline } from "./organization-archived-byline";

interface OrganizationRowProps {
  organization: Organization;
  onChanged: () => void;
}

export function OrganizationRow({
  organization,
  onChanged,
}: OrganizationRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const archived = isOrganizationArchived(organization);

  const created =
    typeof organization.created_at === "string"
      ? DateTime.fromISO(organization.created_at)
      : organization.created_at;

  const handleArchiveToggle = async () => {
    setIsArchiving(true);
    try {
      if (archived) {
        await OrganizationApi.unarchive(organization.id);
        toast.success(`Organization "${organization.name}" unarchived`);
      } else {
        await OrganizationApi.archive(organization.id);
        toast.success(`Organization "${organization.name}" archived`);
      }
      onChanged();
    } catch (error) {
      console.error("Error toggling organization archive:", error);
      toast.error(
        archived
          ? "There was an error unarchiving the organization"
          : "There was an error archiving the organization"
      );
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate flex items-center gap-2">
          <span className="truncate">{organization.name}</span>
          {archived && <Badge variant="secondary">Archived</Badge>}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {organization.slug}
        </p>
        {created.isValid && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Created {created.toLocaleString(DateTime.DATE_MED)}
          </p>
        )}
        {archived && <OrganizationArchivedByline organization={organization} />}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Organization actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchiveToggle} disabled={isArchiving}>
            {archived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OrganizationFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        organization={organization}
        onSaved={onChanged}
      />
      <DeleteOrganizationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        organization={organization}
        onDeleted={onChanged}
      />
    </div>
  );
}
