import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSearchParams, useRouter } from "next/navigation";
import IntegrationsPage from "@/app/settings/integrations/page";
import { GoogleOAuthConnectionStatus } from "@/types/oauth-connection";
import { createMockGoogleOAuthConnectionState } from "../test-utils";

// Track toast calls
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
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
let mockConnectionStatus: { status: string; google_email?: string; connected_at?: string } = {
  status: GoogleOAuthConnectionStatus.Disconnected,
};
const mockRefreshOAuth = vi.fn();
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api/oauth-connection", () => ({
  useGoogleOAuthConnectionStatus: () => ({
    connectionStatus: mockConnectionStatus,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshOAuth,
  }),
  GoogleOAuthApi: {
    getAuthorizeUrl: () => "http://localhost:4000/api/oauth/google/authorize",
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
  CoachingRelationshipApi: {
    updateRelationship: vi.fn(),
  },
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

vi.mock("@/lib/api/meetings", () => ({
  MeetingApi: {
    createGoogleMeet: vi.fn(),
  },
}));

describe("Google OAuth Flow Integration", () => {
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus = {
      status: GoogleOAuthConnectionStatus.Disconnected,
    };
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
    it("shows Connect button when disconnected", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);

      render(<IntegrationsPage />);

      expect(
        screen.getByRole("button", { name: "Connect Google Account" })
      ).toBeInTheDocument();
    });

    it("shows success toast and refreshes when returning from OAuth", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_connected=true") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Google account connected successfully."
        );
      });

      expect(mockRefreshOAuth).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/settings/integrations", {
        scroll: false,
      });
    });
  });

  describe("Error handling", () => {
    it("shows error toast for access_denied", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=access_denied") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Google account connection was cancelled."
        );
      });

      expect(mockReplace).toHaveBeenCalledWith("/settings/integrations", {
        scroll: false,
      });
    });

    it("shows error toast for exchange_failed", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=exchange_failed") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Failed to connect Google account. Please try again."
        );
      });
    });

    it("shows generic error message for unknown error codes", async () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams("google_error=something_unknown") as never
      );

      render(<IntegrationsPage />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "An unexpected error occurred connecting your Google account."
        );
      });
    });
  });

  describe("Disconnect flow", () => {
    it("shows connected email and Disconnect button when connected", () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      mockConnectionStatus = createMockGoogleOAuthConnectionState();

      render(<IntegrationsPage />);

      expect(screen.getByText("coach@gmail.com")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument();
    });

    it("shows confirmation dialog and disconnects on confirm", async () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      mockConnectionStatus = createMockGoogleOAuthConnectionState();

      render(<IntegrationsPage />);

      // Click disconnect trigger
      await userEvent.click(
        screen.getByRole("button", { name: "Disconnect" })
      );

      // Confirmation dialog should appear
      expect(
        screen.getByText("Disconnect Google Account")
      ).toBeInTheDocument();

      // Click confirm in dialog
      const disconnectButtons = screen.getAllByRole("button", {
        name: /Disconnect/,
      });
      await userEvent.click(disconnectButtons[disconnectButtons.length - 1]);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });
  });
});
