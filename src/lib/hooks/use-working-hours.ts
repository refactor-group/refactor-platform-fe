import { useUser } from "@/lib/api/users";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { WorkingHours } from "@/lib/scheduling";
import { workingHoursOf } from "@/lib/working-hours";
import { None, Some } from "@/types/option";

export function useWorkingHours(): WorkingHours {
  const { user } = useUser(useAuthStore((s) => s.userId));
  return workingHoursOf(user ? Some(user) : None);
}
