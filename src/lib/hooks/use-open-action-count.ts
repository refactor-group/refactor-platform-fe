import type { SWRConfiguration } from "swr";
import {
  DEFAULT_ACTIONS_VIEW,
  countVisibleActions,
  useActionsView,
} from "@/lib/hooks/use-actions-view";

// Fetch once, then serve the cache: action saves, accepted suggestions and SSE
// events revalidate the actions (and session saves the sessions), so nothing
// else needs to. `revalidateOnMount: undefined` clears the list hooks' `true`,
// letting revalidateIfStale decide.
const CACHED_ONLY: SWRConfiguration = {
  revalidateOnMount: undefined,
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

/** The number of cards the Actions page shows in its default view; 0 until known. */
export function useOpenActionCount(): number {
  const { filteredActions, isLoading, isError } = useActionsView(DEFAULT_ACTIONS_VIEW, CACHED_ONLY);
  if (isLoading || isError) return 0;
  return countVisibleActions(filteredActions, DEFAULT_ACTIONS_VIEW.statusVisibility);
}
