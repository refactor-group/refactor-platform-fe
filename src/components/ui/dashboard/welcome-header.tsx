"use client";

import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { formatWeekdayDate } from "@/lib/utils/date";

/**
 * WelcomeHeader Component
 *
 * Displays a personalized welcome message with the user's first name
 * and today's date.
 */
export function WelcomeHeader() {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const todayFormatted = formatWeekdayDate(DateTime.now());

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
        Welcome {userSession?.first_name}!
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Today is {todayFormatted}
      </p>
    </div>
  );
}
