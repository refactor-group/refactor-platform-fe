import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, fireEvent } from "@testing-library/react";

vi.mock("@/lib/api/coaching-session-images", () => ({
  CoachingSessionImageApi: {
    imageUrl: (id: string) => `http://localhost:4000/coaching_session_images/${id}`,
  },
  UploadFailureKind: {},
}));

import { NoteImageView } from "@/components/ui/coaching-sessions/coaching-notes/note-image-view";
import type { NodeViewProps } from "@tiptap/react";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";

function viewProps(
  selected: boolean,
  onUpdate: (attrs: unknown) => void,
  alt = ""
): NodeViewProps {
  return {
    node: { attrs: { imageId: IMAGE_ID, alt, naturalWidth: null, naturalHeight: null } },
    selected,
    deleteNode: vi.fn(),
    updateAttributes: onUpdate,
    editor: { view: { state: { doc: { forEach: () => undefined } } } },
    getPos: () => 0,
  } as unknown as NodeViewProps;
}

function renderView(selected: boolean, onUpdate: (attrs: unknown) => void, alt = "") {
  const view = render(<NoteImageView {...viewProps(selected, onUpdate, alt)} />);
  return {
    ...view,
    // Simulates the document changing under the field, as a collaborator's edit does.
    setAlt: (next: string) =>
      view.rerender(<NoteImageView {...viewProps(selected, onUpdate, next)} />),
  };
}

function field(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[aria-label="Image description"]') as HTMLInputElement;
}

describe("alt text commit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The field only exists while the node is selected, so clicking away unmounts it. The
   * debounce cleanup cancels the pending commit, and the description the user just typed
   * and watched appear in the field is gone with no sign anything was lost.
   */
  it("commits a pending description when the field unmounts", () => {
    const onUpdate = vi.fn();
    const { container, unmount } = renderView(true, onUpdate);
    const input = container.querySelector(
      'input[aria-label="Image description"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "a whiteboard sketch" } });
    // Deselected well inside the debounce window.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    unmount();

    expect(onUpdate).toHaveBeenCalledWith({ alt: "a whiteboard sketch" });
  });

  it("commits on blur without waiting out the debounce", () => {
    const onUpdate = vi.fn();
    const { container } = renderView(true, onUpdate);
    const input = container.querySelector(
      'input[aria-label="Image description"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "sketch" } });
    fireEvent.blur(input);

    expect(onUpdate).toHaveBeenCalledWith({ alt: "sketch" });
  });

  it("does not commit when nothing was typed", () => {
    const onUpdate = vi.fn();
    const { unmount } = renderView(true, onUpdate);

    unmount();

    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("reaching the description field", () => {
  /**
   * The field only renders while the node is selected, and selecting is what a click
   * does. Binding the lightbox to that same click meant the dialog opened over the
   * field every time, so full size is its own control.
   */
  it("does not open the lightbox when the image is clicked", () => {
    const { container } = renderView(false, vi.fn());
    const img = container.querySelector("img") as HTMLImageElement;

    fireEvent.click(img);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("offers full size as its own control", () => {
    const { container } = renderView(false, vi.fn());

    expect(
      container.querySelector('button[aria-label="View image full size"]')
    ).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Remove image from note"]')
    ).toBeTruthy();
  });

  it("shows the description field exactly when the node is selected", () => {
    const unselected = renderView(false, vi.fn());
    expect(
      unselected.container.querySelector('input[aria-label="Image description"]')
    ).toBeNull();
    unselected.unmount();

    const selected = renderView(true, vi.fn());
    expect(
      selected.container.querySelector('input[aria-label="Image description"]')
    ).toBeTruthy();
  });
});

describe("a collaborator editing the same description", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Nothing was typed here, so nothing here may be written: the field holds no edit of
  // its own, only the last thing it displayed.
  it("shows their edit and writes nothing back", () => {
    const onUpdate = vi.fn();
    const { container, setAlt, unmount } = renderView(true, onUpdate, "");

    setAlt("their sketch");
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(field(container).value).toBe("their sketch");
    unmount();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not overwrite an edit that lands after ours", () => {
    const onUpdate = vi.fn();
    const { container, setAlt } = renderView(true, onUpdate, "");

    fireEvent.change(field(container), { target: { value: "my sketch" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    setAlt("my sketch"); // ours lands
    setAlt("their sketch"); // then theirs
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(field(container).value).toBe("their sketch");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  // The document catches up with a write a render later. Showing the old value in
  // between would flash it and throw the caret.
  it("keeps showing the typed text while the write lands", () => {
    const onUpdate = vi.fn();
    const { container, setAlt } = renderView(true, onUpdate, "");

    fireEvent.change(field(container), { target: { value: "my sketch" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(field(container).value).toBe("my sketch");
    setAlt("my sketch");
    expect(field(container).value).toBe("my sketch");
  });
});

describe("an image that fails to load", () => {
  // The editor's stylesheet sets the image to display: block, which beat the hidden
  // class, so a failed image kept its reserved box above the placeholder and the text
  // below jumped down by a whole image.
  it("gives its box to the placeholder rather than keeping both", () => {
    const props = {
      ...viewProps(false, vi.fn()),
      node: { attrs: { imageId: IMAGE_ID, alt: "", naturalWidth: 800, naturalHeight: 600 } },
    } as unknown as NodeViewProps;
    const { container } = render(<NoteImageView {...props} />);

    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    const placeholder = container.querySelector(".note-image__unavailable") as HTMLElement;
    expect(placeholder).toBeTruthy();
    expect(placeholder.style.aspectRatio).toBe("800 / 600");
  });
});
