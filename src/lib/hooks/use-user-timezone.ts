import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { getBrowserTimezone } from "@/lib/timezone-utils";

/** The profile's time zone once signed in, else the browser's. */
export function useUserTimezone(): string {
  const { userSession } = useAuthStore((state) => ({ userSession: state.userSession }));
  // The signed-out default user (no id) carries "UTC", which isn't anyone's choice.
  return (userSession?.id && userSession.timezone) || getBrowserTimezone();
}
