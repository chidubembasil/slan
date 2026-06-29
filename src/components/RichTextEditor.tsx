import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
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
    ],
    content: value,
    editorProps: {
      transformPastedHTML(html) {
        // Strip Word/WPS junk but keep real formatting (bold, headings, lists)
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

  // Only sync external value changes (e.g. opening a different unit to edit)
  // NOT on every keystroke
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    // Only reset if value is meaningfully different (e.g. form reset or new record loaded)
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  return (
    <div className={`border rounded-md overflow-hidden ${className}`}>
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
        <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
          <s>S</s>
        </ToolbarButton>
        <div className="w-px bg-gray-300 mx-1" />
        <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Subheading">
          H3
        </ToolbarButton>
        <div className="w-px bg-gray-300 mx-1" />
        <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
          • List
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list">
          1. List
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
          ❝
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} title="Code block">
          {'</>'}
        </ToolbarButton>
        <div className="w-px bg-gray-300 mx-1" />
        <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} active={false} title="Undo">
          ↩
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} active={false} title="Redo">
          ↪
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className="prose max-w-none p-3 min-h-[150px] focus-within:outline-none"
      />
    </div>
  )
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors
        ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  )
}