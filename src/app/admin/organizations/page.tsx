"use client";

import { notFound } from "next/navigation";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { shouldDenyAdminAccess } from "@/app/admin/admin-access-control";
import { OrganizationsAdminSection } from "@/components/ui/admin/organizations-admin-section";

export default function AdminOrganizationsPage() {
  const roles = useAuthStore((state) => state.userSession?.roles);

  if (shouldDenyAdminAccess(roles ?? [])) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Organizations</h2>
        <p className="text-sm text-muted-foreground">
          Create and manage every organization on the platform.
        </p>
      </div>
      <OrganizationsAdminSection />
    </div>
  );
}
