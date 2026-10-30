import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemStatus, actionStatusToString } from "@/types/general";
import { StatusMenu } from "@/components/ui/status/status-menu";

function renderMenu(status: ItemStatus, onStatusChange = vi.fn()) {
  render(
    <StatusMenu status={status} onStatusChange={onStatusChange}>
      <button type="button">Change status</button>
    </StatusMenu>
  );
  return onStatusChange;
}

const ORDER = [
  ItemStatus.NotStarted,
  ItemStatus.InProgress,
  ItemStatus.OnHold,
  ItemStatus.Completed,
  ItemStatus.WontDo,
];

const trigger = () => screen.getByRole("button", { name: "Change status" });
const itemFor = (status: ItemStatus) =>
  screen.getAllByRole("menuitem").find((el) => el.dataset.status === status)!;

describe("StatusMenu", () => {
  it("lists the five statuses in column order by accessible name", async () => {
    const user = userEvent.setup();
    renderMenu(ItemStatus.NotStarted);
    await user.click(trigger());
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(5);
    const named = ORDER.map((s) =>
      screen.getByRole("menuitem", { name: actionStatusToString(s) })
    );
    expect(named).toEqual(items);
  });

  it.each(ORDER)("names the %s item exactly by its label", async (s) => {
    const user = userEvent.setup();
    renderMenu(ItemStatus.InProgress);
    await user.click(trigger());
    await screen.findAllByRole("menuitem");
    expect(
      screen.getAllByRole("menuitem", { name: actionStatusToString(s) })
    ).toHaveLength(1);
  });

  it("marks only the current status", async () => {
    const user = userEvent.setup();
    renderMenu(ItemStatus.InProgress);
    await user.click(trigger());
    const items = await screen.findAllByRole("menuitem");
    const current = items.filter((el) => el.dataset.current === "true");
    expect(current.map((el) => el.dataset.status)).toEqual([ItemStatus.InProgress]);
  });

  it("calls onStatusChange once when choosing a different status", async () => {
    const user = userEvent.setup();
    const onChange = renderMenu(ItemStatus.InProgress);
    await user.click(trigger());
    await screen.findAllByRole("menuitem");
    await user.click(itemFor(ItemStatus.OnHold));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(ItemStatus.OnHold);
  });

  it("does not call onStatusChange when choosing the current status", async () => {
    const user = userEvent.setup();
    const onChange = renderMenu(ItemStatus.InProgress);
    await user.click(trigger());
    await screen.findAllByRole("menuitem");
    await user.click(itemFor(ItemStatus.InProgress));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("selects the focused item via keyboard", async () => {
    const user = userEvent.setup();
    const onChange = renderMenu(ItemStatus.OnHold);
    trigger().focus();
    await user.keyboard("{Enter}");
    await screen.findAllByRole("menuitem");
    await user.keyboard("{ArrowDown}");
    const focused = document.activeElement as HTMLElement;
    expect(focused).toHaveAttribute("role", "menuitem");
    const focusedStatus = focused.dataset.status as ItemStatus;
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(focusedStatus);
  });
});
