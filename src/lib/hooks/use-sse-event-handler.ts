"use client";

import { useEffect, useRef } from 'react';
import type { SSEEvent } from '@/types/sse-events';
import { useSSEConnectionStore } from '@/lib/contexts/sse-connection-context';
import { transformEntityDates } from '@/types/general';

export function useSSEEventHandler<T extends SSEEvent['type']>(
  eventSource: EventSource | null,
  eventType: T,
  handler: (event: Extract<SSEEvent, { type: T }>) => void
) {
  const handlerRef = useRef(handler);
  const recordEvent = useSSEConnectionStore((store) => store.recordEvent);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventSource) return;

    const listener = (e: MessageEvent) => {
      try {
        const parsed: SSEEvent = JSON.parse(e.data);
        const transformed = transformEntityDates(parsed) as SSEEvent;

        if (transformed.type === eventType) {
          recordEvent();
          handlerRef.current(transformed as Extract<SSEEvent, { type: T }>);
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
