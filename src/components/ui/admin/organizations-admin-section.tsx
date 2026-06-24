"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAllOrganizations } from "@/lib/api/organizations";
import { OrganizationRow } from "./organization-row";
import { OrganizationFormDialog } from "./organization-form-dialog";

export function OrganizationsAdminSection() {
  const { organizations, isLoading, isError, refresh } = useAllOrganizations();
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = [...organizations].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
              No organizations yet.
            </p>
          ) : (
            <div className="space-y-4">
              {sorted.map((organization) => (
                <OrganizationRow
                  key={organization.id}
                  organization={organization}
                  onChanged={refresh}
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
