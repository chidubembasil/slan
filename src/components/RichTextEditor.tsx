import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  // $createTextNode,
  // $createLineBreakNode,
  $getNodeByKey,
  $getNearestNodeFromDOMNode,
  $isTextNode,
  $isElementNode,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  DecoratorNode,
  type EditorState,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type DOMConversionMap,
  type DOMExportOutput,
  type SerializedLexicalNode,
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
import { $getNearestNodeOfType, mergeRegister, $insertNodeToNearestRoot } from '@lexical/utils'
import {
  $insertGeneratedNodes,
  $getClipboardDataFromSelection,
  copyToClipboard,
} from '@lexical/clipboard'
import { PASTE_COMMAND, COMMAND_PRIORITY_CRITICAL, COPY_COMMAND, CUT_COMMAND } from 'lexical'
import { useEffect, useRef, useState, useCallback, type JSX } from 'react'

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
    // Strip base64 data-URI images on paste — every image in this editor
    // must be a Cloudinary-hosted <img src="https://..."> uploaded through
    // the image button, never inline image bytes.
    .replace(/<img[^>]*src="data:[^"]*"[^>]*>/gi, '')
}

// ── Escapes HTML special characters before inserting raw text into markup ──
// Used exclusively by plainTextToHtml() to safely turn clipboard
// `text/plain` content into HTML without risking injected markup.
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ── Converts plain-text clipboard content into the same shape the HTML
// pipeline expects ──
// Some laptops/OS clipboard managers only populate `text/plain` on copy
// (no `text/html` at all), which used to take a completely separate
// insertion path. This normalizes that case into an HTML string —
// `<p>Paragraph 1</p><br><br><p>Paragraph 2</p>` — so it can be run through
// the exact same cleanPastedHtml() → ensureParagraphs() → DOMParser →
// $generateNodesFromDOM() pipeline as real HTML pastes. This is the ONLY
// place that injects `<br><br>` paragraph spacing (see OnChangeHtmlPlugin
// below, which no longer does this) so spacing never gets doubled.
function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n')
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const source = paragraphs.length > 0 ? paragraphs : [normalized]

  return source.map((p) => `<p>${escapeHtml(p)}</p>`).join('<br><br>')
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
function CopyCleanupPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        COPY_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false
          editor.getEditorState().read(() => {
            const selection = $getSelection()
            if (selection) {
              copyToClipboard(editor, event, $getClipboardDataFromSelection(selection))
            }
          })
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CUT_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false
          editor.getEditorState().read(() => {
            const selection = $getSelection()
            if (selection) {
              copyToClipboard(editor, event, $getClipboardDataFromSelection(selection))
            }
          })
          editor.update(() => {
            const selection = $getSelection()
            if ($isRangeSelection(selection)) selection.removeText()
          })
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor])

  return null
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
// 'IMG' is treated as a block tag (same as TABLE) so a Cloudinary <img>
// never gets wrapped inside a <p>, which Lexical wouldn't accept.
function ensureParagraphs(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const body = doc.body
    const blockTags = new Set([
      'P', 'DIV', 'TABLE', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE',
    ])

    Array.from(body.children).forEach((el) => {
      if (
        el.tagName === 'DIV' &&
        !el.querySelector('table, ul, ol, blockquote, div, h1, h2, h3, h4, h5, h6, img')
      ) {
        const p = doc.createElement('p')
        p.innerHTML = el.innerHTML
        p.style = "lineHeight: 1;"
        el.replaceWith(p)
      }
    })

    // Word/Google Docs wrap pasted tables in a <div> with no Lexical
    // converter, which silently drops the table on paste. Unwrap any div
    // that only contains a single <table> so the table becomes its own
    // top-level block instead of getting nested inside that div. Repeat a
    // few passes in case of double-wrapping (div > div > table).
    for (let pass = 0; pass < 5; pass++) {
      let unwrapped = false
      Array.from(body.querySelectorAll('div')).forEach((div) => {
        if (div.children.length === 1 && div.children[0].tagName === 'TABLE') {
          div.replaceWith(div.children[0])
          unwrapped = true
        }
      })
      if (!unwrapped) break
    }

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

// ── Cloudinary image upload/delete helpers ──
// Demo-only setup: requests are signed client-side with the API secret so
// no backend endpoint is needed. The file is sent straight to Cloudinary
// as a File inside FormData — it is never converted to base64 and never
// touches localStorage/sessionStorage. Only the resulting Cloudinary URL
// ever lands in the document, as a plain <img src="...">.
async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getCloudinaryConfig() {
  return {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string,
    apiKey: import.meta.env.VITE_API_KEY as string,
    apiSecret: import.meta.env.VITE_API_SECRET_KEY as string,
  }
}

async function uploadImageToCloudinary(file: File): Promise<string> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await sha1Hex(`timestamp=${timestamp}${apiSecret}`)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', apiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Cloudinary upload failed: ${errorText}`)
  }

  const data = await response.json()
  return data.secure_url as string
}

