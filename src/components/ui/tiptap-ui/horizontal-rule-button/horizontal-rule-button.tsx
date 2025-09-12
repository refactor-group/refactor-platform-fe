import React, { useMemo, useCallback } from "react"
import { type Editor, useEditorState } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor"

// --- Icons ---
import { HorizontalRuleIcon } from "@/components/ui/tiptap-icons/horizontal-rule-icon"

// --- Lib ---
import { isNodeInSchema } from "@/lib/tiptap-utils"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button"
import { Button } from "@/components/ui/tiptap-ui-primitive/button"

export interface HorizontalRuleButtonProps extends Omit<ButtonProps, "type"> {
  /**
   * The TipTap editor instance.
   */
  editor?: Editor | null
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

export function canInsertHorizontalRule(editor: Editor | null): boolean {
  if (!editor) return false

  try {
    return editor.can().setHorizontalRule()
  } catch {
    return false
  }
}

export function insertHorizontalRule(editor: Editor | null): boolean {
  if (!editor) return false
  return editor.chain().focus().setHorizontalRule().run()
}

export function isHorizontalRuleButtonDisabled(
  editor: Editor | null,
  canInsert: boolean,
  userDisabled: boolean = false
): boolean {
  if (!editor) return true
  if (userDisabled) return true
  if (!canInsert) return true
  return false
}

export function shouldShowHorizontalRuleButton(params: {
  editor: Editor | null
  hideWhenUnavailable: boolean
  nodeInSchema: boolean
  canInsert: boolean
}): boolean {
  const { editor, hideWhenUnavailable, nodeInSchema, canInsert } = params

  if (!nodeInSchema || !editor) {
    return false
  }

  if (hideWhenUnavailable && !canInsert) {
    return false
  }

  return Boolean(editor?.isEditable)
}

export function useHorizontalRuleState(
  editor: Editor | null,
  disabled: boolean = false,
  hideWhenUnavailable: boolean = false
) {
  const nodeInSchema = useMemo(
    () => isNodeInSchema("horizontalRule", editor),
    [editor]
  )

  // Use useEditorState to reactively track editor state changes
  const editorState = useEditorState({
    editor,
    selector: useCallback((ctx: { editor: Editor | null }) => {
      if (!ctx.editor) return { canInsert: false };
      return {
        canInsert: ctx.editor.can().setHorizontalRule(),
      };
    }, []),
  });

  const canInsert = editorState?.canInsert ?? false;
  const isDisabled = isHorizontalRuleButtonDisabled(editor, canInsert, disabled)

  const shouldShow = useMemo(
    () =>
      shouldShowHorizontalRuleButton({
        editor,
        hideWhenUnavailable,
        nodeInSchema,
        canInsert,
      }),
    [editor, hideWhenUnavailable, nodeInSchema, canInsert]
  )

  const handleInsert = useCallback(() => {
    if (!isDisabled && editor) {
      return insertHorizontalRule(editor)
    }
    return false
  }, [editor, isDisabled])

  const shortcutKey = "Ctrl-Shift-minus"
  const label = "Horizontal Rule"

  return {
    nodeInSchema,
    canInsert,
    isDisabled,
    shouldShow,
    handleInsert,
    shortcutKey,
    label,
  }
}

export const HorizontalRuleButton = React.forwardRef<
  HTMLButtonElement,
  HorizontalRuleButtonProps
>(
  (
    {
      editor: providedEditor,
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
      isDisabled,
      shouldShow,
      handleInsert,
      shortcutKey,
      label,
    } = useHorizontalRuleState(editor, disabled, hideWhenUnavailable)

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)

        if (!e.defaultPrevented && !isDisabled) {
          handleInsert()
        }
      },
      [onClick, isDisabled, handleInsert]
    )

    if (!shouldShow || !editor || !editor.isEditable) {
      return null
    }

    return (
      <Button
        type="button"
        className={className.trim()}
        disabled={isDisabled}
        data-style="ghost"
        data-active-state="off"
        data-disabled={isDisabled}
        role="button"
        tabIndex={-1}
        aria-label="horizontal rule"
        tooltip={label}
        shortcutKeys={shortcutKey}
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children || (
          <>
            <HorizontalRuleIcon className="tiptap-button-icon" />
            {text && <span className="tiptap-button-text">{text}</span>}
          </>
        )}
      </Button>
    )
  }
)

HorizontalRuleButton.displayName = "HorizontalRuleButton"

export default HorizontalRuleButton