import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $createLineBreakNode,
  $insertNodes,
  $isRootOrShadowRoot,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  createCommand,
  COMMAND_PRIORITY_EDITOR,
  DecoratorNode,
  ParagraphNode,
  $getNodeByKey,
  type EditorState,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type LexicalCommand,
  type NodeKey,
  type DOMConversionMap,
  type DOMExportOutput,
  type SerializedLexicalNode,
  type SerializedParagraphNode,
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
import { $getNearestNodeOfType, $wrapNodeInElement, mergeRegister } from '@lexical/utils'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  // Optional: upload the file to your own storage/CDN and resolve with the
  // hosted URL. If omitted, images fall back to base64 data URLs embedded
  // directly in the document HTML — fine for small icons, but large images
  // (or several of them) will bloat the stored HTML and can make loading
  // the doc for editing freeze the tab, since that HTML has to be parsed
  // on the main thread. Strongly recommended for any real deployment.
  onUploadImage?: (file: File) => Promise<string>
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = import.meta.env.VITE_API_KEY
const CLOUDINARY_API_SECRET = import.meta.env.VITE_API_SECRET_KEY

async function sha1Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(input))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function uploadImageToCloudinary(file: File): Promise<string> {
  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign = `folder=articles&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
  const signature = await sha1Hex(paramsToSign)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', CLOUDINARY_API_KEY)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('folder', 'articles')

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Cloudinary upload failed')
  }

  const data = await res.json()
  return data.secure_url as string
}

// ── Extracts the Cloudinary public_id from a secure_url ──
// Cloudinary URLs look like:
// https://res.cloudinary.com/<cloud>/image/upload/v169.../articles/abc123.png
// The public_id (needed to delete the asset) is everything between the
// version segment (vNNNN/) and the file extension, including any folder.
function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}


// ── Deletes an asset from Cloudinary by public_id ──
// Cloudinary's destroy endpoint requires a signature just like upload does,
// so this needs the same secret. In a real deployment this call (and the
// secret it depends on) should move to your backend — see the note in the
// upload function above.
async function deleteImageFromCloudinary(src: string): Promise<void> {
  const publicId = extractPublicIdFromCloudinaryUrl(src)
  if (!publicId) return // not a Cloudinary-hosted image (e.g. base64 fallback) — nothing to delete

  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
  const signature = await sha1Hex(paramsToSign)

  const formData = new FormData()
  formData.append('public_id', publicId)
  formData.append('api_key', CLOUDINARY_API_KEY)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    console.error('Failed to delete image from Cloudinary:', await res.text().catch(() => ''))
  }
}

// Max size accepted for image uploads/pastes, in bytes. Images are embedded
// as base64 data URLs directly in the HTML, so keep this conservative —
// swap in a real upload endpoint (returning a hosted URL instead of a data
// URL) if you need to support larger files.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 5MB

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

// ── Guarantees pasted content lands as real paragraphs ──
// Some sources (plain web copy, notes apps) hand over HTML that has no <p>
// tags at all — either bare text, <span>/<br> chains, or top-level <div>s
// used as paragraph containers. Lexical's HTML importer expects real <p>
// elements to create separate ParagraphNodes, so without this the whole
// article can land as one flat block. This promotes <div> paragraphs to
// <p>, and wraps any remaining loose inline content into <p> tags split on
// double line breaks.
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
    return body.innerHTML
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

// Options offered in the line-spacing dropdown
export const LINE_HEIGHT_OPTIONS = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' },
]

export const DEFAULT_LINE_HEIGHT = '1.5'

// ── Custom ParagraphNode: carries a per-paragraph line-height ──
// Stored as an inline style on the <p> element so it round-trips through
// $generateHtmlFromNodes / $generateNodesFromDOM. New paragraphs default to
// 1.5 line spacing; the toolbar lets the user change it per paragraph.
export type SerializedStyledParagraphNode = Spread<{ lineHeight: string }, SerializedParagraphNode>

export class StyledParagraphNode extends ParagraphNode {
  __lineHeight: string

  constructor(lineHeight: string = DEFAULT_LINE_HEIGHT, key?: NodeKey) {
    super(key)
    this.__lineHeight = lineHeight
  }

  static getType(): string {
    return 'paragraph'
  }

  static clone(node: StyledParagraphNode): StyledParagraphNode {
    return new StyledParagraphNode(node.__lineHeight, node.__key)
  }

  static importJSON(serializedNode: SerializedStyledParagraphNode): StyledParagraphNode {
    const node = new StyledParagraphNode(serializedNode.lineHeight || DEFAULT_LINE_HEIGHT)
    node.setFormat(serializedNode.format)
    node.setIndent(serializedNode.indent)
    node.setDirection(serializedNode.direction)
    return node
  }

  exportJSON(): SerializedStyledParagraphNode {
    return {
      ...super.exportJSON(),
      lineHeight: this.__lineHeight,
    }
  }

  getLineHeight(): string {
    return this.getLatest().__lineHeight
  }

  setLineHeight(lineHeight: string): void {
    this.getWritable().__lineHeight = lineHeight
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.style.lineHeight = this.__lineHeight
    return dom
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config)
    if (prevNode.__lineHeight !== this.__lineHeight) {
      dom.style.lineHeight = this.__lineHeight
    }
    return updated
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const output = super.exportDOM(editor)
    const element = output.element
    if (element instanceof HTMLElement) {
      element.style.lineHeight = this.__lineHeight
    }
    return output
  }

  static importDOM(): DOMConversionMap | null {
    const parentImport = ParagraphNode.importDOM?.()
    const pImport = parentImport?.p
    return {
      ...parentImport,
      p: (node: HTMLElement) => {
        const parentConversion = pImport ? pImport(node) : null
        return {
          priority: 1,
          ...(parentConversion || {}),
          conversion: (element: HTMLElement) => {
            const output = parentConversion
              ? parentConversion.conversion(element)
              : { node: $createStyledParagraphNode() }
            if (!output || !output.node) return output
            const lineHeight = element.style.lineHeight || DEFAULT_LINE_HEIGHT
            const pNode = output.node as StyledParagraphNode
            if (typeof pNode.setLineHeight === 'function') {
              pNode.setLineHeight(lineHeight)
            }
            return output
          },
        }
      },
    }
  }
}

export function $createStyledParagraphNode(lineHeight: string = DEFAULT_LINE_HEIGHT): StyledParagraphNode {
  return new StyledParagraphNode(lineHeight)
}

export function $isStyledParagraphNode(node: LexicalNode | null | undefined): node is StyledParagraphNode {
  return node instanceof StyledParagraphNode
}

// ── Custom ImageNode ──
// Renders as a plain <img> both in the editor and in exported HTML, so
// images round-trip cleanly through $generateHtmlFromNodes /
// $generateNodesFromDOM without needing any special server-side handling.
export interface ImagePayload {
  src: string
  altText: string
  width?: number
  height?: number
  key?: NodeKey
}

export type SerializedImageNode = Spread<
  {
    src: string
    altText: string
    width?: number
    height?: number
  },
  SerializedLexicalNode
>

function ImageComponent({
  src,
  altText,
  width,
  height,
  nodeKey,
}: {
  src: string
  altText: string
  width?: number
  height?: number
  nodeKey: NodeKey
}) {
  const [editor] = useLexicalComposerContext()
  const [deleting, setDeleting] = useState(false)

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    try {
      // Best-effort: also remove the file from Cloudinary storage so
      // removed images don't sit around as orphaned assets. If this fails
      // (network issue, non-Cloudinary src, etc.) we still remove the node
      // from the document so the user isn't blocked.
      await deleteImageFromCloudinary(src)
    } catch (err) {
      console.error('Could not delete image from Cloudinary:', err)
    } finally {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isImageNode(node)) {
          node.remove()
        }
      })
    }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <img
        src={src}
        alt={altText}
        draggable={false}
        style={{
          maxWidth: '100%',
          height: height ? `${height}px` : 'auto',
          width: width ? `${width}px` : 'auto',
          borderRadius: 6,
          display: 'block',
          opacity: deleting ? 0.5 : 1,
        }}
      />
      <button
        type="button"
        title="Delete image"
        aria-label="Delete image"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleRemove}
        disabled={deleting}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 24,
          height: 24,
          padding: 0,
          border: 'none',
          borderRadius: '9999px',
          background: 'rgba(0,0,0,0.65)',
          color: '#fff',
          fontSize: 14,
          lineHeight: '24px',
          textAlign: 'center',
          cursor: deleting ? 'default' : 'pointer',
        }}
      >
        {deleting ? '…' : '×'}
      </button>
    </span>
  )
}

export class ImageNode extends DecoratorNode<React.ReactElement> {
  __src: string
  __altText: string
  __width?: number
  __height?: number

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__height, node.__key)
  }

  constructor(src: string, altText: string, width?: number, height?: number, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__width = width
    this.__height = height
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
    })
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    }
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'rte-image-wrapper'
    return span
  }

  updateDOM(): false {
    return false
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (element: HTMLElement) => {
          if (!(element instanceof HTMLImageElement)) return null
          const { src, alt } = element
          const width = element.getAttribute('width')
          const height = element.getAttribute('height')
          const node = $createImageNode({
            src,
            altText: alt || '',
            width: width ? Number(width) : undefined,
            height: height ? Number(height) : undefined,
          })
          return { node }
        },
        priority: 0,
      }),
    }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img')
    element.setAttribute('src', this.__src)
    element.setAttribute('alt', this.__altText)
    if (this.__width) element.setAttribute('width', String(this.__width))
    if (this.__height) element.setAttribute('height', String(this.__height))
    return { element }
  }

  getSrc(): string {
    return this.__src
  }

  getAltText(): string {
    return this.__altText
  }

  decorate(): React.ReactElement {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        nodeKey={this.getKey()}
      />
    )
  }
}

export function $createImageNode({ src, altText, width, height, key }: ImagePayload): ImageNode {
  return new ImageNode(src, altText, width, height, key)
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand('INSERT_IMAGE_COMMAND')

// ── Registers the insert-image command ──
// Any code (toolbar button, paste handler, drag-and-drop, etc.) can insert
// an image by dispatching INSERT_IMAGE_COMMAND with { src, altText }.
function ImagesPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImagesPlugin: ImageNode not registered on editor')
    }
    return editor.registerCommand<ImagePayload>(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload)
        $insertNodes([imageNode])
        if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
          $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd()
        }
        return true
      },
      COMMAND_PRIORITY_EDITOR
    )
  }, [editor])

  return null
}

// Resolves a File to a usable <img src>. If an onUploadImage function is
// provided, the file is uploaded and the returned hosted URL is used —
// keeping the document HTML small regardless of image size. Without one,
// falls back to a base64 data URL embedded directly in the HTML (fine for
// small images, but see the warning below for why that doesn't scale).
async function resolveImageSrc(
  file: File,
  onUploadImage?: (file: File) => Promise<string>
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB).`
    )
  }

  if (!onUploadImage) {
    throw new Error('Image upload is not configured.')
  }

  return await onUploadImage(file)
}

