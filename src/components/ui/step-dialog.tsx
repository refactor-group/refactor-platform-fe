"use client";

import type { KeyboardEvent, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckDisc } from "@/components/ui/check-disc";
import { Spinner } from "@/components/ui/spinner";
import { MODAL_DESKTOP_QUERY } from "@/lib/breakpoints";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { type Option, unwrapOr } from "@/types/option";

export interface StepRailItem {
  id: string;
  label: string;
  value: string;
  done: boolean;
  current: boolean;
}

/** Tall is 560px (New session), Standard is 520px. */
export enum StepDialogHeight {
  Tall = "tall",
  Standard = "standard",
}

/** Single is a read-only view: no position, arrows, footer or step list. */
export enum StepDialogVariant {
  Steps = "steps",
  Single = "single",
}

export type StepDialogLead =
  | { kind: "confirm"; label: string; disabled: boolean; pending: boolean; onConfirm: () => void }
  | { kind: "hint"; text: string }
  | { kind: "none" };

type ConfirmLead = Extract<StepDialogLead, { kind: "confirm" }>;

interface StepPosition {
  index: number;
  total: number;
}

interface StepDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  railHeader?: ReactNode;
  steps: StepRailItem[];
  railFooter?: ReactNode;
  stepTitle: string;
  stepSubline?: string;
  children: ReactNode;
  lead: StepDialogLead;
  position: StepPosition;
  onPrev: Option<() => void>;
  onNext: Option<() => void>;
  height: StepDialogHeight;
  variant: StepDialogVariant;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]);

function heightClass(height: StepDialogHeight): string {
  switch (height) {
    case StepDialogHeight.Tall:
      return "h-[560px]";
    case StepDialogHeight.Standard:
      return "h-[520px]";
    default: {
      const _exhaustive: never = height;
      throw new Error(`Unhandled StepDialogHeight: ${_exhaustive}`);
    }
  }
}

function isEnabledConfirm(lead: StepDialogLead): lead is ConfirmLead {
  return lead.kind === "confirm" && !lead.disabled && !lead.pending;
}

function ownsEnter(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    TYPING_TAGS.has(target.tagName) ||
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

function confirmOnEnter(lead: StepDialogLead) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (!isEnabledConfirm(lead) || ownsEnter(event.target)) return;
    event.preventDefault();
    lead.onConfirm();
  };
}

/** Focus the dialog itself on open so no control shows a ring until the user tabs. */
function focusContent(event: Event) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
}

function positionText({ index, total }: StepPosition): string {
  return `${index} of ${total}`;
}

// ─── Shared pieces ───────────────────────────────────────────────────

function ConfirmButton({ lead, size }: { lead: ConfirmLead; size: "lg" | "xl" }) {
  return (
    <Button size={size} disabled={lead.disabled || lead.pending} onClick={lead.onConfirm}>
      {lead.pending && <Spinner aria-hidden />}
      {lead.label}
    </Button>
  );
}

function CloseButton({ size, className }: { size: "icon-sm" | "icon-md"; className?: string }) {
  return (
    <DialogPrimitive.Close asChild>
      <Button variant="ghost" size={size} aria-label="Close" className={className}>
        <X className="!h-[18px] !w-[18px] text-ink-2" />
      </Button>
    </DialogPrimitive.Close>
  );
}

function StepArrow({ direction, onStep }: { direction: "prev" | "next"; onStep: Option<() => void> }) {
  const prev = direction === "prev";
  return (
    <Button
      variant="secondary"
      size="icon-lg"
      aria-label={prev ? "Previous step" : "Next step"}
      disabled={onStep.none}
      onClick={onStep.some ? onStep.val : undefined}
    >
      {prev ? <ArrowLeft /> : <ArrowRight />}
    </Button>
  );
}

function StepSubline({ text }: { text: string }) {
  return <p className="mt-2 text-sm text-ink-2">{text}</p>;
}

// ─── Desktop: rail + pane ────────────────────────────────────────────

