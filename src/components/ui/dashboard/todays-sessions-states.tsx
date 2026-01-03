import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/components/lib/utils";

/**
 * Props for state components
 */
interface StateComponentProps {
  /** User's first name for personalized greeting (unused, kept for API compatibility) */
  firstName?: string;
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * LoadingState Component
 *
 * Displays a loading spinner while sessions are being fetched.
 *
 * @param props - Component props
 * @returns The rendered loading state
 */
export function LoadingState({ className }: StateComponentProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          Today&apos;s Sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ErrorState Component
 *
 * Displays an error message when sessions fail to load.
 *
 * @param props - Component props
 * @returns The rendered error state
 */
export function ErrorState({ className }: StateComponentProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          Today&apos;s Sessions
        </CardTitle>
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
 *
 * @param props - Component props
 * @returns The rendered empty state
 */
export function EmptyState({ className }: StateComponentProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          Today&apos;s Sessions
        </CardTitle>
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
