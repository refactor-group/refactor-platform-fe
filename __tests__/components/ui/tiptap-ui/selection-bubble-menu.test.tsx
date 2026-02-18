import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { EditorProvider } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Link from "@tiptap/extension-link";
import CodeBlock from "@tiptap/extension-code-block";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SelectionBubbleMenu,
  shouldShowSelectionMenu,
} from "@/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu";

// Mock ResizeObserver for test environment
global.ResizeObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal extensions to avoid "duplicate extension names" warnings from StarterKit */
const createEditorExtensions = () => [
  Document,
  Paragraph,
  Text,
  Link.configure({ openOnClick: false }),
  CodeBlock,
];

const renderWithProviders = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

// ---------------------------------------------------------------------------
// shouldShowSelectionMenu — pure function tests
// ---------------------------------------------------------------------------

describe("shouldShowSelectionMenu", () => {
  /**
   * Creates a mock editor object with the minimum shape needed by
   * shouldShowSelectionMenu. Real TipTap Editor is heavy; these mocks
   * let us test the predicate in isolation.
   */
  const createMockEditor = (
    overrides: {
      isActiveLink?: boolean;
      isActiveCodeBlock?: boolean;
      textBetween?: string;
    } = {}
  ) => {
    const {
      isActiveLink = false,
      isActiveCodeBlock = false,
      textBetween = "some text",
    } = overrides;

    return {
      isActive: (name: string) => {
        if (name === "link") return isActiveLink;
        if (name === "codeBlock") return isActiveCodeBlock;
        return false;
      },
      state: {
        doc: {
          textBetween: () => textBetween,
        },
      },
    };
  };

  it("returns true when non-empty text is selected outside links and code blocks", () => {
    const editor = createMockEditor({ textBetween: "selected text" });
    expect(shouldShowSelectionMenu({ editor, from: 0, to: 13 })).toBe(true);
  });

  it("returns false for empty/cursor selection (from === to)", () => {
    const editor = createMockEditor();
    expect(shouldShowSelectionMenu({ editor, from: 5, to: 5 })).toBe(false);
  });

  it("returns false when selection is inside a link", () => {
    const editor = createMockEditor({
      isActiveLink: true,
      textBetween: "link text",
    });
    expect(shouldShowSelectionMenu({ editor, from: 0, to: 9 })).toBe(false);
  });

  it("returns false when selection is inside a code block", () => {
    const editor = createMockEditor({
      isActiveCodeBlock: true,
      textBetween: "code",
    });
    expect(shouldShowSelectionMenu({ editor, from: 0, to: 4 })).toBe(false);
  });

  it("returns false when selected text is only whitespace", () => {
    const editor = createMockEditor({ textBetween: "   \n\t  " });
    expect(shouldShowSelectionMenu({ editor, from: 0, to: 7 })).toBe(false);
  });

  it("returns false when both link and code block are active", () => {
    const editor = createMockEditor({
      isActiveLink: true,
      isActiveCodeBlock: true,
      textBetween: "text",
    });
    expect(shouldShowSelectionMenu({ editor, from: 0, to: 4 })).toBe(false);
  });

  it("returns true for text with leading/trailing whitespace (trimmed is non-empty)", () => {
    const editor = createMockEditor({ textBetween: "  hello  " });
    expect(shouldShowSelectionMenu({ editor, from: 0, to: 9 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SelectionBubbleMenu — component rendering tests
// ---------------------------------------------------------------------------

describe("SelectionBubbleMenu", () => {
  const mockOnAddAsAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockClear();
    document.body.innerHTML = "";
  });

  const renderEditor = (content: string) => {
    const extensions = createEditorExtensions();

    return renderWithProviders(
      <EditorProvider
        extensions={extensions}
        content={content}
        immediatelyRender={false}
      >
        <SelectionBubbleMenu onAddAsAction={mockOnAddAsAction} />
      </EditorProvider>
    );
  };

  it("renders without crashing when no editor is available", () => {
    // SelectionBubbleMenu without an EditorProvider should return null
    renderWithProviders(
      <SelectionBubbleMenu onAddAsAction={mockOnAddAsAction} />
    );
    // No errors thrown = pass
  });

  it("mounts inside EditorProvider without errors", async () => {
    renderEditor("<p>Test content for selection</p>");

    // Wait for editor to initialize
    await waitFor(() => {
      const editor = document.querySelector(".tiptap.ProseMirror");
      expect(editor).toBeInTheDocument();
    });

    // BubbleMenu only renders when selection is active.
    // We verify the component mounts without error. Full interaction
    // tests require programmatic selection which is limited in jsdom.
  });

  it("does not call onAddAsAction before user interaction", async () => {
    renderEditor("<p>Some note text to select</p>");

    await waitFor(() => {
      const editor = document.querySelector(".tiptap.ProseMirror");
      expect(editor).toBeInTheDocument();
    });

    expect(mockOnAddAsAction).not.toHaveBeenCalled();
  });

  it("does not call clipboard.writeText before user interaction", async () => {
    renderEditor("<p>Text to copy</p>");

    await waitFor(() => {
      const editor = document.querySelector(".tiptap.ProseMirror");
      expect(editor).toBeInTheDocument();
    });

    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("accepts an optional editor prop", () => {
    // Passing editor=null should not crash
    renderWithProviders(
      <SelectionBubbleMenu
        editor={null}
        onAddAsAction={mockOnAddAsAction}
      />
    );
    // No errors thrown = pass
  });
});
