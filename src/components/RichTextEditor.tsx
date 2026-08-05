import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $createLineBreakNode,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  type EditorState,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type DOMConversionMap,
  type DOMExportOutput,
  type Spread,
} from 'lexical'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import {
  ListNode,
  ListItemNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from '@lexical/list'
import { CodeNode, $createCodeNode } from '@lexical/code'
import {
  TableNode,
  TableCellNode,
  TableRowNode,
  INSERT_TABLE_COMMAND,
  $isTableSelection,
  type SerializedTableNode,
} from '@lexical/table'
import { $setBlocksType } from '@lexical/selection'
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

// ── Strip Word/WPS junk before it hits the DOM parser ──
function cleanPastedHtml(html: string): string {
  return html
    .replace(/<o:p>.*?<\/o:p>/gi, '')
    .replace(/<w:[^>]+>.*?<\/w:[^>]+>/gi, '')
    .replace(/<m:[^>]+>.*?<\/m:[^>]+>/gi, '')
    .replace(/style="[^"]*mso[^"]*"/gi, '')
    .replace(/<span[^>]*mso[^>]*>(.*?)<\/span>/gi, '$1')
    .replace(/class="Mso[^"]*"/gi, '')
}

// ── Forces the content that follows a bold/strong "sub-header" onto its
// own line ──
// Handles the common pattern where a paragraph starts with a bold run used
// as a sub-header (e.g. "**Overview:** Lorem ipsum dolor sit amet...") and
// the rest of the paragraph's text trails right after it on the same line.
// This walks every <p>, finds a leading <strong>/<b> element, and inserts a
// <br> immediately after it (if one isn't already there) so the body text
// starts on the next line while remaining part of the same paragraph block.
function splitBoldSubheaders(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const paragraphs = Array.from(doc.body.querySelectorAll('p'))

    paragraphs.forEach((p) => {
      // Find the first "meaningful" child (skip whitespace-only text nodes)
      let firstMeaningfulChild: ChildNode | null = null
      for (const child of Array.from(p.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) continue
        firstMeaningfulChild = child
        break
      }

      if (
        !firstMeaningfulChild ||
        firstMeaningfulChild.nodeType !== Node.ELEMENT_NODE ||
        !['STRONG', 'B'].includes((firstMeaningfulChild as Element).tagName)
      ) {
        return
      }

      const boldEl = firstMeaningfulChild as Element

      // Walk forward from the bold element to see whether there's more
      // content after it, and whether a line break already separates it.
      let node: ChildNode | null = boldEl.nextSibling
      let alreadyBroken = false
      let hasContentAfter = false

      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
          alreadyBroken = true
          node = node.nextSibling
          continue
        }
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
          node = node.nextSibling
          continue
        }
        hasContentAfter = true
        break
      }

      if (hasContentAfter && !alreadyBroken) {
        const br = doc.createElement('br')
        boldEl.after(br)
      }
    })

    return doc.body.innerHTML
  } catch {
    return html
  }
}

// ── Guarantees pasted content lands as real paragraphs ──
// Some sources (plain web copy, notes apps) hand over HTML that has no <p>
// tags at all — either bare text, <span>/<br> chains, or top-level <div>s
// used as paragraph containers. Lexical's HTML importer expects real <p>
// elements to create separate ParagraphNodes, so without this the whole
// article can land as one flat block. This promotes <div> paragraphs to
// <p>, and wraps any remaining loose inline content into <p> tags split on
// double line breaks. It also runs splitBoldSubheaders() at the end so any
// bold "sub-header" runs get their trailing content pushed to the next line.
function ensureParagraphs(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const body = doc.body
    const blockTags = new Set([
      'P', 'DIV', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE',
    ])

    Array.from(body.children).forEach((el) => {
      if (
        el.tagName === 'DIV' &&
        !el.querySelector('table, ul, ol, blockquote, div, h1, h2, h3, h4, h5, h6')
      ) {
        const p = doc.createElement('p')
        p.innerHTML = el.innerHTML
        p.style = "lineHeight: 1;"
        el.replaceWith(p)
      }
    })

    const children = Array.from(body.childNodes)
    const fragment = doc.createDocumentFragment()
    let buffer: ChildNode[] = []

    const flushBuffer = () => {
      if (buffer.length === 0) return
      const wrapper = doc.createElement('div')
      buffer.forEach((n) => wrapper.appendChild(n))
      wrapper.innerHTML
        .split(/(?:<br\s*\/?>\s*){2,}/i)
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((chunk) => {
          const p = doc.createElement('p')
          p.innerHTML = chunk
          fragment.appendChild(p)
        })
      buffer = []
    }

    children.forEach((node) => {
      const isBlock = node.nodeType === Node.ELEMENT_NODE && blockTags.has((node as Element).tagName)
      const isText = node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()
      const isInlineEl = node.nodeType === Node.ELEMENT_NODE && !isBlock
      if (isBlock) {
        flushBuffer()
        fragment.appendChild(node)
      } else if (isText || isInlineEl) {
        buffer.push(node)
      }
    })
    flushBuffer()

    body.innerHTML = ''
    body.appendChild(fragment)
    return splitBoldSubheaders(body.innerHTML)
  } catch {
    return html
  }
}

