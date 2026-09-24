import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SWRConfig } from "swr";
import { EntityApi } from "@/lib/api/entity-api";

interface Widget {
  id: string;
}

const defaultWidget = (): Widget => ({ id: "" });

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } },
    children
  );
}

describe("EntityApi.useEntity fallback", () => {
  it("keeps the same fallback object across renders while there is no url", () => {
    const { result, rerender } = renderHook(
      () => EntityApi.useEntity<Widget>(null, async () => ({ id: "x" }), defaultWidget()),
      { wrapper }
    );
    const first = result.current.entity;

    rerender();

    expect(result.current.entity).toBe(first);
  });

  it("keeps the same fallback object across renders after the fetch fails", async () => {
    const { result, rerender } = renderHook(
      () =>
        EntityApi.useEntity<Widget>(
          "/widgets/missing",
          () => Promise.reject(new Error("404")),
          defaultWidget()
        ),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isError).toBeTruthy());
    const first = result.current.entity;

    rerender();

    expect(result.current.entity).toBe(first);
  });

  it("keeps the fallback stable while pending, then returns fetched data", async () => {
    let resolve: (widget: Widget) => void = () => {};
    const pending = new Promise<Widget>((r) => (resolve = r));
    const { result, rerender } = renderHook(
      () => EntityApi.useEntity<Widget>("/widgets/1", () => pending, defaultWidget()),
      { wrapper }
    );
    const first = result.current.entity;

    rerender();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.entity).toBe(first);

    await act(async () => resolve({ id: "1" }));

    expect(result.current.entity.id).toBe("1");
  });
});
