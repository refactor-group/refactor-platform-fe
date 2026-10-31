import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";

const INIT_ERROR = "editor exploded";

// Reading EditorProvider happens inside the init try block, so throwing here
// drives CoachingNotes into its initialization-failure fallback.
vi.mock("@tiptap/react", () => ({
  get EditorProvider() {
    throw new Error(INIT_ERROR);
  },
  useCurrentEditor: () => ({ editor: null }),
}));

vi.mock("@/components/ui/coaching-sessions/editor-cache-context", () => ({
  useEditorCache: () => ({
    extensions: [{}],
    isReady: true,
    isLoading: false,
    error: null,
    resetCache: vi.fn(),
  }),
}));

describe("CoachingNotes initialization failure", () => {
  it("shows plain copy without the raw error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<CoachingNotes />);

    expect(screen.getByText("Couldn't load the notes editor")).toBeInTheDocument();
    expect(screen.getByText("Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(INIT_ERROR))).not.toBeInTheDocument();
  });
});