// ── Custom TableNode: adds a per-table border color + width ──
// Packed as CSS custom properties on the table element (--table-border-color,
// --table-border-width) so a single style attribute drives every cell's
// border via the .rte-table CSS below — same approach as the Tiptap version.
export type SerializedStyledTableNode = Spread<
  { borderColor: string; borderWidth: string },
  SerializedTableNode
>

export class StyledTableNode extends TableNode {
  __borderColor: string
  __borderWidth: string

  constructor(borderColor: string = '#000000', borderWidth: string = '1px', key?: NodeKey) {
    super(key)
    this.__borderColor = borderColor
    this.__borderWidth = borderWidth
  }

  static getType(): string {
    return 'table'
  }

  static clone(node: StyledTableNode): StyledTableNode {
    return new StyledTableNode(node.__borderColor, node.__borderWidth, node.__key)
  }

  static importJSON(serializedNode: SerializedStyledTableNode): StyledTableNode {
    return new StyledTableNode(serializedNode.borderColor, serializedNode.borderWidth)
  }

  exportJSON(): SerializedStyledTableNode {
    return {
      ...super.exportJSON(),
      borderColor: this.__borderColor,
      borderWidth: this.__borderWidth,
    }
  }

  getBorderColor(): string {
    return this.getLatest().__borderColor
  }

  getBorderWidth(): string {
    return this.getLatest().__borderWidth
  }

  setBorderColor(color: string): void {
    this.getWritable().__borderColor = color
  }

  setBorderWidth(width: string): void {
    this.getWritable().__borderWidth = width
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const dom = super.createDOM(config, editor)
    dom.classList.add('rte-table')
    dom.style.setProperty('--table-border-color', this.__borderColor)
    dom.style.setProperty('--table-border-width', this.__borderWidth)
    return dom
  }


updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
  const updated = super.updateDOM(prevNode, dom, config)
  if (
    prevNode.__borderColor !== this.__borderColor ||
    prevNode.__borderWidth !== this.__borderWidth
  ) {
    dom.style.setProperty('--table-border-color', this.__borderColor)
    dom.style.setProperty('--table-border-width', this.__borderWidth)
  }
  return updated
}

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const output = super.exportDOM(editor)
    const element = output.element
    if (element instanceof HTMLElement) {
      element.classList.add('rte-table')
      element.style.setProperty('--table-border-color', this.__borderColor)
      element.style.setProperty('--table-border-width', this.__borderWidth)
    }
    return output
  }

  static importDOM(): DOMConversionMap | null {
    const parentImport = TableNode.importDOM?.()
    const tableImport = parentImport?.table
    if (!tableImport) return parentImport ?? null
    return {
      ...parentImport,
      table: (node: HTMLElement) => {
        const parentConversion = tableImport(node)
        if (!parentConversion) return null
        return {
          ...parentConversion,
          conversion: (element: HTMLElement) => {
            const output = parentConversion.conversion(element)
            if (!output || !output.node) return output
            const borderColor = element.style.getPropertyValue('--table-border-color').trim() || '#000000'
            const borderWidth = element.style.getPropertyValue('--table-border-width').trim() || '1px'
            const tableNode = output.node as StyledTableNode
            if (typeof tableNode.setBorderColor === 'function') {
              tableNode.setBorderColor(borderColor)
              tableNode.setBorderWidth(borderWidth)
            }
            return output
          },
        }
      },
    }
  }
}

export function $isStyledTableNode(node: LexicalNode | null | undefined): node is StyledTableNode {
  return node instanceof StyledTableNode
}

// Swatches offered for cell fill color
const CELL_COLORS = [
  { label: 'None', value: null },
  { label: 'Gray', value: '#f3f4f6' },
  { label: 'Blue', value: '#dbeafe' },
  { label: 'Green', value: '#dcfce7' },
  { label: 'Yellow', value: '#fef9c3' },
  { label: 'Red', value: '#fee2e2' },
]

