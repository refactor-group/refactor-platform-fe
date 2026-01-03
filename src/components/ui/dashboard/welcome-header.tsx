"use client";

import { useAuthStore } from "@/lib/providers/auth-store-provider";

/**
 * WelcomeHeader Component
 *
 * Displays a personalized welcome message with the user's first name.
 */
export function WelcomeHeader() {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  return (
    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
      Welcome {userSession?.first_name}!
    </h2>
  );
}
