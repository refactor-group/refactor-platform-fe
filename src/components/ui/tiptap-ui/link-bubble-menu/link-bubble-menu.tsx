import * as React from "react"
import { type Editor, useCurrentEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"

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

  // Update URL when link becomes active
  React.useEffect(() => {
    if (!editor) return

    const updateUrl = () => {
      if (editor.isActive("link")) {
        const { href } = editor.getAttributes("link")
        setUrl(href || "")
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

  if (!editor) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor }: { editor: Editor }) => {
        return editor.isActive("link")
      }}
      updateDelay={100}
      options={{
        placement: 'bottom-start',
        offset: 8,
        flip: true,
        shift: true,
      }}
    >
      <div className="link-bubble-menu">
        <input
          type="url"
          placeholder="Paste a link..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
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
