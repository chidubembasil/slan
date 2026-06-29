import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Table }from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'rte-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      transformPastedHTML(html) {
        // Strip Word/WPS junk but keep real formatting (bold, headings, lists, tables)
        return html
          .replace(/<o:p>.*?<\/o:p>/gi, '')
          .replace(/<w:[^>]+>.*?<\/w:[^>]+>/gi, '')
          .replace(/<m:[^>]+>.*?<\/m:[^>]+>/gi, '')
          .replace(/style="[^"]*mso[^"]*"/gi, '')
          .replace(/<span[^>]*mso[^>]*>(.*?)<\/span>/gi, '$1')
          .replace(/class="Mso[^"]*"/gi, '')
      },
    },
    onUpdate({ editor }) {
      isInternalUpdate.current = true
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  const isInTable = editor?.isActive('table') ?? false

  return (
    <>
      {/* Table styles injected once */}
      <style>{`
        .rte-table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.75rem 0;
          font-size: 0.875rem;
        }
        .rte-table th,
        .rte-table td {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          text-align: left;
          vertical-align: top;
          min-width: 60px;
        }
        .rte-table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        .rte-table .selectedCell {
          background-color: #dbeafe;
        }
        /* Column resize handle */
        .rte-table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: #3b82f6;
          pointer-events: none;
        }
        .tableWrapper {
          overflow-x: auto;
        }
        .resize-cursor {
          cursor: col-resize;
        }
      `}</style>

      <div className={`border rounded-md overflow-hidden ${className}`}>
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap gap-1 p-2 border-b bg-background">
          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold')}
            title="Bold"
          >
            <b>B</b>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic')}
            title="Italic"
          >
            <i>I</i>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            active={editor?.isActive('strike')}
            title="Strikethrough"
          >
            <s>S</s>
          </ToolbarButton>

          <Divider />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive('heading', { level: 2 })}
            title="Heading"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor?.isActive('heading', { level: 3 })}
            title="Subheading"
          >
            H3
          </ToolbarButton>

          <Divider />

          {/* Lists & blocks */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive('bulletList')}
            title="Bullet list"
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={editor?.isActive('orderedList')}
            title="Numbered list"
          >
            1. List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            active={editor?.isActive('blockquote')}
            title="Blockquote"
          >
            ❝
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            active={editor?.isActive('codeBlock')}
            title="Code block"
          >
            {'</>'}
          </ToolbarButton>

          <Divider />

          {/* ── Table controls ── */}
          {/* Insert table — only when not already in one */}
          {!isInTable && (
            <ToolbarButton
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
              active={false}
              title="Insert table"
            >
              ⊞ Table
            </ToolbarButton>
          )}

          {/* Table editing controls — only shown when cursor is inside a table */}
          {isInTable && (
            <>
              <ToolbarButton
                onClick={() => editor?.chain().focus().addColumnBefore().run()}
                active={false}
                title="Add column before"
              >
                ←Col
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
                active={false}
                title="Add column after"
              >
                Col→
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().deleteColumn().run()}
                active={false}
                title="Delete column"
              >
                ✕Col
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().addRowBefore().run()}
                active={false}
                title="Add row before"
              >
                ↑Row
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().addRowAfter().run()}
                active={false}
                title="Add row after"
              >
                Row↓
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().deleteRow().run()}
                active={false}
                title="Delete row"
              >
                ✕Row
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
                active={false}
                title="Toggle header row"
              >
                Header
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().mergeCells().run()}
                active={false}
                title="Merge cells"
              >
                Merge
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().splitCell().run()}
                active={false}
                title="Split cell"
              >
                Split
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().deleteTable().run()}
                active={false}
                title="Delete table"
                danger
              >
                🗑 Table
              </ToolbarButton>
            </>
          )}

          <Divider />

          {/* Undo / Redo */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            active={false}
            title="Undo"
          >
            ↩
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            active={false}
            title="Redo"
          >
            ↪
          </ToolbarButton>
        </div>

        <EditorContent
          editor={editor}
          className="prose max-w-none p-3 min-h-[150px] focus-within:outline-none"
        />
      </div>
    </>
  )
}

/* ── Sub-components ── */

function Divider() {
  return <div className="w-px bg-gray-300 mx-1 self-stretch" />
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
  danger,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors
        ${
          danger
            ? 'text-red-500 hover:bg-red-50'
            : active
            ? 'bg-gray-200 text-gray-900'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      {children}
    </button>
  )
}