// Swatches offered for table border color — black is the default
const BORDER_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'Gray', value: '#d1d5db' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Red', value: '#dc2626' },
]

const BORDER_WIDTHS = [
  { label: 'Thin', value: '1px' },
  { label: 'Medium', value: '2px' },
  { label: 'Thick', value: '3px' },
]

const theme = {
  heading: { h2: 'rte-h2', h3: 'rte-h3' },
  list: { ul: 'rte-ul', ol: 'rte-ol', listitem: 'rte-li' },
  quote: 'rte-quote',
  code: 'rte-code',
  paragraph: 'rte-paragraph',   // <-- Add this
  text: {
    bold: 'rte-bold',
    italic: 'rte-italic',
    strikethrough: 'rte-strike',
  },
  table: 'rte-table',
  tableCell: 'rte-table-cell',
  tableCellHeader: 'rte-table-cell-header',
  tableRow: 'rte-table-row',
}

function onError(error: Error) {
  console.error(error)
}

// ── Loads initial `value` HTML into the editor once, and re-syncs it
//    whenever `value` changes from outside ──
function InitialContentPlugin({
  value,
  isInternalUpdate,
  lastHtml,
}: {
  value: string
  isInternalUpdate: React.MutableRefObject<boolean>
  lastHtml: React.MutableRefObject<string>
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.update(() => {
      const dom = new DOMParser().parseFromString(ensureParagraphs(value || ''), 'text/html')
      const nodes = $generateNodesFromDOM(editor, dom)
      const root = $getRoot()
      root.clear()
      if (nodes.length === 0) {
        root.append($createParagraphNode())
      } else {
        nodes.forEach((n) => root.append(n))
      }
    })
    lastHtml.current = value
    // run only once on mount for initial content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    if (value !== lastHtml.current) {
      editor.update(() => {
        const dom = new DOMParser().parseFromString(ensureParagraphs(value || ''), 'text/html')
        const nodes = $generateNodesFromDOM(editor, dom)
        const root = $getRoot()
        root.clear()
        if (nodes.length === 0) {
          root.append($createParagraphNode())
        } else {
          nodes.forEach((n) => root.append(n))
        }
      })
      lastHtml.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return null
}

// ── Emits HTML on every change ──
function OnChangeHtmlPlugin({
  onChange,
  isInternalUpdate,
  lastHtml,
}: {
  onChange: (html: string) => void
  isInternalUpdate: React.MutableRefObject<boolean>
  lastHtml: React.MutableRefObject<string>
}) {
  const handleChange = useCallback(
    (_editorState: EditorState, editor: LexicalEditor) => {
      editor.getEditorState().read(() => {
        let html = $generateHtmlFromNodes(editor, null)
        html = html.replace(/(<br\s*\/?>\s*){1,}/gi, '<br>')
        console.log(html)
        isInternalUpdate.current = true
        lastHtml.current = html
        onChange(html)
      })
    },
    [onChange, isInternalUpdate, lastHtml]
  )

  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
}

// ── Paste handling: cleans Word/WPS junk, guarantees real paragraphs,
//    and turns plain-text articles (no HTML on the clipboard at all) into
//    one <p> per paragraph instead of a single blob. ──
function PasteCleanupPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const rootElement = editor.getRootElement()
    if (!rootElement) return

    const handlePaste = (event: ClipboardEvent) => {
      const html = event.clipboardData?.getData('text/html')

      if (html) {
        const prepared = ensureParagraphs(cleanPastedHtml(html))
        event.preventDefault()
        event.stopPropagation()
        editor.update(() => {
          const dom = new DOMParser().parseFromString(prepared, 'text/html')
          const nodes = $generateNodesFromDOM(editor, dom)
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            selection.insertNodes(nodes)
          } else {
            const root = $getRoot()
            nodes.forEach((n) => root.append(n))
          }
        })
        return
      }

      // No HTML on the clipboard — plain text paste. Split on blank lines so
      // each paragraph of the article becomes its own paragraph node.
      const text = event.clipboardData?.getData('text/plain') || ''
      if (!text.trim()) return

      event.preventDefault()
      event.stopPropagation()

      editor.update(() => {
        const selection = $getSelection()
        const paragraphs = text
          .replace(/\r\n/g, '\n')
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)

        const paragraphNodes = (paragraphs.length > 0 ? paragraphs : [text]).map((para) => {
          const p = $createParagraphNode()
          para.split('\n').forEach((line, i) => {
            if (i > 0) p.append($createLineBreakNode())
            if (line) p.append($createTextNode(line))
          })
          return p
        })

        if ($isRangeSelection(selection)) {
          selection.insertNodes(paragraphNodes)
        } else {
          const root = $getRoot()
          paragraphNodes.forEach((p) => root.append(p))
        }
      })
    }

    rootElement.addEventListener('paste', handlePaste, true)
    return () => rootElement.removeEventListener('paste', handlePaste, true)
  }, [editor])

  return null
}

