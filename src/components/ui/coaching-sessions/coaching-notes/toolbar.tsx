import type React from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Toolbar = () => {
  const { editor } = useCurrentEditor();

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  if (!editor) {
    return null;
  }

  const handleLinkButtonClick = () => {
    editor.isActive("link")
      ? editor.chain().focus().toggleLink({ href: linkUrl }).run()
      : setIsLinkDialogOpen(true);
  };

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
          onClick={() => handleLinkButtonClick()}
          isActive={editor.isActive("link")}
          icon={<Link className="h-4 w-4" />}
          title="Link"
        />
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="linkText" className="text-right">
                Text
              </Label>
              <Input
                id="linkText"
                value={linkText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLinkText(e.target.value)
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">
                URL
              </Label>
              <Input
                id="url"
                value={linkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLinkUrl(e.target.value)
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                editor.chain().focus().insertContent(linkText).run();
                editor.chain().focus().toggleLink({ href: linkUrl }).run();
                setIsLinkDialogOpen(false);
                setLinkUrl("");
                setLinkText("");
              }}
            >
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
