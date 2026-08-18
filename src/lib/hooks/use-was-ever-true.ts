import { useRef } from "react";

/**
 * Latches to `true` the first time `value` is `true`, and stays `true` for
 * the rest of this component's lifetime regardless of what `value` does
 * afterward. Unlike `usePrevious`, which only remembers one render back,
 * this survives however many renders follow -- needed because a single
 * transition (e.g. signing out) can trigger several of them in a row while
 * the live value stays `false` the whole time.
 *
 * Updates the ref during render rather than in an effect: an effect-based
 * update would itself only be one render ahead of the read, reintroducing
 * the exact problem this hook exists to avoid. The write is idempotent and
 * monotonic (false -> true, never back), so a discarded/replayed render
 * cannot produce a wrong answer, only (at worst) the same one early.
 */
export function useWasEverTrue(value: boolean): boolean {
  const ref = useRef(value);
  // eslint-disable-next-line react-hooks/refs -- intentional monotonic latch, see comment above
  if (value) ref.current = true;
  // eslint-disable-next-line react-hooks/refs -- same latch; reading what the line above just set
  return ref.current;
}
