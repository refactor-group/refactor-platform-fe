import type { Token } from "marked";
import { marked } from "marked";
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

// Branded types for domain modeling

/** Branded type for positive integer column count */
type ColumnCount = number & { readonly __brand: 'ColumnCount' };

/** Create a branded ColumnCount from a number, ensuring it's positive */
function createColumnCount(value: number): ColumnCount {
  if (value <= 0 || !Number.isInteger(value)) {
    throw new RangeError(`Column count must be a positive integer, got: ${value}`);
  }
  return value as ColumnCount;
}

// Define types for MarkedJS table token structure
interface TableCellToken {
  readonly text: string;
  readonly tokens?: Token[];
}

interface TableToken {
  readonly type: 'table';
  readonly header?: TableCellToken[];
  readonly rows?: TableCellToken[][];
  readonly [key: string]: unknown;
}

// Define types for TipTap table node structure
interface ParagraphNode {
  readonly type: 'paragraph';
  readonly content: unknown;
}

/** Table header cell node with discriminated type */
interface TableHeaderCell {
  readonly type: 'tableHeader';
  readonly content: readonly ParagraphNode[];
}

/** Table body cell node with discriminated type */
interface TableBodyCell {
  readonly type: 'tableCell';
  readonly content: readonly ParagraphNode[];
}

/** Discriminated union of table cell types */
type TableCellNode = TableHeaderCell | TableBodyCell;

interface TableRowNode {
  readonly type: 'tableRow';
  readonly content: readonly TableCellNode[];
}

interface TableNode {
  readonly type: 'table';
  readonly content: readonly TableRowNode[];
}

// Markdown table parsing: Convert markdown table tokens to TipTap table structure

// Type guard to safely validate TableToken structure at runtime
function isTableToken(token: unknown): token is TableToken {
  return (
    typeof token === 'object' &&
    token !== null &&
    'type' in token &&
    (token as { type: unknown }).type === 'table' &&
    ('header' in token ? Array.isArray((token as { header: unknown }).header) : true) &&
    ('rows' in token ? Array.isArray((token as { rows: unknown }).rows) : true)
  );
}

const createHeaderCell = (
  cell: TableCellToken,
  helpers: MarkdownParseHelpers
): TableHeaderCell => {
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

const createTableCell = (
  cell: TableCellToken,
  helpers: MarkdownParseHelpers
): TableBodyCell => {
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

const parseHeaderRow = (
  headerCells: TableCellToken[],
  helpers: MarkdownParseHelpers
): TableRowNode => {
  const cells = headerCells.map((cell) => createHeaderCell(cell, helpers));
  return {
    type: "tableRow",
    content: cells,
  };
};

const parseBodyRows = (
  bodyRows: TableCellToken[][],
  helpers: MarkdownParseHelpers
): readonly TableRowNode[] => {
  return bodyRows.map((row) => {
    const cells = row.map((cell) => createTableCell(cell, helpers));
    return {
      type: "tableRow",
      content: cells,
    };
  });
};

const parseTableMarkdown = (
  token: Token,
  helpers: MarkdownParseHelpers
): TableNode => {
  if (!isTableToken(token)) {
    throw new TypeError(`Expected table token but received type: ${token.type}`);
  }

  const tableToken = token;
  const rows: TableRowNode[] = [];

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

const renderCellContent = (
  cell: JSONContent,
  helpers: MarkdownRendererHelpers
): string => {
  return cell.content ? helpers.renderChildren(cell.content) : "";
};

const renderHeaderRow = (
  headerRow: JSONContent,
  helpers: MarkdownRendererHelpers
): string => {
  const cells = headerRow.content?.map((cell: JSONContent) =>
    renderCellContent(cell, helpers)
  ) ?? [];

  return `| ${cells.join(" | ")} |\n`;
};

const renderSeparatorRow = (columnCount: ColumnCount): string => {
  const separators = Array.from({ length: columnCount }, () => "---");
  return `| ${separators.join(" | ")} |\n`;
};

const renderBodyRows = (
  rows: readonly JSONContent[],
  helpers: MarkdownRendererHelpers
): string => {
  const bodyRowsMarkdown = rows.slice(1).map((row) => {
    if (!row?.content) return "";

    const cells = row.content.map((cell: JSONContent) =>
      renderCellContent(cell, helpers)
    );

    return `| ${cells.join(" | ")} |`;
  });

  return bodyRowsMarkdown.filter(Boolean).join("\n") + (bodyRowsMarkdown.length > 0 ? "\n" : "");
};

const renderTableMarkdown = (
  node: JSONContent,
  helpers: MarkdownRendererHelpers
): string => {
  const rows = node.content || [];

  // Empty table has no markdown representation
  if (rows.length === 0) return "";

  let markdown = "";
  const headerRow = rows[0];

  // Render header row and separator
  if (headerRow?.content && headerRow.content.length > 0) {
    markdown += renderHeaderRow(headerRow, helpers);
    markdown += renderSeparatorRow(createColumnCount(headerRow.content.length));
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

            // Use marked's tokenizer to detect tables (handles leading whitespace correctly)
            const hasMarkdownTable = (() => {
              try {
                const tokens = marked.lexer(text);
                return tokens.some(token => token.type === 'table');
              } catch {
                // If tokenization fails, fall back to default paste
                return false;
              }
            })();

            if (hasMarkdownTable && this.editor.markdown) {
              try {
                // Parse as markdown and insert
                this.editor.commands.insertContent(text, {
                  contentType: "markdown",
                });
                return true; // Prevent default paste
              } catch (error) {
                console.error("Failed to paste markdown table:", error);
                // Fall through to default paste behavior
                return false;
              }
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
