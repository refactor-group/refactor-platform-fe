"use client";

import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useLogoutUser } from '@/lib/hooks/use-logout-user';
import { useSseEventHandler } from './use-sse-event-handler';

export function useSseSystemEvents(eventSource: EventSource | null) {
  const logout = useLogoutUser();
  const isLoggedIn = useAuthStore((store) => store.isLoggedIn);

  useSseEventHandler(eventSource, 'force_logout', async (event) => {
    console.warn('[SSE] Force logout received:', event.data.reason);

    if (isLoggedIn) {
      await logout();
    }
  });
}