// Pulls the public_id back out of a Cloudinary delivery URL so an image can
// be deleted without persisting anything beyond the plain <img src="...">.
function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/)
  return match ? match[1] : null
}

async function deleteImageFromCloudinary(url: string): Promise<void> {
  const publicId = extractCloudinaryPublicId(url)
  if (!publicId) return

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await sha1Hex(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)

  const formData = new FormData()
  formData.append('public_id', publicId)
  formData.append('api_key', apiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Cloudinary delete failed: ${errorText}`)
  }
}

// ── ImageNode: renders a Cloudinary-hosted image, nothing else ──
// exportDOM emits a bare <img src="..."> (no wrapper div, no class, no
// inline style) so the HTML saved for the article is exactly that tag.
export type SerializedImageNode = Spread<
  { src: string; altText: string },
  SerializedLexicalNode
>

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string
  __altText: string

  constructor(src: string, altText: string = '', key?: NodeKey) {
    super(key)
    this.__src = src
    this.__altText = altText
  }

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__key)
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode(serializedNode.src, serializedNode.altText)
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
    }
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'rte-image-block'
    return div
  }

  updateDOM(): false {
    return false
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img')
    img.setAttribute('src', this.__src)
    if (this.__altText) img.setAttribute('alt', this.__altText)
    return { element: img }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (domNode: HTMLElement) => {
          if (domNode instanceof HTMLImageElement) {
            const node = $createImageNode(domNode.getAttribute('src') || '', domNode.getAttribute('alt') || '')
            return { node }
          }
          return null
        },
        priority: 0,
      }),
    }
  }

  getSrc(): string {
    return this.__src
  }

  decorate(): JSX.Element {
    return <ImageComponent src={this.__src} altText={this.__altText} nodeKey={this.__key} />
  }
}

export function $createImageNode(src: string, altText: string = ''): ImageNode {
  return new ImageNode(src, altText)
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}

// ── Renders the image in the editor + right-click "Delete image" ──
// Deletes from Cloudinary first (best-effort), then removes the node from
// the document either way so the editor never gets stuck with a broken ref.
function ImageComponent({
  src,
  altText,
  nodeKey,
}: {
  src: string
  altText: string
  nodeKey: NodeKey
}) {
  const [editor] = useLexicalComposerContext()
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuPos])

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    setMenuPos({ x: event.clientX, y: event.clientY })
  }

  const handleDelete = async () => {
    setMenuPos(null)
    setDeleting(true)
    try {
      await deleteImageFromCloudinary(src)
    } catch (err) {
      console.error('Failed to delete image from Cloudinary:', err)
    }
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      node?.remove()
    })
  }

  return (
    <>
      <img
        src={src}
        alt={altText}
        onContextMenu={handleContextMenu}
        draggable={false}
        style={{
          maxWidth: '100%',
          borderRadius: 8,
          display: 'block',
          margin: '0.75rem 0',
          opacity: deleting ? 0.4 : 1,
          cursor: 'context-menu',
        }}
      />
      {menuPos && (
        <div
          className="fixed z-50 bg-white border rounded-md shadow-md py-1 text-sm w-44"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDelete}
            disabled={deleting}
            className="block w-full text-left px-3 py-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            🗑 Delete image
          </button>
        </div>
      )}
    </>
  )
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

// Swatches offered for cell text color
const TEXT_COLORS = [
  { label: 'Default', value: null },
  { label: 'Black', value: '#111827' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Red', value: '#dc2626' },
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
// NOTE: this used to also run `html.replace(/<\/p>\s*<p/gi, '</p><br><br><p')`
// to inject paragraph spacing. That has been removed — paragraph spacing is
// now injected exactly once, at paste time, by plainTextToHtml() (for the
// text/plain clipboard case). Keeping it here as well would double the
// spacing every time the document changes/saves, since HTML-origin pastes
// already have real <p> tags and don't need this transform.
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
      html = html.replace(
        /class="rte-paragraph"/gi,
        'style="line-height:1.5;margin-bottom:1.5em;"'
      )
      isInternalUpdate.current = true
      lastHtml.current = html
      onChange(html)
    })
  },
  [onChange, isInternalUpdate, lastHtml]
)

  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
}

// ── Paste handling: cleans Word/WPS junk, guarantees real paragraphs, and
//    normalizes plain-text-only clipboards (no text/html available) into
//    the same <p> structure before running them through the identical
//    HTML → Lexical pipeline. ──
//
// Laptop A (clipboard has text/html):
//   text/html → cleanPastedHtml() → ensureParagraphs() → Lexical nodes
// Laptop B (clipboard has only text/plain):
//   text/plain → plainTextToHtml() → cleanPastedHtml() → ensureParagraphs()
//   → Lexical nodes
//
// Both converge on the exact same DOMParser → $generateNodesFromDOM() →
// selection-aware insertion logic below, so there is only one Lexical
// insertion implementation and paragraph structure/spacing stays identical
// across both laptops.
function PasteCleanupPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false

        const clipboardData = event.clipboardData
        const html = clipboardData?.getData('text/html')

        // Resolve to a single HTML string regardless of clipboard source:
        // real HTML when the browser/OS provided it, otherwise plain text
        // converted into the same <p>...<p> (+ <br><br> between paragraphs)
        // shape.
        let sourceHtml: string

        if (html) {
          sourceHtml = cleanPastedHtml(html)
        } else {
          const text = clipboardData?.getData('text/plain') || ''
          if (!text.trim()) return false
          sourceHtml = plainTextToHtml(text)
        }

        const prepared = ensureParagraphs(sourceHtml)

        editor.update(() => {
          const dom = new DOMParser().parseFromString(prepared, 'text/html')
          const nodes = $generateNodesFromDOM(editor, dom)
          const selection = $getSelection()
          if (selection !== null) {
            $insertGeneratedNodes(editor, nodes, selection)
          } else {
            const root = $getRoot()
            nodes.forEach((n) => root.append(n))
          }
        })

        return true // mark handled, stop Lexical's default from also running
      },
      COMMAND_PRIORITY_CRITICAL, // runs before Lexical's own default handler, and returning true stops it from also firing
    )
  }, [editor])

  return null
}
// ── Right-click context menu for existing tables ──
// Right-clicking any cell in a table (freshly inserted or loaded from saved
// HTML) opens a menu to edit borders, cell fill, and text color, plus the
// usual row/column/table operations — same controls as the toolbar's table
// section, just reachable via right click like in Word/WPS.
function TableContextMenuPlugin() {
  const [editor] = useLexicalComposerContext()
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [section, setSection] = useState<'main' | 'border' | 'fill' | 'text'>('main')

  useEffect(() => {
    const rootElement = editor.getRootElement()
    if (!rootElement) return

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const cellEl = target.closest('td, th')
      if (!cellEl) return

      event.preventDefault()

      editor.update(() => {
        const nodeAtPoint = $getNearestNodeFromDOMNode(cellEl)
        const cellNode = nodeAtPoint ? $getNearestNodeOfType(nodeAtPoint, TableCellNode) : null
        cellNode?.selectEnd()
      })

      setSection('main')
      setMenuPos({ x: event.clientX, y: event.clientY })
    }

    rootElement.addEventListener('contextmenu', handleContextMenu)
    return () => rootElement.removeEventListener('contextmenu', handleContextMenu)
  }, [editor])

  useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuPos])

  const withCurrentCell = (fn: (cell: TableCellNode, table: StyledTableNode | null) => void) => {
    editor.update(() => {
      const selection = $getSelection()
      const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null
      if (!anchorNode) return
      const cell = $getNearestNodeOfType(anchorNode, TableCellNode)
      if (!cell) return
      const table = $getNearestNodeOfType(cell, TableNode)
      fn(cell, table && $isStyledTableNode(table) ? table : null)
    })
  }

  const closeMenu = () => setMenuPos(null)

  const applyCellFill = (color: string | null) => {
    withCurrentCell((cell) => cell.setBackgroundColor(color))
    closeMenu()
  }

  const applyTextColor = (color: string | null) => {
    withCurrentCell((cell) => {
      const walk = (node: LexicalNode) => {
        if ($isTextNode(node)) {
          node.setStyle(color ? `color: ${color}` : '')
        } else if ($isElementNode(node)) {
          node.getChildren().forEach(walk)
        }
      }
      cell.getChildren().forEach(walk)
    })
    closeMenu()
  }

  const applyBorderColor = (color: string) => {
    withCurrentCell((_cell, table) => table?.setBorderColor(color))
    closeMenu()
  }

  const applyBorderWidth = (width: string) => {
    withCurrentCell((_cell, table) => table?.setBorderWidth(width))
    closeMenu()
  }

  const addColumn = (before: boolean) => {
    import('@lexical/table').then(({ $insertTableColumn__EXPERIMENTAL }) =>
      editor.update(() => $insertTableColumn__EXPERIMENTAL(before))
    )
    closeMenu()
  }
  const addRow = (before: boolean) => {
    import('@lexical/table').then(({ $insertTableRow__EXPERIMENTAL }) =>
      editor.update(() => $insertTableRow__EXPERIMENTAL(before))
    )
    closeMenu()
  }
  const deleteColumn = () => {
    import('@lexical/table').then(({ $deleteTableColumn__EXPERIMENTAL }) =>
      editor.update(() => $deleteTableColumn__EXPERIMENTAL())
    )
    closeMenu()
  }
  const deleteRow = () => {
    import('@lexical/table').then(({ $deleteTableRow__EXPERIMENTAL }) =>
      editor.update(() => $deleteTableRow__EXPERIMENTAL())
    )
    closeMenu()
  }
  const deleteTable = () => {
    withCurrentCell((_cell, table) => table?.remove())
    closeMenu()
  }
  const toggleHeaderRow = () => {
    withCurrentCell((cell) => cell.setHeaderStyles(cell.getHeaderStyles() === 0 ? 1 : 0))
    closeMenu()
  }

  if (!menuPos) return null

  return (
    <div
      className="fixed z-50 bg-white border rounded-md shadow-md text-sm w-52 overflow-hidden"
      style={{ top: menuPos.y, left: menuPos.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {section === 'main' && (
        <div className="py-1">
          <MenuItem onClick={() => setSection('border')}>▦ Borders</MenuItem>
          <MenuItem onClick={() => setSection('fill')}>🎨 Cell fill color</MenuItem>
          <MenuItem onClick={() => setSection('text')}>A Text color</MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => addRow(true)}>↑ Insert row above</MenuItem>
          <MenuItem onClick={() => addRow(false)}>↓ Insert row below</MenuItem>
          <MenuItem onClick={() => addColumn(true)}>← Insert column left</MenuItem>
          <MenuItem onClick={() => addColumn(false)}>→ Insert column right</MenuItem>
          <MenuItem onClick={toggleHeaderRow}>⇅ Toggle header row</MenuItem>
          <MenuDivider />
          <MenuItem onClick={deleteRow} danger>✕ Delete row</MenuItem>
          <MenuItem onClick={deleteColumn} danger>✕ Delete column</MenuItem>
          <MenuItem onClick={deleteTable} danger>🗑 Delete table</MenuItem>
        </div>
      )}

      {section === 'border' && (
        <div className="p-3 space-y-3">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSection('main')}
            className="text-xs text-gray-400"
          >
            ← Back
          </button>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Stroke color</p>
            <div className="flex gap-1.5">
              {BORDER_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyBorderColor(c.value)}
                  className="w-6 h-6 rounded-full border-2 border-gray-200"
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyBorderWidth(w.value)}
                  className="px-2 py-1 rounded text-xs border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'fill' && (
        <div className="p-3 space-y-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSection('main')}
            className="text-xs text-gray-400"
          >
            ← Back
          </button>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Cell fill color</p>
          <div className="flex gap-1.5 flex-wrap">
            {CELL_COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyCellFill(c.value)}
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: c.value ?? '#ffffff' }}
              />
            ))}
          </div>
        </div>
      )}

      {section === 'text' && (
        <div className="p-3 space-y-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSection('main')}
            className="text-xs text-gray-400"
          >
            ← Back
          </button>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Text color</p>
          <div className="flex gap-1.5 flex-wrap">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTextColor(c.value)}
                className="w-6 h-6 rounded-full border border-gray-300"
                style={{ backgroundColor: c.value ?? '#ffffff' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
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
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

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

  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so selecting the same file again re-triggers onChange
    if (!file) return

    setIsUploadingImage(true)
    try {
      const url = await uploadImageToCloudinary(file)
      editor.update(() => {
        const imageNode = $createImageNode(url)
        $insertNodeToNearestRoot(imageNode)
      })
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setIsUploadingImage(false)
    }
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
        active={true}
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

      <input
        type="file"
        accept="image/*"
        ref={imageInputRef}
        onChange={handleImageFileSelected}
        className="hidden"
      />
      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        active={false}
        title="Insert image"
      >
        {isUploadingImage ? '⏳ Uploading…' : '🖼 Image'}
      </ToolbarButton>

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
      ImageNode,
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
          margin-bottom: 1.5em;
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
          <CopyCleanupPlugin />
          <TableContextMenuPlugin />
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

function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`block w-full text-left px-3 py-1.5 ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function MenuDivider() {
  return <div className="h-px bg-gray-200 my-1" />
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

      body.innerHTML = body.innerHTML.replace(
    /<\/p>\s*<p/gi,
    '</p><br><br><p'
  )

    return body.innerHTML
  } catch {
    return html
  }
}