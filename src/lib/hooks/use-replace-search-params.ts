import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Returns a function that edits the current URL's query params in place.
 * The path comes from `usePathname()`, which excludes `basePath`; the raw
 * browser path would get it prepended twice by `router.replace` (#475).
 */
export function useReplaceSearchParams(): (
  update: (params: URLSearchParams) => void
) => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (update) => {
      const next = new URLSearchParams(searchParams ?? undefined);
      update(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );
}
