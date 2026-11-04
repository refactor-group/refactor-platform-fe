import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForgetRelationshipOutsideOrganization } from "@/lib/hooks/use-forget-relationship-outside-organization";
import { None, Some, type Option } from "@/types/option";
import { createMockRelationship } from "../../test-utils";

const HERE = [createMockRelationship({ id: "rel-here" })];

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
});
