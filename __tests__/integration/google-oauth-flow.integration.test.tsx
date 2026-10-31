import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSearchParams, useRouter } from "next/navigation";
import IntegrationsPage from "@/app/settings/integrations/page";
import { OAuthConnection } from "@/types/oauth-connection";
import { createMockGoogleOAuthConnectionState } from "../test-utils";

// Track toast calls
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

// Mock auth store
const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

// Mock OAuth connection hook
let mockGoogleConnection: OAuthConnection | null = null;
let mockZoomConnection: OAuthConnection | null = null;
const mockRefreshOAuth = vi.fn();
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api/oauth-connection", () => ({
  useOAuthConnection: (provider: string) => ({
    connection:
      provider === "google" ? mockGoogleConnection : mockZoomConnection,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshOAuth,
  }),
  OAuthConnectionApi: {
    getAuthorizeUrl: (provider: string) =>
      `http://localhost:4000/api/oauth/${provider}/authorize`,
    disconnect: () => mockDisconnect(),
  },
}));

// Mock coaching relationships
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
  CoachingRelationshipApi: {},
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

describe("Google OAuth Flow Integration", () => {
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleConnection = null;
    mockZoomConnection = null;
    mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: mockReplace,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  describe("Connect flow", () => {
    it("shows platform dropdown when disconnected", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);

      render(<IntegrationsPage />);

      expect(screen.getByText("Select a provider")).toBeInTheDocument();
    });

    it("shows success toast and refreshes when returning from Google OAuth", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_connected=true") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Google account connected",
          { id: "google-connected" }
        );
      });

      expect(mockRefreshOAuth).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/settings/integrations", {
        scroll: false,
      });
    });

    it("shows one replaceable connected toast under Strict Mode", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_connected=true") as never
      );

      render(
        <StrictMode>
          <IntegrationsPage />
        </StrictMode>
      );

      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
      for (const call of mockToastSuccess.mock.calls) {
        expect(call).toEqual([
          "Google account connected",
          { id: "google-connected" },
        ]);
      }
    });

    it("shows success toast and refreshes when returning from Zoom OAuth", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("zoom_connected=true") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Zoom account connected",
          { id: "zoom-connected" }
        );
      });

      expect(mockRefreshOAuth).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/settings/integrations", {
        scroll: false,
      });
    });
  });

  describe("Error handling", () => {
    it("shows error toast for Google access_denied", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=access_denied") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Google connection cancelled",
          { id: "google-error" }
        );
      });

      expect(mockReplace).toHaveBeenCalledWith("/settings/integrations", {
        scroll: false,
      });
    });

    it("shows error toast for Google exchange_failed", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=exchange_failed") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Couldn't connect your Google account · Try again",
          { id: "google-error" }
        );
      });
    });

    it("shows error toast for Google invalid_state", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=invalid_state") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "The connection took too long · Try again",
          { id: "google-error" }
        );
      });
    });

    it("shows generic error message for unknown Google error codes", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=something_unknown") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Couldn't connect your Google account · Try again",
          { id: "google-error" }
        );
      });
    });

    it("shows error toast for Zoom access_denied", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("zoom_error=access_denied") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Zoom connection cancelled",
          { id: "zoom-error" }
        );
      });
    });
  });

  describe("Disconnect flow", () => {
    it("shows connected email and Disconnect button when Google is connected", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      mockGoogleConnection = createMockGoogleOAuthConnectionState();

      render(<IntegrationsPage />);

      expect(screen.getByText("coach@gmail.com")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument();
    });
  });
});
