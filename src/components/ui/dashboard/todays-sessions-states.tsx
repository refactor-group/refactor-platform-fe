import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { WelcomeHeader } from "./welcome-header";
import { cn } from "@/components/lib/utils";

/**
 * Props for state components
 */
interface StateComponentProps {
  /** User's first name for personalized greeting */
  firstName?: string;
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * LoadingState Component
 *
 * Displays a loading spinner while sessions are being fetched.
 * Shows the welcome header and a centered spinner.
 *
 * @param props - Component props
 * @returns The rendered loading state
 */
export function LoadingState({ firstName, className }: StateComponentProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <WelcomeHeader firstName={firstName} />
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    </div>
  );
}

/**
 * ErrorState Component
 *
 * Displays an error message when sessions fail to load.
 * Wrapped in a card with the welcome header.
 *
 * @param props - Component props
 * @returns The rendered error state
 */
export function ErrorState({ firstName, className }: StateComponentProps) {
  return (
    <Card className={cn("mb-8", className)}>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Welcome {firstName}!
        </CardTitle>
        <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">
            Failed to load sessions. Please try again later.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * EmptyState Component
 *
 * Displays a friendly message when no sessions are scheduled for today.
 * Wrapped in a card with the welcome header.
 *
 * @param props - Component props
 * @returns The rendered empty state
 */
export function EmptyState({ firstName, className }: StateComponentProps) {
  return (
    <Card className={cn("mb-8", className)}>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Welcome {firstName}!
        </CardTitle>
        <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            No coaching sessions scheduled for today. Enjoy your day!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
