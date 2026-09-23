import * as React from "react"
import type { Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor"

// --- Icons ---
import { ImageIcon } from "@/components/ui/tiptap-icons/image-icon"

// --- Lib ---
import { isNodeInSchema } from "@/lib/tiptap-utils"
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/types/coaching-session-image"

// --- Coaching Notes ---
import {
  COACHING_NOTE_IMAGE_NAME,
  uploadFilesInOrder,
  type NoteImageUploadContext,
} from "@/components/ui/coaching-sessions/coaching-notes/note-image-extension"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button"
import { Button } from "@/components/ui/tiptap-ui-primitive/button"

export interface ImageUploadButtonProps extends Omit<ButtonProps, "type"> {
  /**
   * The TipTap editor instance.
   */
  editor?: Editor | null
  /**
   * Where uploaded images belong, and the largest file accepted.
   */
  context: NoteImageUploadContext
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
  /**
   * Whether the button should hide when the node is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
}

export function canInsertImage(editor: Editor | null): boolean {
  if (!editor) return false
  if (!isNodeInSchema(COACHING_NOTE_IMAGE_NAME, editor)) return false
  return editor.isEditable
}

export function isImageUploadButtonDisabled(
  editor: Editor | null,
  canInsert: boolean,
  userDisabled: boolean = false
): boolean {
  if (!editor) return true
  if (userDisabled) return true
  if (!canInsert) return true
  return false
}

export function shouldShowImageUploadButton(params: {
  editor: Editor | null
  hideWhenUnavailable: boolean
  nodeInSchema: boolean
}): boolean {
  const { editor, hideWhenUnavailable, nodeInSchema } = params

  if (!editor) return false
  if (!nodeInSchema && hideWhenUnavailable) return false

  return Boolean(editor.isEditable)
}

export function useImageUploadState(
  editor: Editor | null,
  disabled: boolean = false,
  hideWhenUnavailable: boolean = false
) {
  const nodeInSchema = isNodeInSchema(COACHING_NOTE_IMAGE_NAME, editor)

  const canInsert = canInsertImage(editor)
  const isDisabled = isImageUploadButtonDisabled(editor, canInsert, disabled)

  const shouldShow = React.useMemo(
    () =>
      shouldShowImageUploadButton({
        editor,
        hideWhenUnavailable,
        nodeInSchema,
      }),
    [editor, hideWhenUnavailable, nodeInSchema]
  )

  const label = "Insert image"

  return {
    nodeInSchema,
    canInsert,
    isDisabled,
    shouldShow,
    label,
  }
}

export const ImageUploadButton = React.forwardRef<
  HTMLButtonElement,
  ImageUploadButtonProps
>(
  (
    {
      editor: providedEditor,
      context,
      text,
      hideWhenUnavailable = false,
      className = "",
      disabled,
      onClick,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const editor = useTiptapEditor(providedEditor)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const { isDisabled, shouldShow, label } = useImageUploadState(
      editor,
      disabled,
      hideWhenUnavailable
    )

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)

        if (!e.defaultPrevented && !isDisabled) {
          inputRef.current?.click()
        }
      },
      [onClick, isDisabled]
    )

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        // Picking the same file twice in a row fires no change event otherwise.
        e.target.value = ""

        if (!editor) return
        // Same path as drop and paste: uploads run in the order picked, and a
        // rejection is reported rather than escaping as an unhandled one.
        void uploadFilesInOrder(editor, files, context)
      },
      [editor, context]
    )

    if (!shouldShow || !editor) {
      return null
    }

    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={handleChange}
        />
        <Button
          type="button"
          className={className.trim()}
          disabled={isDisabled}
          data-style="ghost"
          data-disabled={isDisabled}
          role="button"
          tabIndex={-1}
          aria-label={label}
          tooltip={label}
          onClick={handleClick}
          {...buttonProps}
          ref={ref}
        >
          {children || (
            <>
              <ImageIcon className="tiptap-button-icon" />
              {text && <span className="tiptap-button-text">{text}</span>}
            </>
          )}
        </Button>
      </>
    )
  }
)

ImageUploadButton.displayName = "ImageUploadButton"

export default ImageUploadButton
