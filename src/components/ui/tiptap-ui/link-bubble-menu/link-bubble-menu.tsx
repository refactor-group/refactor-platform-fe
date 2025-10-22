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

/** Vertical offset in pixels between the bubble menu and the selected text */
const BUBBLE_MENU_OFFSET_PX = 8;

/** Delay in milliseconds before the bubble menu updates its position after selection changes */
const BUBBLE_MENU_UPDATE_DELAY_MS = 100;

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

  // Update URL when link becomes active
  // Note: Zombie link cleanup is handled by LinkZombieCleanup extension
  React.useEffect(() => {
    if (!editor) return

    const updateUrl = () => {
      const isLinkActive = editor.isActive("link")

      if (isLinkActive) {
        const { href } = editor.getAttributes("link")
        setUrl(href || "")
      } else {
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
    offset: BUBBLE_MENU_OFFSET_PX,
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
      updateDelay={BUBBLE_MENU_UPDATE_DELAY_MS}
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
