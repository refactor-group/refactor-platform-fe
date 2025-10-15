import * as React from "react"
import { isNodeSelection, type Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor"

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/ui/tiptap-icons/corner-down-left-icon"
import { ExternalLinkIcon } from "@/components/ui/tiptap-icons/external-link-icon"
import { LinkIcon } from "@/components/ui/tiptap-icons/link-icon"
import { TrashIcon } from "@/components/ui/tiptap-icons/trash-icon"

// --- Lib ---
import { isMarkInSchema, sanitizeUrl } from "@/lib/tiptap-utils"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button"
import { Button } from "@/components/ui/tiptap-ui-primitive/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverBoundary,
  PopoverRootBoundary,
} from "@/components/ui/tiptap-ui-primitive/popover"
import { Separator } from "@/components/ui/tiptap-ui-primitive/separator"

// --- Styles ---
import "@/components/ui/tiptap-ui/link-popover/link-popover.scss"

export interface LinkHandlerProps {
  editor: Editor | null
  onSetLink?: () => void
  onLinkActive?: () => void
}

export interface LinkMainProps {
  url: string
  setUrl: React.Dispatch<React.SetStateAction<string | null>>
  setLink: () => void
  removeLink: () => void
  isActive: boolean
}

/**
 * Check if cursor is truly inside link content (not at immediate boundaries).
 * Implements Google Docs behavior: clicking inside link opens popover,
 * clicking at immediate edges (one position before/after) does not.
 */
const isCursorInsideLink = (editor: Editor): boolean => {
  if (!editor.isActive("link")) return false

  const { state } = editor
  const { from, to, $from } = state.selection

  // For range selections, consider it "inside"
  if (from !== to) return true

  // For collapsed selection (cursor), check if we're at immediate boundaries
  const linkMark = state.schema.marks.link
  const resolvedPos = $from

  // Get marks at current position
  const marksHere = resolvedPos.marks()
  const linkMarkHere = marksHere.find(m => m.type === linkMark)

  if (!linkMarkHere) return false

  // Check if we're at the immediate start or end boundary
  const beforePos = Math.max(0, from - 1)
  const afterPos = Math.min(state.doc.content.size, from + 1)

  // Get marks before and after cursor
  const marksBefore = beforePos >= 0 ? state.doc.resolve(beforePos).marks() : []
  const marksAfter = afterPos <= state.doc.content.size ? state.doc.resolve(afterPos).marks() : []

  const hasLinkBefore = marksBefore.some(m => m.type === linkMark && m.attrs.href === linkMarkHere.attrs.href)
  const hasLinkAfter = marksAfter.some(m => m.type === linkMark && m.attrs.href === linkMarkHere.attrs.href)

  // If we have link on EITHER side, we're inside (not at immediate boundary)
  // Only return false if we have NEITHER (which means we're at immediate boundary)
  return hasLinkBefore || hasLinkAfter
}

export const useLinkHandler = (props: LinkHandlerProps) => {
  const { editor, onSetLink, onLinkActive } = props
  const [url, setUrl] = React.useState<string | null>(null)
  const wasInsideLink = React.useRef(false)

  React.useEffect(() => {
    if (!editor) return

    const handleTransaction = ({ transaction }: { transaction: any }) => {
      // Always update URL state when on a link
      if (editor.isActive("link")) {
        const { href } = editor.getAttributes("link")
        setUrl(href || "")
      }

      // Check if cursor just entered the link (wasn't inside before, now is)
      const isInsideNow = isCursorInsideLink(editor)

      if (isInsideNow && !wasInsideLink.current) {
        // Just entered link - open popover
        onLinkActive?.()
      }

      wasInsideLink.current = isInsideNow
    }

    editor.on("transaction", handleTransaction)
    return () => {
      editor.off("transaction", handleTransaction)
    }
  }, [editor, onLinkActive])

  const setLink = React.useCallback(() => {
    if (!url || !editor) return

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()

    setUrl(null)

    onSetLink?.()
  }, [editor, onSetLink, url])

  const removeLink = React.useCallback(() => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .unsetLink()
      .setMeta("preventAutolink", true)
      .run()
    setUrl("")
  }, [editor])

  return {
    url: url || "",
    setUrl,
    setLink,
    removeLink,
    isActive: editor?.isActive("link") || false,
  }
}

export const LinkButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        type="button"
        className={className}
        data-style="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Link"
        tooltip="Link"
        ref={ref}
        {...props}
      >
        {children || <LinkIcon className="tiptap-button-icon" />}
      </Button>
    )
  }
)

