import * as React from "react"
import type { Placement } from "@floating-ui/react"
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  useMergeRefs,
  FloatingFocusManager,
  limitShift,
  FloatingPortal,
} from "@floating-ui/react"
import "@/components/ui/tiptap-ui-primitive/popover/popover.scss"

// Type-safe enums for popover configuration
enum PopoverBoundary {
  viewport = 'viewport',
  scrollParent = 'scrollParent',
  element = 'element'
}

enum PopoverRootBoundary {
  viewport = 'viewport',
  document = 'document'
}

type PopoverContextValue = ReturnType<typeof usePopover> & {
  setLabelId: (id: string | undefined) => void
  setDescriptionId: (id: string | undefined) => void
  updatePosition: (
    side: "top" | "right" | "bottom" | "left",
    align: "start" | "center" | "end",
    sideOffset?: number,
    alignOffset?: number
  ) => void
}

interface PopoverOptions {
  initialOpen?: boolean
  modal?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  alignOffset?: number
  boundary?: HTMLElement | PopoverBoundary
  rootBoundary?: PopoverRootBoundary
  padding?: number
}

interface PopoverProps extends PopoverOptions {
  children: React.ReactNode
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverContext() {
  const context = React.useContext(PopoverContext)
  if (!context) {
    throw new Error("Popover components must be wrapped in <Popover />")
  }
  return context
}

function usePopover({
  initialOpen = false,
  modal,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  boundary = PopoverBoundary.scrollParent,
  rootBoundary = PopoverRootBoundary.viewport,
  padding = 8,
}: PopoverOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)
  const [labelId, setLabelId] = React.useState<string>()
  const [descriptionId, setDescriptionId] = React.useState<string>()
  const [currentPlacement, setCurrentPlacement] = React.useState<Placement>(
    `${side}-${align}` as Placement
  )
  const [offsets, setOffsets] = React.useState({ sideOffset, alignOffset })

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  // Helper function to resolve boundary for FloatingUI
  const resolveBoundary = (boundary: HTMLElement | PopoverBoundary) => {
    if (boundary instanceof HTMLElement) {
      return boundary;
    }
    // Return undefined for enum values - FloatingUI will handle them properly
    // Only pass HTMLElement boundaries explicitly
    return undefined;
  };

