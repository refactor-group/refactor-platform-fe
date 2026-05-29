import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useFieldPrefill } from "@/lib/hooks/use-field-prefill";
import { type Option, Some, None } from "@/types/option";
import type { NoteField } from "@/types/note-selection";

// These tests exercise the hook through its (field, apply) contract only.
// The append-vs-replace policy lives in the `apply` closure each call site
// passes, so we assert the closure is invoked with the right text at the
// right times — never the hook's internals.

describe("useFieldPrefill", () => {
  it("does not call apply when the field is None", () => {
    const apply = vi.fn();
    renderHook(() => useFieldPrefill(None, apply));
    expect(apply).not.toHaveBeenCalled();
  });

  it("calls apply with the text when a field is present", () => {
    const apply = vi.fn();
    renderHook(() =>
      useFieldPrefill(Some({ text: "hello", nonce: 1 }), apply)
    );
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("hello");
  });

  it("does not re-apply on re-render with the same nonce", () => {
    const apply = vi.fn();
    const { rerender } = renderHook(
      ({ field }: { field: Option<NoteField> }) => useFieldPrefill(field, apply),
      { initialProps: { field: Some({ text: "hello", nonce: 1 }) } }
    );
    // Same nonce, new object identity — must still be deduped.
    rerender({ field: Some({ text: "hello", nonce: 1 }) });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("applies again when the nonce advances", () => {
    const apply = vi.fn();
    const { rerender } = renderHook(
      ({ field }: { field: Option<NoteField> }) => useFieldPrefill(field, apply),
      { initialProps: { field: Some({ text: "first", nonce: 1 }) } }
    );
    rerender({ field: Some({ text: "second", nonce: 2 }) });
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenNthCalledWith(1, "first");
    expect(apply).toHaveBeenNthCalledWith(2, "second");
  });

  it("supports an append policy at the call site", () => {
    // Mirrors Action/Agreement body prefilling.
    let body = "";
    const apply = (t: string) => {
      body = body.trim() ? `${body}\n\n${t}` : t;
    };
    const { rerender } = renderHook(
      ({ field }: { field: Option<NoteField> }) => useFieldPrefill(field, apply),
      { initialProps: { field: Some({ text: "First", nonce: 1 }) } }
    );
    expect(body).toBe("First");
    rerender({ field: Some({ text: "Second", nonce: 2 }) });
    expect(body).toBe("First\n\nSecond");
  });

  it("supports a replace-if-empty policy at the call site", () => {
    // Mirrors Goal title prefilling: only prefill when the field is still empty.
    let title = "";
    const apply = (t: string) => {
      title = title.trim() ? title : t;
    };
    const { rerender } = renderHook(
      ({ field }: { field: Option<NoteField> }) => useFieldPrefill(field, apply),
      { initialProps: { field: Some({ text: "Prefilled title", nonce: 1 }) } }
    );
    expect(title).toBe("Prefilled title");
    // User has since typed; a new nonce must not clobber it.
    title = "User typed";
    rerender({ field: Some({ text: "Other", nonce: 2 }) });
    expect(title).toBe("User typed");
  });
});
