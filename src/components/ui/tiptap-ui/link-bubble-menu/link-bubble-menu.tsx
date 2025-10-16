import * as React from "react"
import { type Editor, useCurrentEditor } from "@tiptap/react"
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus"

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/ui/tiptap-icons/corner-down-left-icon"
import { ExternalLinkIcon } from "@/components/ui/tiptap-icons/external-link-icon"
import { TrashIcon } from "@/components/ui/tiptap-icons/trash-icon"

// --- Lib ---
import { sanitizeUrl } from "@/lib/tiptap-utils"

// --- UI Primitives ---
import { Button } from "@/components/ui/tiptap-ui-primitive/button"
import { Separator } from "@/components/ui/tiptap-ui-primitive/separator"

// --- Styles ---
import "@/components/ui/tiptap-ui/link-bubble-menu/link-bubble-menu.scss"

export interface LinkBubbleMenuProps {
  /**
   * The TipTap editor instance (optional, will use context if not provided).
   */
  editor?: Editor | null
}

export function LinkBubbleMenu({ editor: providedEditor }: LinkBubbleMenuProps) {
  const { editor: contextEditor } = useCurrentEditor()
  const editor = providedEditor || contextEditor
  const [url, setUrl] = React.useState<string>("")

  // Track if link was active and its href value
  const wasLinkActiveRef = React.useRef(false)
  const lastHrefRef = React.useRef<string>("")

  // Update URL when link becomes active, and clean up empty links when deactivated
  React.useEffect(() => {
    if (!editor) return

    const updateUrl = () => {
      const isLinkActive = editor.isActive("link")

      if (isLinkActive) {
        const { href } = editor.getAttributes("link")
        setUrl(href || "")
        lastHrefRef.current = href || ""
        wasLinkActiveRef.current = true
      } else if (wasLinkActiveRef.current) {
        // Link just became inactive (user clicked away)
        // If the last href was empty, it means we created a zombie link - remove it
        if (!lastHrefRef.current || lastHrefRef.current === "") {
          // Find and remove any empty link marks in the document
          const { state } = editor
          const { from, to } = state.selection
          let foundEmptyLink = false

          // Use nodesBetween for better performance - only search around cursor position
          // Expand search range slightly to catch nearby links
          const searchFrom = Math.max(0, from - 100)
          const searchTo = Math.min(state.doc.content.size, to + 100)

          state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
            if (foundEmptyLink) return false

            const marks = node.marks
            const linkMark = marks.find(mark => mark.type.name === "link")

            if (linkMark && (!linkMark.attrs.href || linkMark.attrs.href === "")) {
              // Remove this empty link mark without selecting the text
              const linkFrom = pos
              const linkTo = pos + node.nodeSize
              editor
                .chain()
                .setTextSelection({ from: linkFrom, to: linkTo })
                .unsetLink()
                .setMeta("preventAutolink", true)
                .setTextSelection(editor.state.selection.from) // Move cursor to single position
                .run()
              foundEmptyLink = true
              return false
            }
          })
        }

        // Reset tracking
        wasLinkActiveRef.current = false
        lastHrefRef.current = ""
        setUrl("")
      }
    }

    updateUrl()
    editor.on("selectionUpdate", updateUrl)
    editor.on("transaction", updateUrl)

    return () => {
      editor.off("selectionUpdate", updateUrl)
      editor.off("transaction", updateUrl)
    }
  }, [editor])

  const setLink = React.useCallback(() => {
    if (!url || !editor) return

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor, url])

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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

  if (!editor) {
    return null
  }

  const bubbleMenuOptions = {
    placement: 'bottom-start',
    offset: 8,
    flip: true,
    shift: true,
  } as const

  const shouldShow: NonNullable<BubbleMenuProps['shouldShow']> = ({ editor }) => {
    return editor.isActive("link")
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      updateDelay={100}
      options={bubbleMenuOptions}
    >
      <div className="link-bubble-menu">
        <input
          type="url"
          placeholder="Paste a link..."
          value={url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="link-bubble-input"
        />

        <div className="link-bubble-actions">
          <Button
            type="button"
            onClick={setLink}
            title="Apply link"
            disabled={!url}
            data-style="ghost"
          >
            <CornerDownLeftIcon className="tiptap-button-icon" />
          </Button>

          <Separator orientation="vertical" />

          <Button
            type="button"
            onClick={handleOpenLink}
            title="Open in new window"
            disabled={!url}
            data-style="ghost"
          >
            <ExternalLinkIcon className="tiptap-button-icon" />
          </Button>

          <Button
            type="button"
            onClick={removeLink}
            title="Remove link"
            disabled={!url}
            data-style="ghost"
          >
            <TrashIcon className="tiptap-button-icon" />
          </Button>
        </div>
      </div>
    </BubbleMenu>
  )
}
