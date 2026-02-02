"use client";

import { WelcomeHeader } from "./welcome-header";
import { AddNewButton } from "./add-new-button";

interface DashboardHeaderProps {
  onCreateSession: () => void;
}

/**
 * DashboardHeader Component
 *
 * Combines the welcome message with the Add New button in a flex layout.
 * The Add New button is conditionally rendered based on user role.
 */
export function DashboardHeader({ onCreateSession }: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <WelcomeHeader />
      <AddNewButton onCreateSession={onCreateSession} />
    </div>
  );
}
