"use client";

import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useLogoutUser } from '@/lib/hooks/use-logout-user';
import { useSSEEventHandler } from './use-sse-event-handler';

export function useSSESystemEvents(eventSource: EventSource | null) {
  const logout = useLogoutUser();
  const _isLoggedIn = useAuthStore((store) => store.isLoggedIn);

  useSSEEventHandler(eventSource, 'force_logout', async (event) => {
    console.warn('[SSE] Force logout received:', event.data.reason);


    await logout();
  });
}
