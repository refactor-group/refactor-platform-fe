import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BaseCardCompactEditable } from "@/components/ui/base-card-compact-editable";

/** jsdom doesn't have TransitionEvent — create a minimal substitute */
function createTransitionEndEvent(propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  (event as any).propertyName = propertyName;
  return event;
}

describe("BaseCardCompactEditable", () => {
  function renderWithTestContent(props?: {
    canFlip?: boolean;
    initialEditing?: boolean;
    onDismiss?: () => void;
    renderHeader?: (p: { onFlip: () => void }) => ReactNode;
    renderFooter?: () => ReactNode;
  }) {
    return render(
      <BaseCardCompactEditable
        canFlip={props?.canFlip}
        initialEditing={props?.initialEditing}
        onDismiss={props?.onDismiss}
        renderHeader={props?.renderHeader}
        renderFooter={props?.renderFooter}
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

  // ── Header / Footer enhancement tests ────────────────────────────

  it("renders header content on the front face when renderHeader is provided", () => {
    renderWithTestContent({
      renderHeader: ({ onFlip }) => (
        <div>
          <span>Header content</span>
          <button type="button" onClick={onFlip} aria-label="flip from header">
            Flip
          </button>
        </div>
      ),
    });

    expect(screen.getByText("Header content")).toBeInTheDocument();
    // Header should be inside the front face
    const headerText = screen.getByText("Header content");
    const frontFace = headerText.closest(".flip-card-front");
    expect(frontFace).not.toBeNull();
  });

  it("renders footer content on the front face when renderFooter is provided", () => {
    renderWithTestContent({
      renderFooter: () => <span>Footer content</span>,
    });

    expect(screen.getByText("Footer content")).toBeInTheDocument();
    // Footer should be inside the front face
    const footerText = screen.getByText("Footer content");
    const frontFace = footerText.closest(".flip-card-front");
    expect(frontFace).not.toBeNull();
  });

  it("does not render header/footer sections when props are not provided", () => {
    renderWithTestContent();

    // No header or footer test IDs should be present
    expect(document.querySelector("[data-slot='card-header']")).toBeNull();
    expect(document.querySelector("[data-slot='card-footer']")).toBeNull();
  });

  it("passes onFlip to renderHeader so the flip icon can live in the header", async () => {
    const user = userEvent.setup();
    renderWithTestContent({
      renderHeader: ({ onFlip }) => (
        <button type="button" onClick={onFlip} aria-label="flip from header">
          Header Flip
        </button>
      ),
    });

    await user.click(screen.getByRole("button", { name: /flip from header/i }));

    const backFace = screen.getByText("Back content").closest(
      ".flip-card-face.flip-card-back"
    );
    expect(backFace).toHaveAttribute("aria-hidden", "false");
  });

  it("renders header and footer together with body content between them", () => {
    renderWithTestContent({
      renderHeader: ({ onFlip }) => <span>Header</span>,
      renderFooter: () => <span>Footer</span>,
    });

    // All three zones should be present in the front face
    const frontFace = screen.getByText("Front content").closest(".flip-card-front")!;
    expect(frontFace).not.toBeNull();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Front content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("does not render header or footer on the back face", async () => {
    const user = userEvent.setup();
    renderWithTestContent({
      renderHeader: ({ onFlip }) => (
        <button type="button" onClick={onFlip} aria-label="flip from header">
          Header content
        </button>
      ),
      renderFooter: () => <span>Footer content</span>,
    });

    // Flip to back
    await user.click(screen.getByRole("button", { name: /flip from header/i }));

    // Header and footer should not be inside the back face
    const backFace = screen.getByText("Back content").closest(".flip-card-back")!;
    expect(backFace.textContent).not.toContain("Header content");
    expect(backFace.textContent).not.toContain("Footer content");
  });
});
