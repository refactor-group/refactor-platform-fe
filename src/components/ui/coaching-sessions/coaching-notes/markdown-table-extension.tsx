import type { Token } from "marked";
import type {
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  JSONContent,
} from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table";
import { TableHeader } from "@tiptap/extension-table";

// Define types for MarkedJS table token structure
interface TableCellToken {
  text: string;
  tokens?: Token[];
}

interface TableToken {
  type: string;
  header?: TableCellToken[];
  rows?: TableCellToken[][];
  [key: string]: unknown;
}

// Define parse and render functions
const parseTableMarkdown = (token: Token, helpers: MarkdownParseHelpers) => {
    const tableToken = token as TableToken;
    const rows = [];

    if (tableToken.header) {
      const headerCells = tableToken.header.map((cell) => {
        const cellContent = helpers.parseInline(cell.tokens || []);
        return {
          type: "tableHeader",
          content: [
            {
              type: "paragraph",
              content: cellContent,
            },
          ],
        };
      });
      rows.push({
        type: "tableRow",
        content: headerCells,
      });
    }

    if (tableToken.rows) {
      tableToken.rows.forEach((row) => {
        const cells = row.map((cell) => {
          const cellContent = helpers.parseInline(cell.tokens || []);
          return {
            type: "tableCell",
            content: [
              {
                type: "paragraph",
                content: cellContent,
              },
            ],
          };
        });
        rows.push({
          type: "tableRow",
          content: cells,
        });
      });
    }

    return {
      type: "table",
      content: rows,
    };
};

const renderTableMarkdown = (node: JSONContent, helpers: MarkdownRendererHelpers) => {
    let markdown = "";
    const rows = node.content || [];

    if (rows.length === 0) return "";

    // Header row
    const headerRow = rows[0];
    if (headerRow?.content) {
      markdown += "| ";
      headerRow.content.forEach((cell: JSONContent) => {
        const cellContent = cell.content
          ? helpers.renderChildren(cell.content)
          : "";
        markdown += cellContent + " | ";
      });
      markdown += "\n";

      // Separator
      markdown += "| ";
      headerRow.content.forEach(() => {
        markdown += "--- | ";
      });
      markdown += "\n";
    }

    // Body rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row?.content) {
        markdown += "| ";
        row.content.forEach((cell: JSONContent) => {
          const cellContent = cell.content
            ? helpers.renderChildren(cell.content)
            : "";
          markdown += cellContent + " | ";
        });
        markdown += "\n";
      }
    }

    return markdown;
};

// Create table with markdown support using extend
export const TableWithMarkdown = Table.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      parseMarkdown: parseTableMarkdown,
      renderMarkdown: renderTableMarkdown,
      markdownTokenName: "table",
    };
  },
}).configure({
  resizable: false,
  HTMLAttributes: {
    class: "tiptap-table",
  },
});

// Create paste handler as a separate extension
export const TableMarkdownPasteHandler = Extension.create({
  name: "tableMarkdownPasteHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownTablePaste"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;

            // Check if the pasted text looks like a markdown table
            // Construct regex from parts to avoid Tailwind CSS picking it up
            const pipeChar = "|";
            const tablePattern = new RegExp(
              `\\${pipeChar}.*\\${pipeChar}.*\\n\\${pipeChar}[\\-:\\s${pipeChar}]+\\${pipeChar}`
            );
            const hasMarkdownTable = tablePattern.test(text);

            if (hasMarkdownTable && this.editor.markdown) {
              // Parse as markdown and insert
              this.editor.commands.insertContent(text, {
                contentType: "markdown",
              });
              return true; // Prevent default paste
            }

            return false; // Allow default paste for non-table content
          },
        },
      }),
    ];
  },
});

// Export individual table components for use
export { TableRow, TableCell, TableHeader };