  const middleware = React.useMemo(
    () => [
      offset({
        mainAxis: offsets.sideOffset,
        crossAxis: offsets.alignOffset,
      }),
      flip({
        fallbackAxisSideDirection: "end",
        crossAxis: false,
        boundary: resolveBoundary(boundary),
        rootBoundary,
        padding,
      }),
      shift({
        limiter: limitShift({ 
          offset: offsets.sideOffset,
          crossAxis: true,
          mainAxis: true,
        }),
        boundary: resolveBoundary(boundary),
        rootBoundary,
        padding,
      }),
      size({
        boundary: resolveBoundary(boundary),
        rootBoundary,
        padding,
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${availableWidth}px`,
            maxHeight: `${availableHeight}px`,
          });
        },
      }),
    ],
    [offsets.sideOffset, offsets.alignOffset, boundary, rootBoundary, padding]
  )

  const floating = useFloating({
    placement: currentPlacement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: (reference, floating, update) => {
      // Enhanced auto-update with scroll and resize detection
      return autoUpdate(reference, floating, update, {
        ancestorScroll: true, // Listen to all scrollable ancestors
        ancestorResize: true,
        elementResize: true,
        layoutShift: true, // Handle layout shifts
        animationFrame: false, // Use events for better performance
      });
    },
    middleware,
    strategy: 'fixed', // Use fixed positioning for portaling to document.body
  })

  const interactions = useInteractions([
    useClick(floating.context),
    useDismiss(floating.context),
    useRole(floating.context),
  ])

  const updatePosition = React.useCallback(
    (
      newSide: "top" | "right" | "bottom" | "left",
      newAlign: "start" | "center" | "end",
      newSideOffset?: number,
      newAlignOffset?: number
    ) => {
      setCurrentPlacement(`${newSide}-${newAlign}` as Placement)
      if (newSideOffset !== undefined || newAlignOffset !== undefined) {
        setOffsets({
          sideOffset: newSideOffset ?? offsets.sideOffset,
          alignOffset: newAlignOffset ?? offsets.alignOffset,
        })
      }
    },
    [offsets.sideOffset, offsets.alignOffset]
  )

  return React.useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...floating,
      modal,
      labelId,
      descriptionId,
      setLabelId,
      setDescriptionId,
      updatePosition,
    }),
    [
      open,
      setOpen,
      interactions,
      floating,
      modal,
      labelId,
      descriptionId,
      updatePosition,
    ]
  )
}

function Popover({ children, modal = false, ...options }: PopoverProps) {
  const popover = usePopover({ modal, ...options })
  return (
    <PopoverContext.Provider value={popover}>
      {children}
    </PopoverContext.Provider>
  )
}

interface TriggerElementProps extends React.HTMLProps<HTMLElement> {
  asChild?: boolean
}

const PopoverTrigger = React.forwardRef<HTMLElement, TriggerElementProps>(
  function PopoverTrigger({ children, asChild = false, ...props }, propRef) {
    const context = usePopoverContext()
    const childrenRef = React.isValidElement(children)
      ? parseInt(React.version, 10) >= 19
        ? (children.props as any).ref
        : (children as any).ref
      : undefined
    const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef])

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children,
        context.getReferenceProps({
          ref,
          ...props,
          ...(children.props as any),
          "data-state": context.open ? "open" : "closed",
        })
      )
    }

    return (
      <button
        ref={ref}
        data-state={context.open ? "open" : "closed"}
        {...context.getReferenceProps(props)}
      >
        {children}
      </button>
    )
  }
)

interface PopoverContentProps extends React.HTMLProps<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  alignOffset?: number
  portal?: boolean
  portalProps?: Omit<React.ComponentProps<typeof FloatingPortal>, "children">
  asChild?: boolean
  modal?: boolean
  /**
   * Controls which element receives focus when the popover opens.
   * - number: Element index (-1 = no focus, 0 = first focusable, 1 = second, etc.)
   * - React.MutableRefObject: Ref to specific element that should receive focus
   */
  initialFocus?: number | React.MutableRefObject<HTMLElement | null>
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    {
      className,
      side = "bottom",
      align = "center",
      sideOffset,
      alignOffset,
      style,
      portal = true,
      portalProps = {},
      asChild = false,
      modal,
      initialFocus,
      children,
      ...props
    },
    propRef
  ) {
    const context = usePopoverContext()
    const childrenRef = React.isValidElement(children)
      ? parseInt(React.version, 10) >= 19
        ? (children.props as any).ref
        : (children as any).ref
      : undefined
    const ref = useMergeRefs([context.refs.setFloating, propRef, childrenRef])

    React.useEffect(() => {
      context.updatePosition(side, align, sideOffset, alignOffset)
    }, [context, side, align, sideOffset, alignOffset])

    // Determine portal container - always use document.body for portal
    // The boundary prop handles positioning constraints, not the portal container
    const portalContainer = React.useMemo(() => {
      if (!portal) return null;
      // Always use document.body - FloatingUI handles positioning with boundaries
      return document.body;
    }, [portal]);

    // Use FloatingUI's calculated position directly
    const enhancedStyle = React.useMemo(() => {
      return {
        position: context.strategy,
        top: context.y ?? 0,
        left: context.x ?? 0,
        ...style,
      };
    }, [context, style]);

    // Defensive check: Don't render if we don't have valid positioning
    // This prevents rendering at 0,0 when FloatingUI hasn't calculated position yet
    if (!context.context.open) return null;
    if (context.x === null || context.y === null) return null;

    const contentProps = {
      ref,
      style: enhancedStyle,
      "aria-labelledby": context.labelId,
      "aria-describedby": context.descriptionId,
      className: `tiptap-popover ${className || ""}`,
      "data-side": side,
      "data-align": align,
      "data-state": context.context.open ? "open" : "closed",
      ...context.getFloatingProps(props),
    }

    const content =
      asChild && React.isValidElement(children) ? (
        React.cloneElement(children, {
          ...contentProps,
          ...(children.props as any),
        })
      ) : (
        <div {...contentProps}>{children}</div>
      )

    const wrappedContent = (
      <FloatingFocusManager
        context={context.context}
        modal={modal !== undefined ? modal : context.modal}
        initialFocus={initialFocus}
      >
        {content}
      </FloatingFocusManager>
    )

    if (portal && portalContainer) {
      return (
        <FloatingPortal {...portalProps} root={portalContainer}>
          {wrappedContent}
        </FloatingPortal>
      );
    }

    return wrappedContent
  }
)

PopoverTrigger.displayName = "PopoverTrigger"
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent, PopoverBoundary, PopoverRootBoundary }