// ── Toolbar ──
function Toolbar() {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isStrike, setIsStrike] = useState(false)
  const [blockType, setBlockType] = useState('paragraph')
  const [isInTable, setIsInTable] = useState(false)
  const [currentBorderColor, setCurrentBorderColor] = useState('#000000')
  const [currentBorderWidth, setCurrentBorderWidth] = useState('1px')
  const [showCellColors, setShowCellColors] = useState(false)
  const [showBorderPanel, setShowBorderPanel] = useState(false)

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            setIsBold(selection.hasFormat('bold'))
            setIsItalic(selection.hasFormat('italic'))
            setIsStrike(selection.hasFormat('strikethrough'))

            const anchorNode = selection.anchor.getNode()
            const element =
              anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()
            const type = element.getType()
            if (type === 'heading') {
              // @ts-expect-error - getTag exists on HeadingNode
              setBlockType(`heading-${element.getTag?.()}`)
            } else {
              setBlockType(type)
            }

            const tableCell = $getNearestNodeOfType(anchorNode, TableCellNode)
            const inTable = !!tableCell || $isTableSelection(selection)
            setIsInTable(inTable)

            if (inTable) {
              const cellNode = tableCell ?? null
              const tableNode = cellNode
                ? $getNearestNodeOfType(cellNode, TableNode)
                : null
              if (tableNode && $isStyledTableNode(tableNode)) {
                setCurrentBorderColor(tableNode.getBorderColor())
                setCurrentBorderWidth(tableNode.getBorderWidth())
              }
            }
          } else if ($isTableSelection(selection)) {
            setIsInTable(true)
          }
        })
      })
    )
  }, [editor])

  const formatText = (format: 'bold' | 'italic' | 'strikethrough') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  }

  const toggleHeading = (level: 'h2' | 'h3') => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (blockType === `heading-${level}`) {
          $setBlocksType(selection, () => $createParagraphNode())
        } else {
          $setBlocksType(selection, () => $createHeadingNode(level))
        }
      }
    })
  }

  const setParagraph = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }

  const toggleBulletList = () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
  const toggleOrderedList = () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)

  const toggleBlockquote = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (blockType === 'quote') {
          $setBlocksType(selection, () => $createParagraphNode())
        } else {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      }
    })
  }

  const toggleCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (blockType === 'code') {
          $setBlocksType(selection, () => $createParagraphNode())
        } else {
          $setBlocksType(selection, () => $createCodeNode())
        }
      }
    })
  }

 const insertTable = () => {
  editor.focus() // ensure the editor has focus/selection before dispatching
  editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '3', columns: '3', includeHeaders: true })
}

  // Applies fill color to every selected cell (multi-cell drag) or the
  // single cell the cursor is in.
  const applyCellColor = (color: string | null) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isTableSelection(selection)) {
        selection.getNodes().forEach((node) => {
          if (node instanceof TableCellNode) node.setBackgroundColor(color)
        })
      } else if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode()
        const cell = $getNearestNodeOfType(anchorNode, TableCellNode)
        cell?.setBackgroundColor(color)
      }
    })
    setShowCellColors(false)
  }

  const withCurrentTable = (fn: (table: StyledTableNode) => void) => {
    editor.update(() => {
      const selection = $getSelection()
      const anchorNode = $isRangeSelection(selection)
        ? selection.anchor.getNode()
        : $isTableSelection(selection)
        ? selection.getNodes()[0]
        : null
      if (!anchorNode) return
      const cell = $getNearestNodeOfType(anchorNode, TableCellNode)
      if (!cell) return
      const table = $getNearestNodeOfType(cell, TableNode)
      if (table && $isStyledTableNode(table)) fn(table)
    })
  }

  const applyBorderColor = (color: string) => {
    withCurrentTable((table) => table.setBorderColor(color))
    setCurrentBorderColor(color)
  }

  const applyBorderWidth = (width: string) => {
    withCurrentTable((table) => table.setBorderWidth(width))
    setCurrentBorderWidth(width)
  }

  const addColumn = (before: boolean) =>
    import('@lexical/table').then(({ $insertTableColumn__EXPERIMENTAL }) =>
      editor.update(() => $insertTableColumn__EXPERIMENTAL(before))
    )
  const addRow = (before: boolean) =>
    import('@lexical/table').then(({ $insertTableRow__EXPERIMENTAL }) =>
      editor.update(() => $insertTableRow__EXPERIMENTAL(before))
    )
  const deleteColumn = () =>
    import('@lexical/table').then(({ $deleteTableColumn__EXPERIMENTAL }) =>
      editor.update(() => $deleteTableColumn__EXPERIMENTAL())
    )
  const deleteRow = () =>
    import('@lexical/table').then(({ $deleteTableRow__EXPERIMENTAL }) =>
      editor.update(() => $deleteTableRow__EXPERIMENTAL())
    )
  const deleteTable = () => withCurrentTable((table) => table.remove())
  const toggleHeaderRow = () => {
    editor.update(() => {
      const selection = $getSelection()
      const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null
      if (!anchorNode) return
      const cell = $getNearestNodeOfType(anchorNode, TableCellNode)
      if (!cell) return
      cell.setHeaderStyles(cell.getHeaderStyles() === 0 ? 1 : 0)
    })
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-background">
      <ToolbarButton onClick={() => formatText('bold')} active={isBold} title="Bold">
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton onClick={() => formatText('italic')} active={isItalic} title="Italic">
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton onClick={() => formatText('strikethrough')} active={isStrike} title="Strikethrough">
        <s>S</s>
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => toggleHeading('h2')} active={blockType === 'heading-h2'} title="Heading">
        H2
      </ToolbarButton>
      <ToolbarButton onClick={() => toggleHeading('h3')} active={blockType === 'heading-h3'} title="Subheading">
        H3
      </ToolbarButton>
      <ToolbarButton
        onClick={setParagraph}
        // active={blockType === 'paragraph'}
        title="Convert to paragraph"
      >
        ¶ Paragraph
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={toggleBulletList} active={blockType === 'ul'} title="Bullet list">
        • List
      </ToolbarButton>
      <ToolbarButton onClick={toggleOrderedList} active={blockType === 'ol'} title="Numbered list">
        1. List
      </ToolbarButton>
      <ToolbarButton onClick={toggleBlockquote} active={blockType === 'quote'} title="Blockquote">
        ❝
      </ToolbarButton>
      <ToolbarButton onClick={toggleCodeBlock} active={blockType === 'code'} title="Code block">
        {'</>'}
      </ToolbarButton>

      <Divider />

      {!isInTable && (
        <ToolbarButton onClick={insertTable} active={false} title="Insert table">
          ⊞ Table
        </ToolbarButton>
      )}

      {isInTable && (
        <>
          <ToolbarButton onClick={() => addColumn(true)} active={false} title="Add column before">←Col</ToolbarButton>
          <ToolbarButton onClick={() => addColumn(false)} active={false} title="Add column after">Col→</ToolbarButton>
          <ToolbarButton onClick={deleteColumn} active={false} title="Delete column">✕Col</ToolbarButton>
          <ToolbarButton onClick={() => addRow(true)} active={false} title="Add row before">↑Row</ToolbarButton>
          <ToolbarButton onClick={() => addRow(false)} active={false} title="Add row after">Row↓</ToolbarButton>
          <ToolbarButton onClick={deleteRow} active={false} title="Delete row">✕Row</ToolbarButton>
          <ToolbarButton onClick={toggleHeaderRow} active={false} title="Toggle header row">Header</ToolbarButton>

          {/* Cell fill color */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                setShowCellColors((s) => !s)
                setShowBorderPanel(false)
              }}
              active={showCellColors}
              title="Cell fill color"
            >
              🎨 Fill
            </ToolbarButton>
            {showCellColors && (
              <div className="absolute z-10 top-full mt-1 left-0 flex gap-1 p-2 bg-white border rounded-md shadow-md">
                {CELL_COLORS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    onClick={() => applyCellColor(c.value)}
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: c.value ?? '#ffffff' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Border color + width — applies to the whole table */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                setShowBorderPanel((s) => !s)
                setShowCellColors(false)
              }}
              active={showBorderPanel}
              title="Table borders"
            >
              ▦ Borders
            </ToolbarButton>
            {showBorderPanel && (
              <div className="absolute z-10 top-full mt-1 left-0 w-56 p-3 bg-white border rounded-md shadow-md space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Stroke color</p>
                  <div className="flex gap-1.5">
                    {BORDER_COLORS.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        title={c.label}
                        onClick={() => applyBorderColor(c.value)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          currentBorderColor === c.value ? 'border-gray-900' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Stroke width</p>
                  <div className="flex gap-1.5">
                    {BORDER_WIDTHS.map((w) => (
                      <button
                        key={w.label}
                        type="button"
                        onClick={() => applyBorderWidth(w.value)}
                        className={`px-2 py-1 rounded text-xs border ${
                          currentBorderWidth === w.value
                            ? 'border-gray-900 bg-gray-100 text-gray-900'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <ToolbarButton onClick={deleteTable} active={false} title="Delete table" danger>
            🗑 Table
          </ToolbarButton>
        </>
      )}

      <Divider />

      <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} active={false} title="Undo">
        ↩
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} active={false} title="Redo">
        ↪
      </ToolbarButton>
    </div>
  )
}

export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const isInternalUpdate = useRef(false)
  const lastHtml = useRef('')

  const initialConfig = {
    namespace: 'RichTextEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      { replace: TableNode, with: (node: TableNode) => new StyledTableNode('#000000', '1px', node.__key) },
      TableCellNode,
      TableRowNode,
    ],
  }

  return (
    <>
      {/* Table + block styles injected once */}
      <style>{`
        .rte-table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.75rem 0;
          font-size: 0.875rem;
        }
          
        .rte-table-cell,
        .rte-table-cell-header {
          border: var(--table-border-width, 1px) solid var(--table-border-color, #000000) !important;
          padding: 6px 10px;
          text-align: left;
          vertical-align: top;
          min-width: 60px;
        }
        .rte-table-cell-header {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        .rte-h2 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .rte-h3 { font-size: 1.05rem; font-weight: 600; margin: 0.75rem 0 0.4rem; }
        .rte-ul, .rte-ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .rte-quote {
          border-left: 3px solid #9ca3af;
          padding-left: 1rem;
          margin: 0.75rem 0;
          color: #4b5563;
          font-style: italic;
        }
        .rte-paragraph {
          line-height: 1.5;
          margin-bottom: 2.25em;
        }

        .rte-paragraph:last-child {
          margin-bottom: 0;
        }
        .rte-code {
          background: #f3f4f6;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          display: block;
          overflow-x: auto;
          font-size: 0.85rem;
          font-family: monospace;
        }
        .rte-bold { font-weight: 700; }
        .rte-italic { font-style: italic; }
        .rte-strike { text-decoration: line-through; }
      `}</style>

      <div className={`border rounded-md overflow-hidden ${className}`}>
        <LexicalComposer initialConfig={initialConfig}>
          <Toolbar />
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="prose max-w-none p-3 min-h-37.5 focus:outline-none" />
            }
            placeholder={
              <div className="p-3 text-gray-400 text-sm pointer-events-none absolute top-7">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <TablePlugin />
          <PasteCleanupPlugin />
          <InitialContentPlugin value={value} isInternalUpdate={isInternalUpdate} lastHtml={lastHtml} />
          <OnChangeHtmlPlugin onChange={onChange} isInternalUpdate={isInternalUpdate} lastHtml={lastHtml} />
        </LexicalComposer>
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
// ── Reinforces paragraph/block breaks with explicit <br><br> markers ──
// Defends against learner-side sanitizers that strip <p>/<div>/<table>
// wrappers but leave basic inline tags like <br> untouched. Safe to run
// on Lexical-generated HTML right before it's sent to the backend.
export function reinforceParagraphBreaks(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const body = doc.body

    // Merge heading-only paragraphs into the next paragraph
    const paragraphs = Array.from(body.querySelectorAll('p'))

    for (let i = 0; i < paragraphs.length - 1; i++) {
      const current = paragraphs[i]
      const next = paragraphs[i + 1]

      if (
        current.querySelector('strong') &&
        !current.querySelector('span') &&
        current.textContent?.trim()
      ) {
        const heading = current.innerHTML
        next.innerHTML = `${heading} ${next.innerHTML}`
        current.remove()
      }
    }

    // Keep only one <br> between paragraphs
    body.innerHTML = body.innerHTML.replace(
      /(<br\s*\/?>\s*){1,}/gi,
      '<br>'
    )

    return body.innerHTML
  } catch {
    return html
  }
}