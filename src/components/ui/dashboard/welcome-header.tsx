import React from "react";

/**
 * Props for the WelcomeHeader component
 */
interface WelcomeHeaderProps {
  /** User's first name for personalized greeting */
  firstName?: string;
  /** Subtitle text to display below the welcome message */
  subtitle?: string;
}

/**
 * WelcomeHeader Component
 *
 * Displays a personalized welcome message with the user's first name
 * and an optional subtitle (e.g., "Today's Sessions").
 *
 * @param props - Component props
 * @returns The rendered welcome header
 *
 * @example
 * ```tsx
 * <WelcomeHeader firstName="John" subtitle="Today's Sessions" />
 * ```
 */
export function WelcomeHeader({ firstName, subtitle = "Today's Sessions" }: WelcomeHeaderProps) {
  return (
    <>
      <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
        Welcome {firstName}!
      </h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </>
  );
}
