"use client";

import { CoachingPreferencesSection } from "@/components/ui/settings/coaching-preferences-section";

export default function PreferencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Coaching Sessions</h2>
        <p className="text-sm text-muted-foreground">
          Set defaults that pre-fill when you schedule coaching sessions.
        </p>
      </div>
      <CoachingPreferencesSection />
    </div>
  );
}
