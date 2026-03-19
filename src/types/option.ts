// ─── Option<T> ───────────────────────────────────────────────────────
// Lightweight Option type mirroring Rust's Option<T> for modeling
// presence/absence without nullable unions. For success/failure at
// async boundaries, use neverthrow's Result<T, E> instead.

/** A present value. */
export type Some<T> = { readonly some: true; readonly none: false; readonly val: T };

/** An absent value. */
export type None = { readonly some: false; readonly none: true };

/** A value that is either present (Some) or absent (None). */
export type Option<T> = Some<T> | None;

/** Wrap a present value. */
export function Some<T>(val: T): Some<T> {
  return { some: true, none: false, val };
}

/** The singleton absent value. */
export const None: None = { some: false, none: true };
