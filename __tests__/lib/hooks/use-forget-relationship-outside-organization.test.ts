import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForgetRelationshipOutsideOrganization } from "@/lib/hooks/use-forget-relationship-outside-organization";
import { None, Some, type Option } from "@/types/option";
import { createMockRelationship } from "../../test-utils";

const HERE = [createMockRelationship({ id: "rel-here" })];
const THERE = [createMockRelationship({ id: "rel-there" })];

function run(currentId: Option<string>, list = { relationships: HERE, isLoading: false, isError: false }) {
  const forget = vi.fn();
  renderHook(() => useForgetRelationshipOutsideOrganization({ ...list, currentId, forget }));
  return forget;
}

describe("useForgetRelationshipOutsideOrganization", () => {
  it("forgets a relationship from another organization", () => {
    expect(run(Some("rel-elsewhere"))).toHaveBeenCalledTimes(1);
  });

  it("keeps a relationship in the current organization", () => {
    expect(run(Some("rel-here"))).not.toHaveBeenCalled();
  });

  it("does nothing with no relationship selected", () => {
    expect(run(None)).not.toHaveBeenCalled();
  });

  it("waits for the organization's relationships", () => {
    expect(run(Some("rel-elsewhere"), { relationships: [], isLoading: true, isError: false })).not.toHaveBeenCalled();
  });

  it("keeps the relationship when its organization's relationships fail to load", () => {
    expect(run(Some("rel-elsewhere"), { relationships: [], isLoading: false, isError: true })).not.toHaveBeenCalled();
  });

  it("forgets the relationship once the next organization's relationships load without it", () => {
    const forget = vi.fn();
    const { rerender } = renderHook(
      (list) => useForgetRelationshipOutsideOrganization({ ...list, currentId: Some("rel-here"), forget }),
      { initialProps: { relationships: HERE, isLoading: false, isError: false } }
    );
    rerender({ relationships: [], isLoading: true, isError: false });
    expect(forget).not.toHaveBeenCalled();

    rerender({ relationships: THERE, isLoading: false, isError: false });
    expect(forget).toHaveBeenCalledTimes(1);
  });
});
