"use client";

import { SchedulingPreferencesSection } from "@/components/ui/settings/scheduling-preferences-section";

export default function PreferencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Scheduling</h2>
        <p className="text-sm text-muted-foreground">
          Set defaults that pre-fill when you schedule sessions.
        </p>
      </div>
      <SchedulingPreferencesSection />
    </div>
  );
}
