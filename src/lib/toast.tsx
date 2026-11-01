import { toast as sonnerToast } from "sonner";
import { ToastPill, type ToastAction, type ToastKind } from "@/components/ui/toast-pill";
import { type Option, None, Some } from "@/types/option";

export type { ToastAction, ToastKind };

type ToastId = string | number;
type ToastMessage = string;

export interface ToastOptions {
  id?: ToastId;
  /** Milliseconds; Infinity keeps the toast until dismissed. */
  duration?: number;
  action?: ToastAction;
  cancel?: ToastAction;
}

const DEFAULT_DURATION_MS = 6000;

let shownIds: ToastId[] = [];

const forget = (id: ToastId) => {
  shownIds = shownIds.filter((shown) => shown !== id);
};

const fromOptional = <T,>(value: T | undefined): Option<T> =>
  value === undefined ? None : Some(value);

const countdownFor = (kind: ToastKind, duration: number | undefined): Option<number> => {
  if (kind === "loading") return None;
  const ms = duration ?? DEFAULT_DURATION_MS;
  return Number.isFinite(ms) ? Some(ms) : None;
};

function dismiss(id?: ToastId): void {
  if (id === undefined) {
    shownIds = [];
  } else {
    forget(id);
  }
  sonnerToast.dismiss(id);
}

function show(kind: ToastKind, message: ToastMessage, options: ToastOptions = {}): ToastId {
  const id = sonnerToast.custom(
    (toastId) => (
      <ToastPill
        kind={kind}
        message={message}
        durationMs={countdownFor(kind, options.duration)}
        action={fromOptional(options.action)}
        cancel={fromOptional(options.cancel)}
        onDismiss={() => dismiss(toastId)}
      />
    ),
    { id: options.id, duration: Infinity }
  );
  forget(id);
  shownIds.push(id);
  return id;
}

/** Dismisses the newest toast on Escape; returns whether it did. */
export function handleToastEscape(event: KeyboardEvent): boolean {
  const newest = shownIds.at(-1);
  // A Radix layer that already handled this Escape calls preventDefault.
  if (event.key !== "Escape" || event.defaultPrevented || newest === undefined) return false;
  dismiss(newest);
  return true;
}

type ToastFn = (message: ToastMessage, options?: ToastOptions) => ToastId;

export const toast: ToastFn & {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
  loading: ToastFn;
  dismiss: (id?: ToastId) => void;
} = Object.assign((message: ToastMessage, options?: ToastOptions) => show("neutral", message, options), {
  success: (message: ToastMessage, options?: ToastOptions) => show("success", message, options),
  error: (message: ToastMessage, options?: ToastOptions) => show("error", message, options),
  info: (message: ToastMessage, options?: ToastOptions) => show("info", message, options),
  warning: (message: ToastMessage, options?: ToastOptions) => show("warning", message, options),
  loading: (message: ToastMessage, options?: ToastOptions) => show("loading", message, options),
  dismiss,
});