const theme = {
  heading: { h2: 'rte-h2', h3: 'rte-h3' },
  list: { ul: 'rte-ul', ol: 'rte-ol', listitem: 'rte-li' },
  quote: 'rte-quote',
  code: 'rte-code',
  text: { bold: 'rte-bold', italic: 'rte-italic', strikethrough: 'rte-strike' },
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
        const html = $generateHtmlFromNodes(editor, null)
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
//    inserts pasted images, and turns plain-text articles (no HTML on the
//    clipboard at all) into one <p> per paragraph instead of a single blob. ──
function PasteCleanupPlugin({ onUploadImage }: { onUploadImage?: (file: File) => Promise<string> }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const rootElement = editor.getRootElement()
    if (!rootElement) return

    const handlePaste = (event: ClipboardEvent) => {
      // Image pasted directly from the clipboard (e.g. screenshot, copied
      // image) — clipboardData.files is where browsers put these.
      const files = event.clipboardData?.files
      const imageFile = files ? Array.from(files).find((f) => f.type.startsWith('image/')) : undefined
      if (imageFile) {
        event.preventDefault()
        event.stopPropagation()
        resolveImageSrc(imageFile, onUploadImage)
          .then((src) => {
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src, altText: imageFile.name })
          })
          .catch((err) => console.error(err))
        return
      }

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
  }, [editor, onUploadImage])

  return null
}

