"use client";

import { useState } from "react";
import { DateTime } from "ts-luxon";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Organization } from "@/types/organization";
import { OrganizationFormDialog } from "./organization-form-dialog";
import { DeleteOrganizationDialog } from "./delete-organization-dialog";

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

  const created =
    typeof organization.created_at === "string"
      ? DateTime.fromISO(organization.created_at)
      : organization.created_at;

  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{organization.name}</h3>
        <p className="text-sm text-muted-foreground truncate">
          {organization.slug}
        </p>
        {created.isValid && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Created {created.toLocaleString(DateTime.DATE_MED)}
          </p>
        )}
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
