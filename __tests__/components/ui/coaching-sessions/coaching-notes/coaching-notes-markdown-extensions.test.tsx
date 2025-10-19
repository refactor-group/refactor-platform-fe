import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EditorContent, useEditor } from '@tiptap/react'
import { render, waitFor } from '@testing-library/react'
import * as Y from 'yjs'
import { Extensions } from '@/components/ui/coaching-sessions/coaching-notes/extensions'

describe('Coaching Notes Markdown Extensions', () => {
  let yDoc: Y.Doc

  beforeEach(() => {
    yDoc = new Y.Doc()
  })

  describe('Link Support', () => {
    it('should handle autolink for plain URLs', async () => {
      const TestEditor = () => {
        const editor = useEditor({
          extensions: Extensions(yDoc, null),
          content: '',
        })

        if (!editor) return null

        // Test autolink feature - plain URL should become link
        editor.commands.insertContent('https://google.com ')

        return <EditorContent editor={editor} />
      }

      const { container } = render(<TestEditor />)

      await waitFor(() => {
        const link = container.querySelector('a[href="https://google.com"]')
        expect(link).toBeTruthy()
      })
    })
  })

  describe('Markdown Table Paste', () => {
    it('should convert pasted markdown table to rich text table', async () => {
      const TestEditor = () => {
        const editor = useEditor({
          extensions: Extensions(yDoc, null),
          content: '',
        })

        if (!editor) return null

        const markdownTable = `| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`

        editor.commands.insertContent(markdownTable, { contentType: 'markdown' })

        return <EditorContent editor={editor} />
      }

      const { container } = render(<TestEditor />)

      await waitFor(() => {
        const table = container.querySelector('table')
        expect(table).toBeTruthy()

        // Check header cells
        const headerCells = container.querySelectorAll('th')
        expect(headerCells.length).toBe(2)
        expect(headerCells[0]?.textContent).toBe('Name')
        expect(headerCells[1]?.textContent).toBe('Age')

        // Check body cells
        const bodyCells = container.querySelectorAll('td')
        expect(bodyCells.length).toBe(4)
        expect(bodyCells[0]?.textContent).toBe('Alice')
        expect(bodyCells[1]?.textContent).toBe('30')
        expect(bodyCells[2]?.textContent).toBe('Bob')
        expect(bodyCells[3]?.textContent).toBe('25')
      })
    })

    it('should handle tables with different column counts', async () => {
      const TestEditor = () => {
        const editor = useEditor({
          extensions: Extensions(yDoc, null),
          content: '',
        })

        if (!editor) return null

        const markdownTable = `| Product | Price | Stock | Category |
| --- | --- | --- | --- |
| Widget | $10 | 100 | Tools |
| Gadget | $20 | 50 | Electronics |`

        editor.commands.insertContent(markdownTable, { contentType: 'markdown' })

        return <EditorContent editor={editor} />
      }

      const { container } = render(<TestEditor />)

      await waitFor(() => {
        const table = container.querySelector('table')
        expect(table).toBeTruthy()

        // Check we have 4 columns
        const headerCells = container.querySelectorAll('th')
        expect(headerCells.length).toBe(4)

        // Check we have 2 rows × 4 columns = 8 body cells
        const bodyCells = container.querySelectorAll('td')
        expect(bodyCells.length).toBe(8)
      })
    })

    it('should handle malformed markdown tables gracefully', async () => {
      const TestEditor = () => {
        const editor = useEditor({
          extensions: Extensions(yDoc, null),
          content: '',
        })

        if (!editor) return null

        // Missing separator row - should not crash
        const malformedTable = `| Name | Age |
| Alice | 30 |`

        editor.commands.insertContent(malformedTable, { contentType: 'markdown' })

        return <EditorContent editor={editor} />
      }

      const { container } = render(<TestEditor />)

      // Should not crash - might render as paragraph or incomplete table
      await waitFor(() => {
        expect(container).toBeTruthy()
      })
    })

    it('should handle tables with leading spaces', async () => {
      const TestEditor = () => {
        const editor = useEditor({
          extensions: Extensions(yDoc, null),
          content: '',
        })

        if (!editor) return null

        const tableWithSpaces = `  | Name | Age |
  | --- | --- |
  | Alice | 30 |`

        editor.commands.insertContent(tableWithSpaces, { contentType: 'markdown' })

        return <EditorContent editor={editor} />
      }

      const { container } = render(<TestEditor />)

      await waitFor(() => {
        const table = container.querySelector('table')
        expect(table).toBeTruthy()

        const headerCells = container.querySelectorAll('th')
        expect(headerCells.length).toBe(2)
      })
    })

    it('should handle empty table cells', async () => {
      const TestEditor = () => {
        const editor = useEditor({
          extensions: Extensions(yDoc, null),
          content: '',
        })

        if (!editor) return null

        const emptyTable = `| Name | Age |
| --- | --- |
|  |  |`

        editor.commands.insertContent(emptyTable, { contentType: 'markdown' })

        return <EditorContent editor={editor} />
      }

      const { container } = render(<TestEditor />)

      await waitFor(() => {
        const table = container.querySelector('table')
        expect(table).toBeTruthy()

        const bodyCells = container.querySelectorAll('td')
        expect(bodyCells.length).toBe(2)
      })
    })
  })
})