// ── Toolbar ──
function Toolbar({ onUploadImage }: { onUploadImage?: (file: File) => Promise<string> }) {
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
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [currentLineHeight, setCurrentLineHeight] = useState(DEFAULT_LINE_HEIGHT)

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

            if ($isStyledParagraphNode(element)) {
              setCurrentLineHeight(element.getLineHeight())
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

  const applyLineHeight = (value: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return
      const seen = new Set<string>()
      selection.getNodes().forEach((node) => {
        const topNode = node.getKey() === 'root' ? node : node.getTopLevelElementOrThrow()
        if (seen.has(topNode.getKey())) return
        seen.add(topNode.getKey())
        if ($isStyledParagraphNode(topNode)) {
          topNode.setLineHeight(value)
        }
      })
    })
    setCurrentLineHeight(value)
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
  // editor.focus() restores selection asynchronously — dispatching the
  // command immediately after calling it (without waiting) means Lexical
  // often finds no active selection and silently drops the insert. The
  // callback runs only once focus + selection restoration has completed.
  editor.focus(() => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) && !$isTableSelection(selection)) {
        // Still no selection (e.g. an empty editor) — put the cursor at
        // the end of the document so there's somewhere to insert into.
        $getRoot().selectEnd()
      }
    })
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '3', columns: '3', includeHeaders: true })
  })
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

  const handleImageButtonClick = () => {
    setImageError(null)
    imageInputRef.current?.click()
  }

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // reset so picking the same file again still fires onChange
    e.target.value = ''
    if (!file) return
    try {
      const src = await resolveImageSrc(file, onUploadImage)
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src, altText: file.name })
      setImageError(null)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not insert image.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-background">
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
      <ToolbarButton onClick={setParagraph} active={blockType === 'paragraph'} title="Convert to paragraph">
        ¶ Paragraph
      </ToolbarButton>

      <select
        value={currentLineHeight}
        onChange={(e) => applyLineHeight(e.target.value)}
        title="Line spacing"
        className="px-2 py-1 rounded text-sm font-medium text-gray-600 border border-transparent hover:bg-gray-100 focus:outline-none"
      >
        {LINE_HEIGHT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Spacing: {opt.label}
          </option>
        ))}
      </select>

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

      <ToolbarButton onClick={handleImageButtonClick} active={false} title="Insert image">
        🖼 Image
      </ToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />
      {imageError && <span className="text-xs text-red-500 ml-1">{imageError}</span>}

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

