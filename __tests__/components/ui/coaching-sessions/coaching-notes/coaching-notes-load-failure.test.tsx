import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";

const LOAD_ERROR = "WebSocket closed with code 4401";
const resetCache = vi.fn();

vi.mock("@/components/ui/coaching-sessions/editor-cache-context", () => ({
  useEditorCache: () => ({
    extensions: [],
    isReady: false,
    isLoading: false,
    error: new Error(LOAD_ERROR),
    resetCache,
  }),
}));

describe("CoachingNotes load failure", () => {
  it("shows plain copy without the raw error and retries", () => {
    render(<CoachingNotes />);

    expect(screen.getByText("Couldn't load the notes")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(LOAD_ERROR))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(resetCache).toHaveBeenCalledTimes(1);
  });
});