export const LinkContent: React.FC<{
  editor?: Editor | null
}> = ({ editor: providedEditor }) => {
  const editor = useTiptapEditor(providedEditor)

  const linkHandler = useLinkHandler({
    editor: editor,
  })

  return <LinkMain {...linkHandler} />
}

const LinkMain: React.FC<LinkMainProps> = ({
  url,
  setUrl,
  setLink,
  removeLink,
  isActive,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      setLink()
    }
  }

  const handleOpenLink = () => {
    if (!url) return

    const safeUrl = sanitizeUrl(url, window.location.href)
    if (safeUrl !== "#") {
      window.open(safeUrl, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <>
      <input
        type="url"
        placeholder="Paste a link..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="tiptap-input tiptap-input-clamp"
      />

      <div className="tiptap-button-group" data-orientation="horizontal">
        <Button
          type="button"
          onClick={setLink}
          title="Apply link"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <CornerDownLeftIcon className="tiptap-button-icon" />
        </Button>
      </div>

      <Separator />

      <div className="tiptap-button-group" data-orientation="horizontal">
        <Button
          type="button"
          onClick={handleOpenLink}
          title="Open in new window"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <ExternalLinkIcon className="tiptap-button-icon" />
        </Button>

        <Button
          type="button"
          onClick={removeLink}
          title="Remove link"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <TrashIcon className="tiptap-button-icon" />
        </Button>
      </div>
    </>
  )
}

export interface LinkPopoverProps extends Omit<ButtonProps, "type"> {
  /**
   * The TipTap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether to hide the link popover.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback for when the popover opens or closes.
   */
  onOpenChange?: (isOpen: boolean) => void
  /**
   * Whether to automatically open the popover when a link is active.
   * @default true
   */
  autoOpenOnLinkActive?: boolean
  /**
   * Reference to the editor container for boundary detection.
   */
  containerRef?: React.RefObject<HTMLDivElement>
}

export function LinkPopover({
  editor: providedEditor,
  hideWhenUnavailable = false,
  onOpenChange,
  autoOpenOnLinkActive = true,
  containerRef,
  ...props
}: LinkPopoverProps) {
  const editor = useTiptapEditor(providedEditor)

  const linkInSchema = isMarkInSchema("link", editor)

  const [isOpen, setIsOpen] = React.useState(false)

  const onSetLink = () => {
    setIsOpen(false)
  }

  const onLinkActive = () => setIsOpen(autoOpenOnLinkActive)

  const linkHandler = useLinkHandler({
    editor: editor,
    onSetLink,
    onLinkActive,
  })

  const isDisabled = React.useMemo(() => {
    if (!editor) return true
    if (editor.isActive("codeBlock")) return true
    // Simplified check - allow if we can set marks or have text selected
    return false
  }, [editor])

  const canSetLink = React.useMemo(() => {
    if (!editor) return false
    try {
      return editor.can().setMark("link")
    } catch {
      return false
    }
  }, [editor])

  const isActive = editor?.isActive("link") ?? false

  const handleOnOpenChange = React.useCallback(
    (nextIsOpen: boolean) => {
      setIsOpen(nextIsOpen)
      onOpenChange?.(nextIsOpen)
    },
    [onOpenChange]
  )

  const show = React.useMemo(() => {
    // Temporarily bypass schema check - force show if editor exists
    if (!editor) {
      return false
    }

    if (hideWhenUnavailable) {
      if (isNodeSelection(editor.state.selection) || !canSetLink) {
        return false
      }
    }

    return true
  }, [hideWhenUnavailable, editor, canSetLink])

  // Create popover props with conditional boundary
  const popoverProps = React.useMemo(() => {
    const baseProps = {
      open: isOpen,
      onOpenChange: handleOnOpenChange,
    };
    
    // Only add boundary if we have a valid container
    if (containerRef?.current) {
      return {
        ...baseProps,
        boundary: containerRef.current,
        padding: 16,
      };
    }
    
    return baseProps;
  }, [isOpen, handleOnOpenChange, containerRef]);

  if (!show || !editor || !editor.isEditable) {
    return null
  }

  return (
    <Popover {...popoverProps}>
      <PopoverTrigger asChild>
        <LinkButton
          disabled={isDisabled}
          data-active-state={isActive ? "on" : "off"}
          data-disabled={isDisabled}
          {...props}
        />
      </PopoverTrigger>

      <PopoverContent
        sideOffset={8}
        alignOffset={0}
        side="bottom"
        align="start"
        initialFocus={-1}
      >
        <LinkMain {...linkHandler} />
      </PopoverContent>
    </Popover>
  )
}

LinkButton.displayName = "LinkButton"
