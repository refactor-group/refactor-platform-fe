"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAllOrganizations } from "@/lib/api/organizations";
import { OrganizationStatusFilter } from "@/types/organization";
import { OrganizationRow } from "./organization-row";
import { OrganizationFormDialog } from "./organization-form-dialog";

const STATUS_FILTERS: { value: OrganizationStatusFilter; label: string }[] = [
  { value: OrganizationStatusFilter.Active, label: "Active" },
  { value: OrganizationStatusFilter.Archived, label: "Archived" },
  { value: OrganizationStatusFilter.All, label: "All" },
];

export function OrganizationsAdminSection() {
  const [status, setStatus] = useState<OrganizationStatusFilter>(
    OrganizationStatusFilter.Active
  );
  const { organizations, isLoading, isError, refresh } =
    useAllOrganizations(status);
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(
    () => [...organizations].sort((a, b) => a.name.localeCompare(b.name)),
    [organizations]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(value) => {
            if (value) setStatus(value as OrganizationStatusFilter);
          }}
          className="justify-start"
        >
          {STATUS_FILTERS.map((filter) => (
            <ToggleGroupItem
              key={filter.value}
              value={filter.value}
              aria-label={filter.label}
            >
              {filter.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add organization
        </Button>
      </div>

      <Card className="w-full border shadow-none">
        <CardContent className="p-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading organizations...
            </p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Couldn&apos;t load organizations.
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {status === OrganizationStatusFilter.Archived
                ? "No archived organizations."
                : "No organizations yet."}
            </p>
          ) : (
            <div className="space-y-4">
              {sorted.map((organization) => (
                <OrganizationRow
                  key={organization.id}
                  organization={organization}
                  onChanged={refresh}
                  showArchivedBadge={status === OrganizationStatusFilter.All}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrganizationFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />
    </div>
  );
}
