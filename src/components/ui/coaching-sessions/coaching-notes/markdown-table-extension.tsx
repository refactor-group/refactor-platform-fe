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

// Markdown table parsing: Convert markdown table tokens to TipTap table structure

const createHeaderCell = (cell: TableCellToken, helpers: MarkdownParseHelpers) => {
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
};

const createTableCell = (cell: TableCellToken, helpers: MarkdownParseHelpers) => {
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
};

const parseHeaderRow = (headerCells: TableCellToken[], helpers: MarkdownParseHelpers) => {
  const cells = headerCells.map((cell) => createHeaderCell(cell, helpers));
  return {
    type: "tableRow",
    content: cells,
  };
};

const parseBodyRows = (bodyRows: TableCellToken[][], helpers: MarkdownParseHelpers) => {
  return bodyRows.map((row) => {
    const cells = row.map((cell) => createTableCell(cell, helpers));
    return {
      type: "tableRow",
      content: cells,
    };
  });
};

const parseTableMarkdown = (token: Token, helpers: MarkdownParseHelpers) => {
  const tableToken = token as TableToken;
  const rows = [];

  // Parse header row if present
  if (tableToken.header) {
    const headerRow = parseHeaderRow(tableToken.header, helpers);
    rows.push(headerRow);
  }

  // Parse body rows if present
  if (tableToken.rows) {
    const bodyRows = parseBodyRows(tableToken.rows, helpers);
    rows.push(...bodyRows);
  }

  return {
    type: "table",
    content: rows,
  };
};

// Markdown table rendering: Convert TipTap table structure to markdown

const renderCellContent = (cell: JSONContent, helpers: MarkdownRendererHelpers): string => {
  return cell.content ? helpers.renderChildren(cell.content) : "";
};

const renderHeaderRow = (headerRow: JSONContent, helpers: MarkdownRendererHelpers): string => {
  let markdown = "| ";

  headerRow.content?.forEach((cell: JSONContent) => {
    const cellContent = renderCellContent(cell, helpers);
    markdown += cellContent + " | ";
  });

  markdown += "\n";
  return markdown;
};

const renderSeparatorRow = (columnCount: number): string => {
  let markdown = "| ";

  for (let i = 0; i < columnCount; i++) {
    markdown += "--- | ";
  }

  markdown += "\n";
  return markdown;
};

const renderBodyRows = (rows: JSONContent[], helpers: MarkdownRendererHelpers): string => {
  let markdown = "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row?.content) {
      markdown += "| ";
      row.content.forEach((cell: JSONContent) => {
        const cellContent = renderCellContent(cell, helpers);
        markdown += cellContent + " | ";
      });
      markdown += "\n";
    }
  }

  return markdown;
};

const renderTableMarkdown = (node: JSONContent, helpers: MarkdownRendererHelpers): string => {
  const rows = node.content || [];

  // Empty table has no markdown representation
  if (rows.length === 0) return "";

  let markdown = "";
  const headerRow = rows[0];

  // Render header row and separator
  if (headerRow?.content) {
    markdown += renderHeaderRow(headerRow, helpers);
    markdown += renderSeparatorRow(headerRow.content.length);
  }

  // Render body rows
  markdown += renderBodyRows(rows, helpers);

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
