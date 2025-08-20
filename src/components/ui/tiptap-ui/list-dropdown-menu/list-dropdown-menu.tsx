import React, { useState, useMemo, useCallback } from "react"
import { isNodeSelection, type Editor, useEditorState } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor"

// --- Icons ---
import { ChevronDownIcon } from "@/components/ui/tiptap-icons/chevron-down-icon"
import { ListIcon } from "@/components/ui/tiptap-icons/list-icon"

// --- Lib ---
import { isNodeInSchema } from "@/lib/tiptap-utils"

// --- Tiptap UI ---
import {
  ListButton,
  canToggleList,
  isListActive,
  listOptions,
  type ListType,
} from "@/components/ui/tiptap-ui/list-button/list-button"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button"
import { Button } from "@/components/ui/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/tiptap-ui-primitive/dropdown-menu"

export interface ListDropdownMenuProps extends Omit<ButtonProps, "type"> {
  /**
   * The TipTap editor instance.
   */
  editor?: Editor
  /**
   * The list types to display in the dropdown.
   */
  types?: ListType[]
  /**
   * Whether the dropdown should be hidden when no list types are available
   * @default false
   */
  hideWhenUnavailable?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export function canToggleAnyList(
  editor: Editor | null,
  listTypes: ListType[]
): boolean {
  if (!editor) return false
  return listTypes.some((type) => canToggleList(editor, type))
}

export function isAnyListActive(
  editor: Editor | null,
  listTypes: ListType[]
): boolean {
  if (!editor) return false
  return listTypes.some((type) => isListActive(editor, type))
}

export function getFilteredListOptions(
  availableTypes: ListType[]
): typeof listOptions {
  return listOptions.filter(
    (option) => !option.type || availableTypes.includes(option.type)
  )
}

export function shouldShowListDropdown(params: {
  editor: Editor | null
  listTypes: ListType[]
  hideWhenUnavailable: boolean
  listInSchema: boolean
  canToggleAny: boolean
}): boolean {
  const { editor, hideWhenUnavailable, listInSchema, canToggleAny } = params

  if (!listInSchema || !editor) {
    return false
  }

  if (hideWhenUnavailable) {
    if (isNodeSelection(editor.state.selection) || !canToggleAny) {
      return false
    }
  }

  return true
}

export function useListDropdownState(
  editor: Editor | null,
  availableTypes: ListType[]
) {
  const [isOpen, setIsOpen] = useState(false)

  const listInSchema = useMemo(
    () => availableTypes.some((type) => isNodeInSchema(type, editor)),
    [availableTypes, editor]
  )

  const filteredLists = useMemo(
    () => getFilteredListOptions(availableTypes),
    [availableTypes]
  )

  // Consolidate editor state tracking into a single useEditorState hook
  const editorState = useEditorState({
    editor,
    selector: useCallback((ctx: { editor: Editor | null }) => {
      if (!ctx.editor) return { canToggleAny: false, isAnyActive: false };
      return {
        canToggleAny: canToggleAnyList(ctx.editor, availableTypes),
        isAnyActive: isAnyListActive(ctx.editor, availableTypes),
      };
    }, [availableTypes]),
  });

  const canToggleAny = editorState?.canToggleAny ?? false;
  const isAnyActive = editorState?.isAnyActive ?? false;

  const handleOpenChange = useCallback(
    (open: boolean, callback?: (isOpen: boolean) => void) => {
      setIsOpen(open)
      callback?.(open)
    },
    []
  )

  return {
    isOpen,
    setIsOpen,
    listInSchema,
    filteredLists,
    canToggleAny,
    isAnyActive,
    handleOpenChange,
  }
}

export function useActiveListIcon(
  editor: Editor | null,
  filteredLists: typeof listOptions
) {
  return useCallback(() => {
    const activeOption = filteredLists.find((option) =>
      isListActive(editor, option.type)
    )

    return activeOption ? (
      <activeOption.icon className="tiptap-button-icon" />
    ) : (
      <ListIcon className="tiptap-button-icon" />
    )
  }, [editor, filteredLists])
}

export function ListDropdownMenu({
  editor: providedEditor,
  types = ["bulletList", "orderedList", "taskList"],
  hideWhenUnavailable = false,
  onOpenChange,
  ...props
}: ListDropdownMenuProps) {
  const editor = useTiptapEditor(providedEditor)

  const {
    isOpen,
    listInSchema,
    filteredLists,
    canToggleAny,
    isAnyActive,
    handleOpenChange,
  } = useListDropdownState(editor, types)

  const getActiveIcon = useActiveListIcon(editor, filteredLists)

  const show = useMemo(() => {
    return shouldShowListDropdown({
      editor,
      listTypes: types,
      hideWhenUnavailable,
      listInSchema,
      canToggleAny,
    })
  }, [editor, types, hideWhenUnavailable, listInSchema, canToggleAny])

  const handleOnOpenChange = useCallback(
    (open: boolean) => handleOpenChange(open, onOpenChange),
    [handleOpenChange, onOpenChange]
  )

  if (!show || !editor || !editor.isEditable) {
    return null
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOnOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          data-style="ghost"
          data-active-state={isAnyActive ? "on" : "off"}
          role="button"
          tabIndex={-1}
          aria-label="List options"
          tooltip="List"
          {...props}
        >
          {getActiveIcon()}
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuGroup>
          {filteredLists.map((option) => (
            <DropdownMenuItem key={option.type} asChild>
              <ListButton
                editor={editor}
                type={option.type}
                text={option.label}
                hideWhenUnavailable={hideWhenUnavailable}
                tooltip={""}
              />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ListDropdownMenu
