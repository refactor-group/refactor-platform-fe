"use client";

import { useEffect, useRef } from 'react';
import type { SseEvent } from '@/types/sse-events';
import { useSseConnectionStore } from '@/lib/contexts/sse-connection-context';
import { transformEntityDates } from '@/types/general';

export function useSseEventHandler<T extends SseEvent['type']>(
  eventSource: EventSource | null,
  eventType: T,
  handler: (event: Extract<SseEvent, { type: T }>) => void
) {
  const handlerRef = useRef(handler);
  const recordEvent = useSseConnectionStore((store) => store.recordEvent);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventSource) return;

    const listener = (e: MessageEvent) => {
      try {
        const parsed: SseEvent = JSON.parse(e.data);
        const transformed = transformEntityDates(parsed) as SseEvent;

        if (transformed.type === eventType) {
          recordEvent();
          handlerRef.current(transformed as Extract<SseEvent, { type: T }>);
        }
      } catch (error) {
        console.error(`[SSE] Failed to parse ${eventType} event:`, error, e.data);
      }
    };

    eventSource.addEventListener(eventType, listener);

    return () => {
      eventSource.removeEventListener(eventType, listener);
    };
  }, [eventSource, eventType, recordEvent]);
}
