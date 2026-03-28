import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { CompactAgreementCard } from "@/components/ui/coaching-sessions/agreement-card-compact";
import { createMockAgreement } from "../../../test-utils";

describe("CompactAgreementCard", () => {
  const defaultAgreement = createMockAgreement({
    id: "agreement-1",
    body: "Weekly check-in every Tuesday",
    created_at: DateTime.fromISO("2026-03-15T10:00:00.000Z"),
    updated_at: DateTime.fromISO("2026-03-15T10:00:00.000Z"),
  });

  const defaultLocale = "en-US";

  it("renders agreement body on the front face", () => {
    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
      />
    );

    // Body appears on both front and back faces
    const bodies = screen.getAllByText("Weekly check-in every Tuesday");
    expect(bodies.length).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted created date only on the back face", () => {
    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Date only on the back face (aria-hidden=true when not flipped)
    const dates = screen.getAllByText(/Mar 15, 2026/);
    expect(dates).toHaveLength(1);
    const backFace = dates[0].closest(".flip-card-face.flip-card-back");
    expect(backFace).not.toBeNull();
  });

  it("shows info button when onSave or onDelete are provided", () => {
    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /agreement options/i })
    ).toBeInTheDocument();
  });

  it("hides info button when neither onSave nor onDelete are provided", () => {
    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
      />
    );

    expect(
      screen.queryByRole("button", { name: /agreement options/i })
    ).not.toBeInTheDocument();
  });

  it("flips to back face when info button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /agreement options/i }));

    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("flips back to front when Done is clicked", async () => {
    const user = userEvent.setup();

    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Flip to back
    await user.click(screen.getByRole("button", { name: /agreement options/i }));
    // Flip back to front
    await user.click(screen.getByRole("button", { name: /done/i }));

    // Info button should be visible again
    expect(
      screen.getByRole("button", { name: /agreement options/i })
    ).toBeInTheDocument();
  });

  it("calls onDelete when Delete is clicked on back face", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={onDelete}
      />
    );

    // Flip to back
    await user.click(screen.getByRole("button", { name: /agreement options/i }));
    // Click Delete
    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("agreement-1");
  });

  it("enters edit mode when Edit is clicked", async () => {
    const user = userEvent.setup();

    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Flip to back
    await user.click(screen.getByRole("button", { name: /agreement options/i }));
    // Click Edit
    await user.click(screen.getByRole("button", { name: /edit/i }));

    // Textarea should appear pre-filled
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Weekly check-in every Tuesday");
  });

  it("calls onSave with new body when Save is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    // Flip to back → Edit → clear and type new text → Save
    await user.click(screen.getByRole("button", { name: /agreement options/i }));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Bi-weekly sync instead");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith("Bi-weekly sync instead");
  });

  it("cancels edit mode when Cancel is clicked", async () => {
    const user = userEvent.setup();

    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Flip to back → Edit → Cancel
    await user.click(screen.getByRole("button", { name: /agreement options/i }));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Should be back on the back face (not edit mode) — Done button visible
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("body text has line-clamp-2 class on front face", () => {
    render(
      <CompactAgreementCard
        agreement={defaultAgreement}
        locale={defaultLocale}
      />
    );

    // First match is the front face body
    const bodyText = screen.getAllByText("Weekly check-in every Tuesday")[0];
    expect(bodyText.className).toContain("line-clamp-2");
  });
});