function RailRow({ step }: { step: StepRailItem }) {
  return (
    <li
      aria-current={step.current ? "step" : undefined}
      className={cn("flex gap-2.5 rounded-lg p-2.5", step.current && "bg-rail-current")}
    >
      {step.done && (
        <CheckDisc size={16} tone="positive" className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-muted-foreground">{step.label}</div>
        <div
          className={cn(
            "line-clamp-2 break-words text-item font-medium",
            step.done ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {step.value}
        </div>
      </div>
    </li>
  );
}

function Rail({
  title,
  railHeader,
  steps,
  railFooter,
}: Pick<StepDialogProps, "title" | "railHeader" | "steps" | "railFooter">) {
  return (
    <div className="flex min-h-0 flex-col border-r border-rail-border bg-card pb-6 pl-6 pr-4 pt-7">
      <DialogPrimitive.Title className="text-card-title font-semibold">{title}</DialogPrimitive.Title>
      {railHeader && <div className="mt-3.5">{railHeader}</div>}
      {steps.length > 0 && (
        <ol aria-label="Steps" className="-mx-2 mt-[18px]">
          {steps.map((step) => (
            <RailRow key={step.id} step={step} />
          ))}
        </ol>
      )}
      {railFooter && <div className="mt-auto border-t border-hairline pt-3.5">{railFooter}</div>}
    </div>
  );
}

function StepHeading({
  desktop,
  stepTitle,
  stepSubline,
}: Pick<StepDialogProps, "stepTitle" | "stepSubline"> & { desktop: boolean }) {
  return (
    <div>
      <h2 className={desktop ? "text-headline leading-[1.15]" : "text-section"}>{stepTitle}</h2>
      {stepSubline && <StepSubline text={stepSubline} />}
    </div>
  );
}

function PaneLead({ lead }: { lead: StepDialogLead }) {
  switch (lead.kind) {
    case "confirm":
      return <ConfirmButton lead={lead} size="lg" />;
    case "hint":
      return <p className="text-[13px] text-muted-foreground">{lead.text}</p>;
    case "none":
      return null;
    default: {
      const _exhaustive: never = lead;
      throw new Error(`Unhandled StepDialogLead: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function PaneFooter({
  lead,
  position,
  onPrev,
  onNext,
}: Pick<StepDialogProps, "lead" | "position" | "onPrev" | "onNext">) {
  return (
    <div className="mt-auto flex items-center gap-2 pt-4">
      <PaneLead lead={lead} />
      <div className="flex-1" />
      <span className="mr-1 text-label tabular-nums text-muted-foreground">
        {positionText(position)}
      </span>
      <StepArrow direction="prev" onStep={onPrev} />
      <StepArrow direction="next" onStep={onNext} />
    </div>
  );
}

// ─── Mobile: full-screen step view ───────────────────────────────────

function MobileTopBar({
  title,
  position,
  single,
}: Pick<StepDialogProps, "title" | "position"> & { single: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center border-b border-hairline bg-card px-4">
      <DialogPrimitive.Title className="text-item font-medium">{title}</DialogPrimitive.Title>
      {!single && (
        <>
          <span aria-hidden className="mx-1.5 text-muted-foreground">
            ·
          </span>
          <span className="text-item tabular-nums text-muted-foreground">{positionText(position)}</span>
        </>
      )}
      <div className="flex-1" />
      <CloseButton size="icon-md" />
    </div>
  );
}

function MobileFooterAction({ lead, onNext }: Pick<StepDialogProps, "lead" | "onNext">) {
  if (onNext.some) {
    return (
      <Button size="xl" onClick={onNext.val}>
        Next
      </Button>
    );
  }
  return lead.kind === "confirm" ? <ConfirmButton lead={lead} size="xl" /> : null;
}

function MobileFooter({ lead, onPrev, onNext }: Pick<StepDialogProps, "lead" | "onPrev" | "onNext">) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-hairline bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <StepArrow direction="prev" onStep={onPrev} />
      {lead.kind === "hint" ? (
        <p className="flex-1 text-[13px] text-muted-foreground">{lead.text}</p>
      ) : (
        <div className="flex-1" />
      )}
      <MobileFooterAction lead={lead} onNext={onNext} />
    </div>
  );
}

// ─── One tree for both layouts ──────────────────────────────────────

const ANIMATE =
  "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none";

function contentClass(desktop: boolean, height: StepDialogHeight): string {
  return desktop
    ? cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[860px] max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 grid-cols-[300px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-card shadow-modal outline-none dark:border",
        heightClass(height),
        ANIMATE,
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
      )
    : cn("fixed inset-0 z-50 flex flex-col bg-well outline-none", ANIMATE);
}

/**
 * Both layouts share one element tree, so crossing 900px restyles the step body instead of
 * remounting it, and anything held in it (a search, a half-typed value) survives.
 */
function StepDialogContent({ desktop, ...props }: StepDialogProps & { desktop: boolean }) {
  const single = props.variant === StepDialogVariant.Single;
  return (
    <DialogPrimitive.Content
      tabIndex={-1}
      onOpenAutoFocus={focusContent}
      aria-describedby={undefined}
      onKeyDown={single ? undefined : confirmOnEnter(props.lead)}
      className={contentClass(desktop, props.height)}
    >
      {desktop ? (
        <Rail
          title={props.title}
          railHeader={props.railHeader}
          steps={single ? [] : props.steps}
          railFooter={props.railFooter}
        />
      ) : (
        <MobileTopBar title={props.title} position={props.position} single={single} />
      )}
      <div
        className={
          desktop
            ? "relative flex min-h-0 flex-col bg-well pb-7 pl-11 pr-9 pt-8"
            : "min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6"
        }
      >
        {desktop && <CloseButton size="icon-sm" className="absolute right-4 top-4" />}
        {!desktop && props.railHeader && <div className="mb-6">{props.railHeader}</div>}
        <StepHeading desktop={desktop} stepTitle={props.stepTitle} stepSubline={props.stepSubline} />
        {/* Desktop insets the scroll box by its negative margins so edge focus rings aren't clipped. */}
        <div className={desktop ? "-mx-1 -mb-1 mt-5 min-h-0 flex-1 overflow-y-auto p-1" : "mt-6"}>
          {props.children}
        </div>
        {desktop
          ? !single && (
              <PaneFooter lead={props.lead} position={props.position} onPrev={props.onPrev} onNext={props.onNext} />
            )
          : props.railFooter && <div className="mt-8">{props.railFooter}</div>}
      </div>
      {!desktop && !single && (
        <MobileFooter lead={props.lead} onPrev={props.onPrev} onNext={props.onNext} />
      )}
    </DialogPrimitive.Content>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────

/** The shared stepped modal: a two-pane dialog at ≥900px, a full-screen step view below. */
export function StepDialog(props: StepDialogProps) {
  const desktop = unwrapOr(useMediaQuery(MODAL_DESKTOP_QUERY), false);
  return (
    <DialogPrimitive.Root open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-scrim", ANIMATE)} />
        <StepDialogContent desktop={desktop} {...props} />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
