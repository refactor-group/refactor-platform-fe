import React from "react";
import { Editor } from "@tiptap/core";
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
import { Button } from "@/components/ui/button";

interface LinkDialogProps {
  editor: Editor;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LinkDialog = ({
  editor,
  isOpen,
  onOpenChange,
}: LinkDialogProps) => {
  const [linkUrl, setLinkUrl] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setLinkUrl(editor.getAttributes("link").href || "");
    }
  }, [isOpen, editor]);

  const setLink = React.useCallback(() => {
    // cancelled
    if (linkUrl === null) {
      return;
    }

    // empty
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onOpenChange(false);
      return;
    }

    // update link
    try {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
      setLinkUrl("");
      onOpenChange(false);
    } catch (e) {
      console.error("Error inserting link:", e);
    }
  }, [editor, linkUrl, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
          <DialogDescription>
            Insert a url for a link in your document.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-6 gap-4 items-center">
          <Label htmlFor="url" className="text-right">
            URL
          </Label>
          <Input
            id="url"
            value={linkUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLinkUrl(e.target.value)
            }
            className="col-span-5"
          />
        </div>
        <DialogFooter>
          <Button onClick={setLink}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
