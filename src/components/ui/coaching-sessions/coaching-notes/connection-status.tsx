import React from "react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import type { TiptapCollabProvider } from "@hocuspocus/provider";
import { WebSocketStatus } from "@hocuspocus/provider";

enum ConnectionState {
  Connecting = "connecting",
  Connected = "connected",
  Offline = "offline",
  Error = "error",
}

enum BadgeVariant {
  Default = "default",
  Secondary = "secondary",
  Destructive = "destructive",
  Outline = "outline",
}

interface ConnectionStatusConfig {
  text: string;
  variant: BadgeVariant;
}

/**
 * ConnectionStatus displays the current connection state of the TipTap collaboration provider.
 * Shows a badge indicating whether the editor is connected to the collaboration server.
 *
 * States:
 * - Connecting: Provider is initializing (isLoading = true) - shows spinner
 * - Connected: Provider is synced and ready (isReady = true, no error)
 * - Offline: Provider lost connection or no collaboration provider available
 * - Error: Provider initialization or connection error
 */
export const ConnectionStatus: React.FC = () => {
  const { isReady, isLoading, error, collaborationProvider } = useEditorCache();
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Track provider status changes to trigger re-renders
  React.useEffect(() => {
    console.log('[ConnectionStatus] Provider changed:', collaborationProvider ? 'exists' : 'null');

    if (!collaborationProvider) {
      return;
    }

    const handleStatusChange = () => {
      console.log('[ConnectionStatus] ⚡ Status changed to:', collaborationProvider.status);
      forceUpdate();
    };

    console.log('[ConnectionStatus] Registering status listener, current status:', collaborationProvider.status);
    // Listen to status event which fires when connection status changes
    collaborationProvider.on('status', handleStatusChange);

    // Cleanup listener on unmount or provider change
    return () => {
      console.log('[ConnectionStatus] Cleaning up status listener');
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

  console.log('[ConnectionStatus] State:', {
    isReady,
    isLoading,
    hasError: !!error,
    hasProvider: !!collaborationProvider,
    providerStatus: collaborationProvider?.status,
    connectionState
  });

  return (
    <Badge variant={statusConfig.variant} className="ml-auto">
      {statusConfig.text}
      {connectionState === ConnectionState.Connecting && (
        <Spinner className="ml-1.5" />
      )}
    </Badge>
  );
};

/**
 * Determines if the provider is connected and ready
 */
const isProviderConnected = (
  isReady: boolean,
  collaborationProvider: TiptapCollabProvider | null
): boolean => {
  if (!collaborationProvider) return false;
  return isReady && collaborationProvider.status === WebSocketStatus.Connected;
};

/**
 * Determines if the provider is in an offline state
 */
const isProviderOffline = (
  collaborationProvider: TiptapCollabProvider | null
): boolean => {
  if (!collaborationProvider) return true;
  return collaborationProvider.status === WebSocketStatus.Disconnected;
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
 * Maps connection state to badge configuration
 */
const getStatusConfig = (state: ConnectionState): ConnectionStatusConfig => {
  switch (state) {
    case ConnectionState.Connecting:
      return { text: "Connecting...", variant: BadgeVariant.Default };
    case ConnectionState.Connected:
      return { text: "Connected", variant: BadgeVariant.Secondary };
    case ConnectionState.Offline:
      return { text: "Offline", variant: BadgeVariant.Secondary };
    case ConnectionState.Error:
      return { text: "Error", variant: BadgeVariant.Destructive };
  }
};
