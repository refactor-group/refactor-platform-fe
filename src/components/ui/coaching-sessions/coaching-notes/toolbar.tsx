import React, { useEffect } from "react";
import { useCurrentEditor } from "@tiptap/react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Underline,
  List,
  ListOrdered,
  Strikethrough,
  Braces,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { LinkDialog } from "./link-dialog";

export const Toolbar = () => {
  const { editor } = useCurrentEditor();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  if (!editor) {
    return null;
  }
  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsLinkDialogOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="flex items-center gap-0 mt-1 mx-1 mb-0">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={<Bold className="h-4 w-4" />}
          title="Bold (Ctrl+B)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={<Italic className="h-4 w-4" />}
          title="Italic (Ctrl+I)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={<Underline className="h-4 w-4" />}
          title="Underline (Ctrl+U)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          icon={<Strikethrough className="h-4 w-4" />}
          title="Strike Through"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          icon={<Highlighter className="h-4 w-4" />}
          title="Highlight Text"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive("heading", { level: 1 })}
          icon={<Heading1 className="h-4 w-4" />}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          icon={<Heading2 className="h-4 w-4" />}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          icon={<Heading3 className="h-4 w-4" />}
          title="Heading 3"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          icon={<List className="h-4 w-4" />}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          icon={<ListOrdered className="h-4 w-4" />}
          title="Ordered List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          icon={<Braces className="h-4 w-4" />}
          title="Code Block"
        />
        <ToolbarButton
          onClick={() => setIsLinkDialogOpen(true)}
          isActive={editor.isActive("link")}
          icon={<Link className="h-4 w-4" />}
          title={
            editor.isActive("link")
              ? "Update Link (Ctrl + k)"
              : "Insert Link (Ctrl + k)"
          }
        />
      </div>

      <LinkDialog
        editor={editor}
        isOpen={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
      />
    </>
  );
};

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  icon: React.ReactNode;
  title: string;
}

const ToolbarButton = ({
  onClick,
  isActive,
  icon,
  title,
}: ToolbarButtonProps) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className={`p-2 mr-0.5 rounded ${isActive ? "button-active" : ""}`}
    title={title}
  >
    {icon}
  </Button>
);
