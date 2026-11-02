import { useEffect, useReducer } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import type { TiptapCollabProvider } from "@hocuspocus/provider";
import { WebSocketStatus } from "@hocuspocus/provider";

enum ConnectionState {
  Connecting = "connecting",
  Connected = "connected",
  Offline = "offline",
  Error = "error",
}

interface ConnectionStatusConfig {
  label: string;
  icon: React.ReactNode;
}

/**
 * ConnectionStatus displays the current connection state of the TipTap collaboration provider.
 * Shows an icon (label in a tooltip) indicating whether the editor is connected to the collaboration server.
 *
 * States:
 * - Connecting: Provider is initializing (isLoading = true) - shows spinner
 * - Connected: Provider is synced and ready (isReady = true, no error)
 * - Offline: Provider lost connection or no collaboration provider available
 * - Error: Provider initialization or connection error
 */
export const ConnectionStatus = () => {
  const { isReady, isLoading, error, collaborationProvider } = useEditorCache();

  /**
   * Force re-render mechanism for tracking external state changes.
   *
   * The collaboration provider's status property (provider.status) is not React state,
   * so changes to it don't automatically trigger re-renders. We use useReducer as a
   * "force update" function: calling forceUpdate() increments an internal counter,
   * which causes React to re-render this component and pick up the new provider.status value.
   *
   * This is a standard React pattern for syncing with external (non-React) state objects.
   */
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Track provider status changes to trigger re-renders
  useEffect(() => {
    if (!collaborationProvider) {
      return;
    }

    const handleStatusChange = () => {
      forceUpdate();
    };

    // Listen to status event which fires when connection status changes
    collaborationProvider.on('status', handleStatusChange);

    // Cleanup listener on unmount or provider change
    return () => {
      collaborationProvider.off('status', handleStatusChange);
    };
  }, [collaborationProvider]);

  const connectionState = determineConnectionState(
    isReady,
    isLoading,
    error,
    collaborationProvider
  );
  const statusConfig = getStatusConfig(connectionState);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          tabIndex={0}
          className="inline-flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {statusConfig.icon}
          <span className="sr-only">{statusConfig.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{statusConfig.label}</p>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Determines the current connection state based on editor cache state and provider status
 */
const determineConnectionState = (
  isReady: boolean,
  isLoading: boolean,
  error: Error | null,
  collaborationProvider: TiptapCollabProvider | null
): ConnectionState => {
  // Error state takes precedence
  if (error) {
    return ConnectionState.Error;
  }

  // Initial loading state (editor not ready yet)
  if (isLoading) {
    return ConnectionState.Connecting;
  }

  // No provider = offline
  if (!collaborationProvider) {
    return ConnectionState.Offline;
  }

  // Check provider connection status
  if (collaborationProvider.status === WebSocketStatus.Connected && isReady) {
    return ConnectionState.Connected;
  }

  // If editor was ready but connection lost (disconnected or reconnecting)
  if (isReady && collaborationProvider.status !== WebSocketStatus.Connected) {
    return ConnectionState.Offline;
  }

  // Initial connection attempt (editor not ready yet)
  return ConnectionState.Connecting;
};

/**
 * Maps connection state to its icon and label
 */
const getStatusConfig = (state: ConnectionState): ConnectionStatusConfig => {
  switch (state) {
    case ConnectionState.Connecting:
      return {
        label: "Connecting",
        icon: <Spinner aria-hidden className="size-3.5 text-muted-foreground" />,
      };
    case ConnectionState.Connected:
      return {
        label: "Connected",
        icon: <Cloud aria-hidden className="h-3.5 w-3.5 text-muted-foreground/50" />,
      };
    case ConnectionState.Offline:
      return {
        label: "Not connected",
        icon: <CloudOff aria-hidden className="h-3.5 w-3.5 text-warning" />,
      };
    case ConnectionState.Error:
      return {
        label: "Not connected",
        icon: <CloudOff aria-hidden className="h-3.5 w-3.5 text-destructive" />,
      };
  }
};
