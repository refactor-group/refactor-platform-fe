import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import { ActionStatusRow } from "@/components/ui/status/action-status-row";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";

const NOW = DateTime.fromISO("2026-08-25T12:00:00Z", { zone: "utc" });

function renderRow(props: Partial<Parameters<typeof ActionStatusRow>[0]> = {}) {
  return render(
    <ActionStatusRow
      title="Send Ehab the notes"
      status={ItemStatus.InProgress}
      dueBy={Some(NOW.plus({ days: 5 }))}
      statusChangedAt={NOW}
      href="/coaching-sessions/s1?panel=actions"
      locale="en-US"
      {...props}
    />
  );
}

describe("ActionStatusRow", () => {
  const originalNow = Settings.now;
  beforeEach(() => {
    Settings.now = () => NOW.toMillis();
  });
  afterEach(() => {
    Settings.now = originalNow;
  });

  it("shows glyph, title, meta and pill, and links the row to the action", () => {
    renderRow();
    expect(screen.getByRole("link", { name: "Send Ehab the notes" })).toHaveAttribute(
      "href",
      "/coaching-sessions/s1?panel=actions"
    );
    expect(screen.getByRole("img", { name: "In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Due Aug 30")).toBeInTheDocument();
    expect(screen.getByText("In Progress", { selector: "span[data-status]" })).toBeInTheDocument();
  });

  it("is display-only without onStatusChange", () => {
    renderRow();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the status menu from the glyph when the status can be set", async () => {
    const onStatusChange = vi.fn();
    renderRow({ onStatusChange });

    // One named target for keyboard and screen readers; the pill is a pointer shortcut.
    const glyph = screen.getByRole("button", { name: "Status: In Progress" });
    expect(screen.getAllByRole("button")).toHaveLength(1);

    await userEvent.click(glyph);
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Completed/ }));
    expect(onStatusChange).toHaveBeenCalledWith(ItemStatus.Completed);
  });

  it("opens the same menu from the pill", async () => {
    const onStatusChange = vi.fn();
    const { container } = renderRow({ onStatusChange });

    const pillButton = container.querySelector<HTMLButtonElement>('button[tabindex="-1"]')!;
    expect(pillButton).toContainElement(container.querySelector("span[data-status]"));
    await userEvent.click(pillButton);
    expect(screen.getByRole("menuitemradio", { name: /In Progress/, checked: true })).toBeInTheDocument();
  });

  it("mutes a closed action's title without striking it through", () => {
    const { container } = renderRow({ status: ItemStatus.Completed });
    expect(screen.getByRole("link", { name: "Send Ehab the notes" })).toHaveClass("text-muted-foreground");
    expect(container.querySelector(".line-through")).toBeNull();
  });
});