export function RichTextEditor({ value, onChange, placeholder, className, onUploadImage = uploadImageToCloudinary }: Props)  {
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
      {
        replace: ParagraphNode,
        with: (node: ParagraphNode) => new StyledParagraphNode(DEFAULT_LINE_HEIGHT, node.__key),
        withKlass: StyledParagraphNode,
      },
      {
        replace: TableNode,
        with: (node: TableNode) => new StyledTableNode('#000000', '1px', node.__key),
        withKlass: StyledTableNode,
      },
      TableCellNode,
      TableRowNode,
      ImageNode,
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
        .rte-image-wrapper {
          display: block;
          margin: 0.75rem 0;
        }
      `}</style>

      <div className={`border rounded-md overflow-hidden ${className}`}>
        <LexicalComposer initialConfig={initialConfig}>
          <Toolbar onUploadImage={onUploadImage} />
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="prose max-w-none p-3 min-h-37.5 focus:outline-none" />
            }
            placeholder={
              <div className="p-3 text-gray-400 text-sm pointer-events-none absolute top-10">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <TablePlugin />
          <ImagesPlugin />
          <PasteCleanupPlugin onUploadImage={onUploadImage} />
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
    const topLevelBlocks = Array.from(body.children)

    topLevelBlocks.forEach((el, i) => {
      const isLast = i === topLevelBlocks.length - 1
      if (isLast) return

      // Don't stack <br><br> next to a table — insert once, right after it,
      // not inside it, and skip if the next sibling is already a break.
      const next = el.nextSibling
      const nextIsBreak =
        next?.nodeType === Node.ELEMENT_NODE && (next as Element).tagName === 'BR'
      if (nextIsBreak) return

      const br1 = doc.createElement('br')
      const br2 = doc.createElement('br')
      el.insertAdjacentElement('afterend', br2)
      el.insertAdjacentElement('afterend', br1)
    })

    return body.innerHTML
  } catch {
    return html
  }
}