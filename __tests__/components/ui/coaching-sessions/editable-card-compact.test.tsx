import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EditableCardCompact } from "@/components/ui/coaching-sessions/editable-card-compact";

/** jsdom doesn't have TransitionEvent — create a minimal substitute */
function createTransitionEndEvent(propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  (event as any).propertyName = propertyName;
  return event;
}

describe("EditableCardCompact", () => {
  function renderWithTestContent(props?: {
    canFlip?: boolean;
    initialEditing?: boolean;
    onDismiss?: () => void;
  }) {
    return render(
      <EditableCardCompact
        canFlip={props?.canFlip}
        initialEditing={props?.initialEditing}
        onDismiss={props?.onDismiss}
        renderFront={({ onFlip }) => (
          <div>
            <span>Front content</span>
            <button type="button" onClick={onFlip} aria-label="flip card">
              Info
            </button>
          </div>
        )}
        renderBack={({ onDone, isEditing, onEditStart, onEditEnd }) => (
          <div>
            <span>Back content</span>
            <button type="button" onClick={onDone}>
              Done
            </button>
            <button type="button" onClick={onEditStart}>
              Start Edit
            </button>
            <button type="button" onClick={onEditEnd}>
              End Edit
            </button>
            {isEditing && <span>Edit mode active</span>}
          </div>
        )}
      />
    );
  }

  it("renders front face content by default", () => {
    renderWithTestContent();

    expect(screen.getByText("Front content")).toBeInTheDocument();
  });

  it("flips to show back face when onFlip is called", async () => {
    const user = userEvent.setup();
    renderWithTestContent();

    await user.click(screen.getByRole("button", { name: /flip card/i }));

    // Back face should be visible (aria-hidden=false)
    const backFace = screen.getByText("Back content").closest(
      ".flip-card-face.flip-card-back"
    );
    expect(backFace).toHaveAttribute("aria-hidden", "false");
  });

  it("returns to front face when onDone is called", async () => {
    const user = userEvent.setup();
    renderWithTestContent();

    // Flip to back
    await user.click(screen.getByRole("button", { name: /flip card/i }));
    // Flip back to front
    await user.click(screen.getByText("Done"));

    // Front face should be visible (aria-hidden=false)
    const frontFace = screen.getByText("Front content").closest(
      ".flip-card-face.flip-card-front"
    );
    expect(frontFace).toHaveAttribute("aria-hidden", "false");
  });

  it("sets aria-hidden correctly on front and back faces based on flip state", () => {
    renderWithTestContent();

    const frontFace = screen.getByText("Front content").closest(
      ".flip-card-face.flip-card-front"
    );
    const backFace = screen.getByText("Back content").closest(
      ".flip-card-face.flip-card-back"
    );

    // Initially: front visible, back hidden
    expect(frontFace).toHaveAttribute("aria-hidden", "false");
    expect(backFace).toHaveAttribute("aria-hidden", "true");
  });

  it("closes flipped card when clicking outside", async () => {
    const user = userEvent.setup();
    renderWithTestContent();

    // Flip to back
    await user.click(screen.getByRole("button", { name: /flip card/i }));

    // Verify we're on the back face
    const backFace = screen.getByText("Back content").closest(
      ".flip-card-face.flip-card-back"
    );
    expect(backFace).toHaveAttribute("aria-hidden", "false");

    // Click outside the card
    fireEvent.pointerDown(document.body);

    // Should return to front face
    const frontFace = screen.getByText("Front content").closest(
      ".flip-card-face.flip-card-front"
    );
    expect(frontFace).toHaveAttribute("aria-hidden", "false");
  });

  it("passes isEditing and edit callbacks to renderBack", async () => {
    const user = userEvent.setup();
    renderWithTestContent();

    // Flip to back
    await user.click(screen.getByRole("button", { name: /flip card/i }));

    // Initially not editing
    expect(screen.queryByText("Edit mode active")).not.toBeInTheDocument();

    // Start editing
    await user.click(screen.getByText("Start Edit"));

    // Now editing
    expect(screen.getByText("Edit mode active")).toBeInTheDocument();

    // End editing
    await user.click(screen.getByText("End Edit"));

    // No longer editing
    expect(screen.queryByText("Edit mode active")).not.toBeInTheDocument();
  });

  it("does not flip when canFlip is false", async () => {
    const user = userEvent.setup();
    renderWithTestContent({ canFlip: false });

    await user.click(screen.getByRole("button", { name: /flip card/i }));

    // Front face should still be visible
    const frontFace = screen.getByText("Front content").closest(
      ".flip-card-face.flip-card-front"
    );
    expect(frontFace).toHaveAttribute("aria-hidden", "false");

    // Back face should still be hidden
    const backFace = screen.getByText("Back content").closest(
      ".flip-card-face.flip-card-back"
    );
    expect(backFace).toHaveAttribute("aria-hidden", "true");
  });

  it("renders back face directly in edit mode when initialEditing is true", () => {
    renderWithTestContent({ initialEditing: true });

    // Should immediately show edit mode — no flip needed
    expect(screen.getByText("Edit mode active")).toBeInTheDocument();
    expect(screen.getByText("Back content")).toBeInTheDocument();

    // Should NOT render the flip card structure
    expect(document.querySelector(".flip-card-container")).toBeNull();
  });

  it("calls onDismiss immediately when initialEditing Done is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderWithTestContent({ initialEditing: true, onDismiss });

    await user.click(screen.getByText("Done"));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss after flip-back when Done is clicked on flipped card", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderWithTestContent({ onDismiss });

    // Flip to back
    await user.click(screen.getByRole("button", { name: /flip card/i }));

    // Click Done to flip back
    await user.click(screen.getByText("Done"));

    // Simulate the transitionend event on the inner element
    const inner = document.querySelector(".flip-card-inner")!;
    inner.dispatchEvent(createTransitionEndEvent("transform"));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onDismiss for non-transform transition events on flipped card", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderWithTestContent({ onDismiss });

    // Flip to back then Done
    await user.click(screen.getByRole("button", { name: /flip card/i }));
    await user.click(screen.getByText("Done"));

    // Fire a height transition — should not trigger dismiss
    const inner = document.querySelector(".flip-card-inner")!;
    inner.dispatchEvent(createTransitionEndEvent("height"));

    expect(onDismiss).not.toHaveBeenCalled();

    // Now fire the transform transition — should trigger dismiss
    inner.dispatchEvent(createTransitionEndEvent("transform"));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
