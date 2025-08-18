import React, { useMemo, useCallback } from "react"
import { isNodeSelection, type Editor, useEditorState } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor"

// --- Icons ---
import { BoldIcon } from "@/components/ui/tiptap-icons/bold-icon"
import { Code2Icon } from "@/components/ui/tiptap-icons/code2-icon"
import { ItalicIcon } from "@/components/ui/tiptap-icons/italic-icon"
import { StrikeIcon } from "@/components/ui/tiptap-icons/strike-icon"
import { UnderlineIcon } from "@/components/ui/tiptap-icons/underline-icon"

// --- Lib ---
import { isMarkInSchema } from "@/lib/tiptap-utils"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button"
import { Button } from "@/components/ui/tiptap-ui-primitive/button"

export type Mark =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "underline"

export interface MarkButtonProps extends Omit<ButtonProps, "type"> {
  /**
   * The type of mark to toggle
   */
  type: Mark
  /**
   * Optional editor instance. If not provided, will use editor from context
   */
  editor?: Editor | null
  /**
   * Display text for the button (optional)
   */
  text?: string
  /**
   * Whether this button should be hidden when the mark is not available
   */
  hideWhenUnavailable?: boolean
}

export const markIcons = {
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  strike: StrikeIcon,
  code: Code2Icon,
}

export const markShortcutKeys: Partial<Record<Mark, string>> = {
  bold: "Ctrl-b",
  italic: "Ctrl-i",
  underline: "Ctrl-u",
  strike: "Ctrl-Shift-s",
  code: "Ctrl-e",
}

export function canToggleMark(editor: Editor | null, type: Mark): boolean {
  if (!editor) return false

  try {
    return editor.can().toggleMark(type)
  } catch {
    return false
  }
}

export function isMarkActive(editor: Editor | null, type: Mark): boolean {
  if (!editor) return false
  return editor.isActive(type)
}

export function toggleMark(editor: Editor | null, type: Mark): void {
  if (!editor) return
  editor.chain().focus().toggleMark(type).run()
}

export function isMarkButtonDisabled(
  editor: Editor | null,
  type: Mark,
  userDisabled: boolean = false
): boolean {
  if (!editor) return true
  if (userDisabled) return true
  if (editor.isActive("codeBlock")) return true
  if (!canToggleMark(editor, type)) return true
  return false
}

export function shouldShowMarkButton(params: {
  editor: Editor | null
  type: Mark
  hideWhenUnavailable: boolean
  markInSchema: boolean
}): boolean {
  const { editor, type, hideWhenUnavailable, markInSchema } = params

  if (!markInSchema || !editor) {
    return false
  }

  if (hideWhenUnavailable) {
    if (
      isNodeSelection(editor.state.selection) ||
      !canToggleMark(editor, type)
    ) {
      return false
    }
  }

  return true
}

export function getFormattedMarkName(type: Mark): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function useMarkState(
  editor: Editor | null,
  type: Mark,
  disabled: boolean = false
) {
  const markInSchema = useMemo(
    () => isMarkInSchema(type, editor),
    [type, editor]
  )

  // Use useEditorState to reactively track editor state changes
  const editorState = useEditorState({
    editor,
    selector: useCallback((ctx) => {
      if (!ctx.editor) return { canToggle: false, isActive: false, isInCodeBlock: false };
      return {
        canToggle: ctx.editor.can().toggleMark(type),
        isActive: ctx.editor.isActive(type),
        isInCodeBlock: ctx.editor.isActive("codeBlock"),
      };
    }, [type]),
  });

  const canToggle = editorState?.canToggle ?? false;
  const isActive = editorState?.isActive ?? false;
  const isInCodeBlock = editorState?.isInCodeBlock ?? false;

  // Calculate disabled state using reactive values
  const isDisabled = useMemo(() => {
    if (!editor) return true;
    if (disabled) return true;
    if (isInCodeBlock) return true;
    if (!canToggle) return true;
    return false;
  }, [editor, disabled, isInCodeBlock, canToggle]);

  const Icon = markIcons[type]
  const shortcutKey = markShortcutKeys[type]
  const formattedName = getFormattedMarkName(type)

  return {
    markInSchema,
    isDisabled,
    isActive,
    canToggle,
    Icon,
    shortcutKey,
    formattedName,
  }
}

export const MarkButton = React.forwardRef<HTMLButtonElement, MarkButtonProps>(
  (
    {
      editor: providedEditor,
      type,
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

    const {
      markInSchema,
      isDisabled,
      isActive,
      canToggle,
      Icon,
      shortcutKey,
      formattedName,
    } = useMarkState(editor, type, disabled)

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)

        if (!e.defaultPrevented && !isDisabled && editor) {
          toggleMark(editor, type)
        }
      },
      [onClick, isDisabled, editor, type]
    )

    const show = useMemo(() => {
      if (!markInSchema || !editor) {
        return false
      }

      if (hideWhenUnavailable) {
        if (
          isNodeSelection(editor.state.selection) ||
          !canToggle
        ) {
          return false
        }
      }

      return true
    }, [editor, hideWhenUnavailable, markInSchema, canToggle])

    if (!show || !editor || !editor.isEditable) {
      return null
    }

    return (
      <Button
        type="button"
        className={className.trim()}
        disabled={isDisabled}
        data-style="ghost"
        data-active-state={isActive ? "on" : "off"}
        data-disabled={isDisabled}
        role="button"
        tabIndex={-1}
        aria-label={type}
        aria-pressed={isActive}
        tooltip={formattedName}
        shortcutKeys={shortcutKey}
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children || (
          <>
            <Icon className="tiptap-button-icon" />
            {text && <span className="tiptap-button-text">{text}</span>}
          </>
        )}
      </Button>
    )
  }
)

MarkButton.displayName = "MarkButton"

export default MarkButton
