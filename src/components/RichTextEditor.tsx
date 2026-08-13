import React, { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
// import { TableCellResizerPlugin } from "@lexical/react/LexicalTableCellResizerPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $isParagraphNode,
  $createLineBreakNode,
  $isLineBreakNode,
  $getNodeByKey,
  $getNearestNodeFromDOMNode,
  DecoratorNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  COMMAND_PRIORITY_HIGH,
} from "lexical";
import type { NodeKey, ElementFormatType } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $patchStyleText } from "@lexical/selection";
import { HeadingNode, $createHeadingNode } from "@lexical/rich-text";
import type { HeadingTagType } from "@lexical/rich-text";
import {
  ListNode,
  ListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  TableNode,
  TableCellNode,
  TableRowNode,
  INSERT_TABLE_COMMAND,
  $isTableCellNode,
  $insertTableRow__EXPERIMENTAL,
  $insertTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $deleteTableColumn__EXPERIMENTAL,
} from "@lexical/table";
// Additional table utilities, needed only for the new right-click menu /
// hover "+" controls added below. Kept as a separate import so the
// original import block above is untouched.
import {
  $isTableNode,
  $isTableSelection,
  $getTableRowIndexFromTableCellNode,
  $getTableColumnIndexFromTableCellNode,
} from "@lexical/table";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $getNearestNodeOfType } from "@lexical/utils";

// --- Props ---
interface RichTextEditorProps {
  value: string; // html string
  onChange: (html: string) => void;
  placeholder?: string;
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const CLOUDINARY_API_KEY = import.meta.env.VITE_API_KEY as string;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_API_SECRET_KEY as string;

async function sha1(text: string) {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// --- Global editor CSS (headings, lists, table borders) ---
// Injected once. Keeps the editor visually correct without a separate CSS file.
function EditorStyles() {
  return (
    <style>{`
      .my-p { margin: 0 0 8px 0; line-height: 1.5; }
      .my-h1 { font-size: 32px; font-weight: 700; margin: 16px 0 8px; }
      .my-h2 { font-size: 26px; font-weight: 700; margin: 14px 0 8px; }
      .my-h3 { font-size: 22px; font-weight: 600; margin: 12px 0 6px; }
      .my-h4 { font-size: 18px; font-weight: 600; margin: 10px 0 6px; }
      .my-h5 { font-size: 16px; font-weight: 600; margin: 8px 0 4px; }
      .my-h6 { font-size: 14px; font-weight: 600; margin: 8px 0 4px; }
      .my-b { font-weight: 700; }
      .my-i { font-style: italic; }
      .my-u { text-decoration: underline; }

      .my-ul, .my-ol { margin: 4px 0 8px 0; padding-left: 28px; }
      .my-ul { list-style-type: disc; }
      .my-ol { list-style-type: decimal; }
      .my-li { margin: 2px 0; }
      .my-nested-li { list-style-type: none; }

      .my-table { border-collapse: collapse; margin: 10px 0; table-layout: auto; max-width: 100%; }
      .my-row { }
      .my-cell {
        border: 1px solid #9ca3af;
        padding: 6px 10px;
        min-width: 60px;
        vertical-align: top;
      }
      .my-cell-header {
        border: 1px solid #9ca3af;
        padding: 6px 10px;
        background: #f3f4f6;
        font-weight: 600;
      }
    `}</style>
  );
}

// Image Node with right-click Delete
class CustomImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  static getType() { return "custom-image"; }
  static clone(n: CustomImageNode) { return new CustomImageNode(n.__src, n.__key); }
  constructor(src: string, key?: NodeKey) { super(key); this.__src = src; }
  createDOM() { const d = document.createElement("span"); d.style.display = "inline-block"; return d; }
  updateDOM() { return false; }
  decorate() { return <ImageRenderer src={this.__src} nodeKey={this.getKey()} />; }
}
function ImageRenderer({ src, nodeKey }: { src: string, nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);
  useEffect(() => { const c = () => setMenu(null); window.addEventListener("click", c); return () => window.removeEventListener("click", c); }, []);
  return (
    <span onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }} style={{ position: "relative", display: "inline-block", margin: 8 }}>
      <img src={src} alt="" style={{ maxWidth: 400, border: "1px solid #ccc", borderRadius: 4 }} />
      {menu && <div style={{ position: "fixed", left: menu.x, top: menu.y, background: "white", border: "1px solid #ddd", borderRadius: 6, padding: 4, zIndex: 9999 }}>
        <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); editor.update(() => { $getNodeByKey(nodeKey)?.remove(); }); }} style={{ background: "#dc2626", color: "white", border: 0, padding: "6px 14px", borderRadius: 4, cursor: "pointer" }}>Delete</button>
      </div>}
    </span>
  );
}

// --- Paste cleanup ---
// Anything pasted in from Word/Google Docs/a news site arrives full of inline
// styles, <span>/<font> wrappers, and classes. We strip all of that down to a
// small whitelist of structural/semantic tags so pasted content inherits the
// editor's own styling instead of bringing its source formatting along.
// EXCEPTION: table markup keeps its inline style + structural attributes
// (colspan/rowspan/width/height/col widths/etc.) so pasted tables retain
// their original formatting instead of collapsing to the default table style.
const PASTE_ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "b", "strong", "i", "em", "u",
  "a",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col",
  "blockquote",
]);
const PASTE_BLOCKED_TAGS = new Set(["script", "style", "meta", "link", "head", "iframe", "object", "embed", "img"]);
const TABLE_TAGS = new Set(["table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col"]);
const TABLE_ATTRS_TO_KEEP = ["colspan", "rowspan", "width", "height", "bgcolor", "align", "valign", "border", "cellpadding", "cellspacing", "span"];

// A pasted paragraph/heading with an inline top/bottom margin clearly larger
// than the editor's own default spacing gets that gap preserved as a real
// spacer paragraph (<p><br><br></p>) — the same mechanism the toolbar's
// "Add space before/after" produces — so intentional spacing brought in
// from Word/Google Docs survives the paste instead of being stripped along
// with the rest of the source's inline styling. Every paragraph's own
// default margin (~8-10px) sits under this threshold so normal paragraphs
// aren't affected, only ones with deliberately added extra spacing.
const SPACING_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);
const SPACING_THRESHOLD_PX = 16;

function cssLengthToPx(value: string | null | undefined): number {
  const match = /^(-?[\d.]+)\s*(px|pt|em|rem|in|cm|mm)?$/.exec((value || "").trim());
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return 0;
  switch (match[2]) {
    case "pt": return num * (96 / 72);
    case "em":
    case "rem": return num * 16;
    case "in": return num * 96;
    case "cm": return num * 37.8;
    case "mm": return num * 3.78;
    default: return num; // px, or unitless treated as px
  }
}

function makePasteSpacer(outDoc: Document): HTMLElement {
  const p = outDoc.createElement("p");
  p.appendChild(outDoc.createElement("br"));
  p.appendChild(outDoc.createElement("br"));
  return p;
}

function cleanPastedNode(outDoc: Document, node: Node): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [outDoc.createTextNode(node.textContent || "")];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (PASTE_BLOCKED_TAGS.has(tag)) return [];

  const children: Node[] = [];
  el.childNodes.forEach(child => { children.push(...cleanPastedNode(outDoc, child)); });

  if (PASTE_ALLOWED_TAGS.has(tag)) {
    const clean = outDoc.createElement(tag);
    // deliberately drop style/class/id/etc. — only keep href on links
    if (tag === "a") {
      const href = el.getAttribute("href");
      if (href) clean.setAttribute("href", href);
    }
    // table markup keeps its own formatting (style + structural attrs)
    if (TABLE_TAGS.has(tag)) {
      const styleAttr = el.getAttribute("style");
      if (styleAttr) clean.setAttribute("style", styleAttr);
      TABLE_ATTRS_TO_KEEP.forEach(attr => {
        const v = el.getAttribute(attr);
        if (v) clean.setAttribute(attr, v);
      });
    }
    children.forEach(c => clean.appendChild(c));

    // Retain any deliberate paragraph spacing from the source document by
    // surrounding this block with spacer paragraphs, instead of dropping it
    // along with the rest of the stripped inline styling.
    if (SPACING_TAGS.has(tag)) {
      const marginTopPx = cssLengthToPx(el.style.marginTop);
      const marginBottomPx = cssLengthToPx(el.style.marginBottom);
      const result: Node[] = [];
      if (marginTopPx >= SPACING_THRESHOLD_PX) result.push(makePasteSpacer(outDoc));
      result.push(clean);
      if (marginBottomPx >= SPACING_THRESHOLD_PX) result.push(makePasteSpacer(outDoc));
      return result;
    }

    return [clean];
  }
  // unwrap disallowed wrapper tags (span, font, div, section...) and keep their content
  return children;
}

function cleanPastedHtml(html: string): Document {
  const sourceDoc = new DOMParser().parseFromString(html, "text/html");
  const outDoc = document.implementation.createHTMLDocument();
  sourceDoc.body.childNodes.forEach(child => {
    cleanPastedNode(outDoc, child).forEach(n => outDoc.body.appendChild(n));
  });
  return outDoc;
}

function PasteCleanupPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;
        const html = clipboardData.getData("text/html");
        const text = clipboardData.getData("text/plain");
        if (!html && !text) return false;

        event.preventDefault();
        // Stop the native paste event here — otherwise it keeps bubbling up
        // past the editor into whatever page/form this editor is mounted
        // inside, and some host forms treat any bubbled input/paste event
        // as "something changed, save/submit now." Saving should only ever
        // happen when the host page's own Save button is clicked.
        event.stopPropagation();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          if (html) {
            const cleanedDoc = cleanPastedHtml(html);
            const nodes = $generateNodesFromDOM(editor, cleanedDoc);
            selection.insertNodes(nodes);
          } else {
            // no HTML on the clipboard — insert as plain paragraphs, one per line
            const lines = text.split(/\r?\n/);
            lines.forEach((line, i) => {
              if (i > 0) selection.insertParagraph();
              if (line) selection.insertText(line);
            });
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);
  return null;
}

// --- Export styling ---
// $generateHtmlFromNodes only emits our editor's class names (my-table,
// my-cell, my-cell-header...). Those classes are defined in <EditorStyles/>,
// which only exists inside this editor's DOM — so HTML saved from here and
// rendered on any other page (a course viewer, an email, etc.) has no CSS
// backing those classes at all, which is exactly the squished/unstyled
// table you get today. This walks the exported table markup and writes the
// same rules directly onto each element as inline styles, so the saved
// HTML looks the same everywhere it's viewed — matching what was pasted in
// and what's shown in the editor — without touching how tables render
// inside this editor itself.
function inlineTableStyles(html: string): string {
  if (!html.includes("<table")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  const mergeStyle = (el: HTMLElement, rules: Record<string, string>) => {
    Object.entries(rules).forEach(([prop, value]) => {
      if (!el.style.getPropertyValue(prop)) el.style.setProperty(prop, value);
    });
  };

  doc.querySelectorAll("table").forEach(table => {
    mergeStyle(table as HTMLElement, {
      "border-collapse": "collapse",
      "table-layout": "auto",
      "margin": "10px 0",
      "max-width": "100%",
    });
    table.querySelectorAll("th, td").forEach(cell => {
      const isHeader = cell.tagName === "TH" || cell.classList.contains("my-cell-header");
      mergeStyle(cell as HTMLElement, {
        "border": "1px solid #9ca3af",
        "padding": "6px 10px",
        "min-width": "60px",
        "vertical-align": "top",
        ...(isHeader ? { "background": "#f3f4f6", "font-weight": "600" } : {}),
      });
    });
  });

  return doc.body.innerHTML;
}

// Load initial HTML value
function InitialHtmlPlugin({ value, skipNextChangeRef }: { value: string; skipNextChangeRef: React.MutableRefObject<boolean> }) {
  const [editor] = useLexicalComposerContext();
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !value) return;
    didInit.current = true;
    // This is a programmatic hydration of existing content on mount, not a
    // user edit. It still runs through editor.update() (as it must, to
    // actually populate the editor), which still fires OnChangePlugin —
    // so without this flag, simply opening a page with existing content
    // calls onChange() straight back at the host before the user has
    // touched anything, which a host page reasonably reads as "the user
    // changed something, save it."
    skipNextChangeRef.current = true;
    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(value, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      $getRoot().clear();
      $getRoot().append(...nodes);
    });
  }, [editor, value, skipNextChangeRef]);
  return null;
}

// Table Grid Picker
function TableGridPicker({ onSelect, onClose }: { onSelect: (r: number, c: number) => void; onClose: () => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  return (
    <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, padding: 12, width: 260, boxShadow: "0 10px 30px rgba(0,0,0,.15)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
        {Array.from({ length: 100 }).map((_, i) => {
          const r = Math.floor(i / 10) + 1, c = i % 10 + 1, a = r <= hover.r && c <= hover.c;
          return <div key={i} onMouseEnter={() => setHover({ r, c })} onClick={() => { onSelect(r, c); onClose(); }} style={{ width: 20, height: 20, border: "1px solid #9ca3af", background: a ? "#3b82f6" : "white", cursor: "pointer" }} />
        })}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, marginTop: 8 }}>{hover.r ? `${hover.r} x ${hover.c} Table` : "Insert Table"}</div>
    </div>
  );
}

// Small reusable dropdown wrapper
function Dropdown({ label, open, setOpen, children, width = 180 }: { label: ReactNode; open: boolean; setOpen: (v: boolean) => void; children: ReactNode; width?: number }) {
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ border: "1px solid #e5e7eb", background: "white", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
        {label} <span style={{ fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: 32, left: 0, zIndex: 20, background: "white", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,.12)", width, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Quattrocento Sans", value: "'Quattrocento Sans', sans-serif" },
];
const LINE_HEIGHTS = ["1.0", "1.15", "1.5", "2.0", "2.5", "3.0"];

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [tab, setTab] = useState<"Home" | "Insert">("Home");
  const [showTable, setShowTable] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showAlign, setShowAlign] = useState(false);
  const [showFontColor, setShowFontColor] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showCellColor, setShowCellColor] = useState(false);
  const [showLineHeight, setShowLineHeight] = useState(false);
  const [showParagraph, setShowParagraph] = useState(false);
  const [showTableTools, setShowTableTools] = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(3); // 16px default
  const fileRef = useRef<HTMLInputElement>(null);
  const btn: React.CSSProperties = { border: "1px solid #e5e7eb", background: "white", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 13 };
  const menuItem: React.CSSProperties = { padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6" };
  const menuItemDanger: React.CSSProperties = { ...menuItem, color: "#dc2626" };
  const menuLabel: React.CSSProperties = { padding: "6px 12px", fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid #f3f4f6", background: "#fafafa" };

  const applyStyle = (s: Record<string, string>) => editor.update(() => {
    const sel = $getSelection();
    if ($isRangeSelection(sel)) $patchStyleText(sel, s as any);
  });

  const formatBlock = (t: "paragraph" | HeadingTagType) => editor.update(() => {
    const sel = $getSelection();
    if ($isRangeSelection(sel)) {
      if (t === "paragraph") $setBlocksType(sel, () => $createParagraphNode());
      else $setBlocksType(sel, () => $createHeadingNode(t));
    }
  });

  const setFontSize = (idx: number) => {
    const clamped = Math.max(0, Math.min(FONT_SIZES.length - 1, idx));
    setFontSizeIdx(clamped);
    applyStyle({ "font-size": `${FONT_SIZES[clamped]}px` });
  };

  const setFontColor = (color: string) => applyStyle({ color });
  const setFontFamily = (family: string) => applyStyle({ "font-family": family || "inherit" });

  const align = (dir: ElementFormatType) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, dir);

  // Bullet / numbered lists use Lexical's built-in commands.
  // Lettered / roman-numeral lists reuse the ordered-list command, then
  // stamp a CSS list-style-type onto the resulting <ol> DOM node, since
  // Lexical's ListNode only tracks "bullet" | "number" internally.
  const insertList = (kind: "bullet" | "number" | "lower-alpha" | "upper-alpha" | "lower-roman" | "upper-roman") => {
    if (kind === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    if (kind === "number") return;
    // apply custom numbering style after the list exists in the DOM
    setTimeout(() => {
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return;
        const anchorNode = sel.anchor.getNode();
        const listNode = $getNearestNodeOfType(anchorNode, ListNode);
        if (!listNode) return;
        const dom = editor.getElementByKey(listNode.getKey());
        if (dom) dom.style.listStyleType = kind;
      });
    }, 0);
  };

  const removeList = () => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);

  const setCellBackground = (color: string) => editor.update(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return;
    let node: any = sel.anchor.getNode();
    while (node != null && !$isTableCellNode(node)) node = node.getParent();
    if (node && $isTableCellNode(node)) node.setBackgroundColor(color);
  });

  // --- Line height & paragraph spacing ---
  // Applied the same way the lettered/roman list numbering above is applied:
  // stamp the CSS directly onto the block's DOM node after the update, rather
  // than touching Lexical's Paragraph/Heading node classes. Subclassing those
  // core nodes sits on the path of every keystroke and paste, so it's too
  // risky to do just for a style tweak — this DOM-side-effect approach is
  // exactly as safe as the numbering trick already used in this file.
  const getSelectedBlockKeys = (): string[] => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return [];
    const keys = new Set<string>();
    selection.getNodes().forEach(n => { keys.add(n.getTopLevelElementOrThrow().getKey()); });
    return Array.from(keys);
  };

  const setLineHeight = (value: string) => {
    let keys: string[] = [];
    editor.getEditorState().read(() => { keys = getSelectedBlockKeys(); });
    setTimeout(() => {
      keys.forEach(k => {
        const dom = editor.getElementByKey(k);
        if (dom) dom.style.lineHeight = value;
      });
    }, 0);
  };

  // --- Paragraph spacing ---
  // "Add space before/after" no longer stamps a CSS margin — it inserts a
  // real spacer paragraph made of two <br> line breaks (<p><br><br></p>)
  // directly before/after the selected block. That way the spacing is part
  // of the actual content, so it survives export and shows up exactly the
  // same everywhere the saved HTML is rendered, not just inside this editor.
  const isSpacerParagraph = (node: any): boolean => {
    if (!node || !$isParagraphNode(node)) return false;
    const children = node.getChildren();
    return children.length === 2 && children.every((c: any) => $isLineBreakNode(c));
  };

  const makeSpacerParagraph = () => {
    const spacer = $createParagraphNode();
    spacer.append($createLineBreakNode(), $createLineBreakNode());
    return spacer;
  };

  const addSpaceBefore = () => editor.update(() => {
    getSelectedBlockKeys().forEach(k => {
      const node = $getNodeByKey(k);
      if (!node) return;
      const prev = node.getPreviousSibling();
      if (isSpacerParagraph(prev)) return; // already has one
      node.insertBefore(makeSpacerParagraph());
    });
  });

  const addSpaceAfter = () => editor.update(() => {
    getSelectedBlockKeys().forEach(k => {
      const node = $getNodeByKey(k);
      if (!node) return;
      const next = node.getNextSibling();
      if (isSpacerParagraph(next)) return; // already has one
      node.insertAfter(makeSpacerParagraph());
    });
  });

  const removeSpaceBefore = () => editor.update(() => {
    getSelectedBlockKeys().forEach(k => {
      const node = $getNodeByKey(k);
      if (!node) return;
      const prev = node.getPreviousSibling();
      if (isSpacerParagraph(prev)) (prev as any).remove();
    });
  });

  const removeSpaceAfter = () => editor.update(() => {
    getSelectedBlockKeys().forEach(k => {
      const node = $getNodeByKey(k);
      if (!node) return;
      const next = node.getNextSibling();
      if (isSpacerParagraph(next)) (next as any).remove();
    });
  });

  const removeAllSpacing = () => editor.update(() => {
    getSelectedBlockKeys().forEach(k => {
      const node = $getNodeByKey(k);
      if (!node) return;
      const prev = node.getPreviousSibling();
      if (isSpacerParagraph(prev)) (prev as any).remove();
      const next = node.getNextSibling();
      if (isSpacerParagraph(next)) (next as any).remove();
    });
  });

  // --- Table editing ---
  const insertTableRow = (after: boolean) => editor.update(() => {
    try { $insertTableRow__EXPERIMENTAL(after); } catch { /* cursor isn't inside a table */ }
  });
  const insertTableColumn = (after: boolean) => editor.update(() => {
    try { $insertTableColumn__EXPERIMENTAL(after); } catch { /* cursor isn't inside a table */ }
  });
  const deleteTableRow = () => editor.update(() => {
    try { $deleteTableRow__EXPERIMENTAL(); } catch { /* cursor isn't inside a table */ }
  });
  const deleteTableColumn = () => editor.update(() => {
    try { $deleteTableColumn__EXPERIMENTAL(); } catch { /* cursor isn't inside a table */ }
  });
  const deleteTable = () => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const tableNode = $getNearestNodeOfType(selection.anchor.getNode(), TableNode);
    if (tableNode) tableNode.remove();
  });
  const adjustCellWidth = (delta: number) => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    let node: any = selection.anchor.getNode();
    while (node != null && !$isTableCellNode(node)) node = node.getParent();
    if (node && $isTableCellNode(node)) {
      const current = node.getWidth() || 120;
      node.setWidth(Math.max(40, current + delta));
    }
  });
  const adjustRowHeight = (delta: number) => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    let cellNode: any = selection.anchor.getNode();
    while (cellNode != null && !$isTableCellNode(cellNode)) cellNode = cellNode.getParent();
    if (!cellNode) return;
    const rowNode = cellNode.getParent();
    if (rowNode && typeof rowNode.setHeight === "function") {
      const current = (rowNode.getHeight && rowNode.getHeight()) || 30;
      rowNode.setHeight(Math.max(20, current + delta));
    }
  });

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const timestamp = Math.round(Date.now() / 1000);
    const sig = await sha1(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`);
    const fd = new FormData(); fd.append("file", file); fd.append("api_key", CLOUDINARY_API_KEY); fd.append("timestamp", String(timestamp)); fd.append("signature", sig);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.secure_url) {
      editor.update(() => { const sel = $getSelection(); if ($isRangeSelection(sel)) sel.insertNodes([new CustomImageNode(data.secure_url)]); });
      fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data.secure_url }) }).catch(() => { });
    }
  };

  const HEADINGS: { label: string; tag: "paragraph" | HeadingTagType }[] = [
    { label: "Normal", tag: "paragraph" },
    { label: "Heading 1", tag: "h1" },
    { label: "Heading 2", tag: "h2" },
    { label: "Heading 3", tag: "h3" },
    { label: "Heading 4", tag: "h4" },
    { label: "Heading 5", tag: "h5" },
    { label: "Heading 6", tag: "h6" },
  ];

  const LIST_OPTIONS: { label: string; kind: Parameters<typeof insertList>[0] }[] = [
    { label: "• Bullet list", kind: "bullet" },
    { label: "1. Numbered list", kind: "number" },
    { label: "a. Lower-case letters", kind: "lower-alpha" },
    { label: "A. Upper-case letters", kind: "upper-alpha" },
    { label: "i. Lower-case roman", kind: "lower-roman" },
    { label: "I. Upper-case roman", kind: "upper-roman" },
  ];

  return (
    <div
      style={{ borderBottom: "1px solid #d1d5db" }}
      // Every click/mousedown in this toolbar (including the paragraph
      // spacing menu items) is contained here. Without this, clicking any
      // toolbar button still bubbles as a native DOM event straight out of
      // this component into the host page — and if that page has any
      // "click outside the field" or "click after an edit" autosave/submit
      // listener, that stray bubble is what was triggering it, not our
      // onChange prop itself.
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <EditorStyles />
      <div style={{ display: "flex", background: "#f1f1f1", fontSize: 13 }}>
        {["Home", "Insert"].map(t => (
          <div key={t} onClick={() => setTab(t as any)} style={{ padding: "8px 14px", cursor: "pointer", borderBottom: tab === t ? "2px solid #0b57d0" : "2px solid transparent", fontWeight: tab === t ? 600 : 400 }}>{t}</div>
        ))}
      </div>

      {tab === "Home" ? (
        <div style={{ display: "flex", gap: 8, padding: 8, background: "white", flexWrap: "wrap", alignItems: "center" }}>
          <Dropdown label="Heading" open={showHeading} setOpen={setShowHeading} width={160}>
            {HEADINGS.map(h => (
              <div key={h.tag} style={menuItem} onMouseDown={e => { e.preventDefault(); formatBlock(h.tag); setShowHeading(false); }}>{h.label}</div>
            ))}
          </Dropdown>

          <Dropdown label="Font" open={showFontFamily} setOpen={setShowFontFamily} width={190}>
            {FONT_FAMILIES.map(f => (
              <div key={f.label} style={{ ...menuItem, fontFamily: f.value || undefined }} onMouseDown={e => { e.preventDefault(); setFontFamily(f.value); setShowFontFamily(false); }}>{f.label}</div>
            ))}
          </Dropdown>

          <div style={{ display: "flex", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 4 }}>
            <button type="button" onClick={() => setFontSize(fontSizeIdx - 1)} style={{ ...btn, border: "none", borderRight: "1px solid #e5e7eb" }} title="Decrease font size">A-</button>
            <span style={{ padding: "0 8px", fontSize: 13, minWidth: 24, textAlign: "center" }}>{FONT_SIZES[fontSizeIdx]}</span>
            <button type="button" onClick={() => setFontSize(fontSizeIdx + 1)} style={{ ...btn, border: "none", borderLeft: "1px solid #e5e7eb" }} title="Increase font size">A+</button>
          </div>

          <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} style={btn}><b>B</b></button>
          <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} style={btn}><i>I</i></button>
          <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} style={btn}><u>U</u></button>

          <Dropdown label={<span style={{ borderBottom: "3px solid #dc2626" }}>A</span>} open={showFontColor} setOpen={setShowFontColor} width={170}>
            <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {["#000000", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#6b7280", "#ffffff", "#f3f4f6"].map(c => (
                <div key={c} onMouseDown={e => { e.preventDefault(); setFontColor(c); setShowFontColor(false); }} style={{ width: 20, height: 20, background: c, border: "1px solid #d1d5db", cursor: "pointer", borderRadius: 3 }} />
              ))}
            </div>
          </Dropdown>

          <Dropdown label="⇤ Align" open={showAlign} setOpen={setShowAlign} width={140}>
            {[
              { label: "⇤ Left", v: "left" as ElementFormatType },
              { label: "≡ Center", v: "center" as ElementFormatType },
              { label: "⇥ Right", v: "right" as ElementFormatType },
              { label: "≡ Justify", v: "justify" as ElementFormatType },
            ].map(a => (
              <div key={a.v} style={menuItem} onMouseDown={e => { e.preventDefault(); align(a.v); setShowAlign(false); }}>{a.label}</div>
            ))}
          </Dropdown>

          <Dropdown label="≡ List" open={showList} setOpen={setShowList} width={200}>
            {LIST_OPTIONS.map(o => (
              <div key={o.kind} style={menuItem} onMouseDown={e => { e.preventDefault(); insertList(o.kind); setShowList(false); }}>{o.label}</div>
            ))}
            <div style={{ ...menuItem, borderBottom: "none", color: "#dc2626" }} onMouseDown={e => { e.preventDefault(); removeList(); setShowList(false); }}>Remove list</div>
          </Dropdown>

          <Dropdown label="⇕ Line Height" open={showLineHeight} setOpen={setShowLineHeight} width={140}>
            {LINE_HEIGHTS.map(v => (
              <div key={v} style={menuItem} onMouseDown={e => { e.preventDefault(); setLineHeight(v); setShowLineHeight(false); }}>{v}</div>
            ))}
          </Dropdown>

          <Dropdown label="¶ Paragraph" open={showParagraph} setOpen={setShowParagraph} width={210}>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); addSpaceBefore(); setShowParagraph(false); }}>Add space before</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); removeSpaceBefore(); setShowParagraph(false); }}>Remove space before</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); addSpaceAfter(); setShowParagraph(false); }}>Add space after</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); removeSpaceAfter(); setShowParagraph(false); }}>Remove space after</div>
            <div style={{ ...menuItem, borderBottom: "none" }} onMouseDown={e => { e.preventDefault(); removeAllSpacing(); setShowParagraph(false); }}>No spacing</div>
          </Dropdown>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, padding: 8, background: "white", position: "relative", alignItems: "center" }}>
          <Dropdown label="⊞ Table" open={showTable} setOpen={setShowTable} width={260}>
            <TableGridPicker onSelect={(r, c) => editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: String(r), columns: String(c) })} onClose={() => setShowTable(false)} />
          </Dropdown>

          <Dropdown label="🎨 Table color" open={showCellColor} setOpen={setShowCellColor} width={170}>
            <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {["#ffffff", "#f3f4f6", "#fee2e2", "#ffedd5", "#fef9c3", "#dcfce7", "#dbeafe", "#ede9fe", "#fce7f3", "#e5e7eb", "#111827", "#9ca3af"].map(c => (
                <div key={c} onMouseDown={e => { e.preventDefault(); setCellBackground(c); setShowCellColor(false); }} style={{ width: 20, height: 20, background: c, border: "1px solid #d1d5db", cursor: "pointer", borderRadius: 3 }} />
              ))}
            </div>
            <div style={{ padding: "0 10px 10px", fontSize: 11, color: "#6b7280" }}>Click inside a table cell first, then pick a color.</div>
          </Dropdown>

          <Dropdown label="⚙ Table tools" open={showTableTools} setOpen={setShowTableTools} width={230}>
            <div style={menuLabel}>Rows &amp; Columns</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); insertTableRow(false); setShowTableTools(false); }}>Insert row above</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); insertTableRow(true); setShowTableTools(false); }}>Insert row below</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); insertTableColumn(false); setShowTableTools(false); }}>Insert column left</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); insertTableColumn(true); setShowTableTools(false); }}>Insert column right</div>
            <div style={menuItemDanger} onMouseDown={e => { e.preventDefault(); deleteTableRow(); setShowTableTools(false); }}>Delete row</div>
            <div style={menuItemDanger} onMouseDown={e => { e.preventDefault(); deleteTableColumn(); setShowTableTools(false); }}>Delete column</div>
            <div style={menuLabel}>Resize</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); adjustCellWidth(20); setShowTableTools(false); }}>Widen column</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); adjustCellWidth(-20); setShowTableTools(false); }}>Narrow column</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); adjustRowHeight(10); setShowTableTools(false); }}>Increase row height</div>
            <div style={menuItem} onMouseDown={e => { e.preventDefault(); adjustRowHeight(-10); setShowTableTools(false); }}>Decrease row height</div>
            <div style={{ ...menuItemDanger, borderBottom: "none", fontWeight: 600 }} onMouseDown={e => { e.preventDefault(); deleteTable(); setShowTableTools(false); }}>Delete table</div>
          </Dropdown>

          <button type="button" onClick={() => fileRef.current?.click()} style={btn}>🖼️ Picture</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NEW: Table right-click context menu (mirrors the Word/WPS-style menu you
// get when right-clicking inside a table — Insert, Merge/Split Cells, Delete
// Row/Column, Cell Alignment, Borders and Shading, Delete Table).
// ============================================================================
function TableActionMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [showInsertSub, setShowInsertSub] = useState(false);
  const [showAlignSub, setShowAlignSub] = useState(false);
  const [showColorSub, setShowColorSub] = useState(false);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest("td, th") as HTMLElement | null;
      if (!cell) return; // right-click outside a table — let the browser/other menus handle it
      e.preventDefault();
      editor.update(() => {
        const existing = $getSelection();
        // If the user already dragged out a multi-cell selection (for a
        // merge), don't clobber it by moving the caret into just this cell.
        if ($isTableSelection(existing)) return;
        const node = $getNearestNodeFromDOMNode(cell);
        if (node && $isTableCellNode(node)) node.selectEnd();
      });
      setShowInsertSub(false);
      setShowAlignSub(false);
      setShowColorSub(false);
      setMenu({ x: e.clientX, y: e.clientY });
    };
    root.addEventListener("contextmenu", onContextMenu);
    return () => root.removeEventListener("contextmenu", onContextMenu);
  }, [editor]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  if (!menu) return null;

  const insertRow = (after: boolean) => editor.update(() => {
    try { $insertTableRow__EXPERIMENTAL(after); } catch { /* not inside a table */ }
  });
  const insertColumn = (after: boolean) => editor.update(() => {
    try { $insertTableColumn__EXPERIMENTAL(after); } catch { /* not inside a table */ }
  });
  const deleteRow = () => editor.update(() => {
    try { $deleteTableRow__EXPERIMENTAL(); } catch { /* not inside a table */ }
  });
  const deleteColumn = () => editor.update(() => {
    try { $deleteTableColumn__EXPERIMENTAL(); } catch { /* not inside a table */ }
  });
  const deleteTable = () => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const tableNode = $getNearestNodeOfType(selection.anchor.getNode(), TableNode);
    if (tableNode) tableNode.remove();
  });
  const setCellAlign = (dir: ElementFormatType) => editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, dir);
  });
  const setCellColor = (color: string) => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    let node: any = selection.anchor.getNode();
    while (node != null && !$isTableCellNode(node)) node = node.getParent();
    if (node && $isTableCellNode(node)) node.setBackgroundColor(color);
  });
  // Merges a rectangular multi-cell selection into its top-left cell by
  // moving every other cell's content into it and stamping colSpan/rowSpan.
  // Requires the user to have dragged across multiple cells first.
  const mergeCells = () => editor.update(() => {
    const selection = $getSelection();
    if (!$isTableSelection(selection)) return;
    const cellNodes = selection.getNodes().filter($isTableCellNode);
    if (cellNodes.length < 2) return;
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    const positions = cellNodes.map(cell => {
      const r = $getTableRowIndexFromTableCellNode(cell);
      const c = $getTableColumnIndexFromTableCellNode(cell);
      minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c);
      return { cell, r, c };
    });
    const topLeft = positions.find(p => p.r === minRow && p.c === minCol)?.cell ?? cellNodes[0];
    cellNodes.forEach(cell => {
      if (cell === topLeft) return;
      cell.getChildren().forEach(child => topLeft.append(child));
      cell.remove();
    });
    topLeft.setColSpan(maxCol - minCol + 1);
    topLeft.setRowSpan(maxRow - minRow + 1);
  });
  // Simple split: resets the current cell back to a 1x1 span.
  const splitCell = () => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    let node: any = selection.anchor.getNode();
    while (node != null && !$isTableCellNode(node)) node = node.getParent();
    if (node && $isTableCellNode(node)) { node.setColSpan(1); node.setRowSpan(1); }
  });

  const item: React.CSSProperties = { padding: "8px 14px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 };
  const itemDanger: React.CSSProperties = { ...item, color: "#dc2626" };
  const sep: React.CSSProperties = { borderTop: "1px solid #f3f4f6", margin: "4px 0" };
  const menuBox: React.CSSProperties = { position: "fixed", left: menu.x, top: menu.y, background: "white", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,.15)", zIndex: 9999, minWidth: 210, padding: "4px 0", fontSize: 13 };
  const subBox: React.CSSProperties = { position: "absolute", left: "100%", top: 0, background: "white", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,.15)", minWidth: 180, padding: "4px 0" };

  return (
    <div style={menuBox} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div style={{ position: "relative" }} onMouseEnter={() => setShowInsertSub(true)} onMouseLeave={() => setShowInsertSub(false)}>
        <div style={item}>Insert <span>›</span></div>
        {showInsertSub && (
          <div style={subBox}>
            <div style={item} onMouseDown={e => { e.preventDefault(); insertRow(false); setMenu(null); }}>Insert row above</div>
            <div style={item} onMouseDown={e => { e.preventDefault(); insertRow(true); setMenu(null); }}>Insert row below</div>
            <div style={item} onMouseDown={e => { e.preventDefault(); insertColumn(false); setMenu(null); }}>Insert column left</div>
            <div style={item} onMouseDown={e => { e.preventDefault(); insertColumn(true); setMenu(null); }}>Insert column right</div>
          </div>
        )}
      </div>
      <div style={sep} />
      <div style={item} onMouseDown={e => { e.preventDefault(); mergeCells(); setMenu(null); }}>Merge Cells</div>
      <div style={item} onMouseDown={e => { e.preventDefault(); splitCell(); setMenu(null); }}>Split Cell</div>
      <div style={sep} />
      <div style={itemDanger} onMouseDown={e => { e.preventDefault(); deleteRow(); setMenu(null); }}>Delete Row</div>
      <div style={itemDanger} onMouseDown={e => { e.preventDefault(); deleteColumn(); setMenu(null); }}>Delete Column</div>
      <div style={sep} />
      <div style={{ position: "relative" }} onMouseEnter={() => setShowAlignSub(true)} onMouseLeave={() => setShowAlignSub(false)}>
        <div style={item}>Cell Alignment <span>›</span></div>
        {showAlignSub && (
          <div style={subBox}>
            <div style={item} onMouseDown={e => { e.preventDefault(); setCellAlign("left"); setMenu(null); }}>⇤ Left</div>
            <div style={item} onMouseDown={e => { e.preventDefault(); setCellAlign("center"); setMenu(null); }}>≡ Center</div>
            <div style={item} onMouseDown={e => { e.preventDefault(); setCellAlign("right"); setMenu(null); }}>⇥ Right</div>
            <div style={item} onMouseDown={e => { e.preventDefault(); setCellAlign("justify"); setMenu(null); }}>≡ Justify</div>
          </div>
        )}
      </div>
      <div style={{ position: "relative" }} onMouseEnter={() => setShowColorSub(true)} onMouseLeave={() => setShowColorSub(false)}>
        <div style={item}>Borders and Shading <span>›</span></div>
        {showColorSub && (
          <div style={{ ...subBox, padding: 10, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, width: 160 }}>
            {["#ffffff", "#f3f4f6", "#fee2e2", "#ffedd5", "#fef9c3", "#dcfce7", "#dbeafe", "#ede9fe", "#fce7f3", "#e5e7eb", "#111827", "#9ca3af"].map(c => (
              <div key={c} onMouseDown={e => { e.preventDefault(); setCellColor(c); setMenu(null); }} style={{ width: 20, height: 20, background: c, border: "1px solid #d1d5db", cursor: "pointer", borderRadius: 3 }} />
            ))}
          </div>
        )}
      </div>
      <div style={sep} />
      <div style={itemDanger} onMouseDown={e => { e.preventDefault(); deleteTable(); setMenu(null); }}>Delete Table</div>
    </div>
  );
}

// ============================================================================
// NEW: Hover-to-expand controls. Hovering a table shows small "+" buttons on
// its top / bottom / left / right edges — click one to insert a row or
// column right there, without needing to click into the table first.
// ============================================================================
function TableHoverControlsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [hoveredTable, setHoveredTable] = useState<HTMLTableElement | null>(null);
  const hideTimeout = useRef<number | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const table = target.closest("table") as HTMLTableElement | null;
      if (!table) return;
      if (hideTimeout.current) { window.clearTimeout(hideTimeout.current); hideTimeout.current = null; }
      setHoveredTable(table);
      setRect(table.getBoundingClientRect());
    };
    const onLeave = () => {
      hideTimeout.current = window.setTimeout(() => { setHoveredTable(null); setRect(null); }, 200);
    };
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [editor]);

  const keepVisible = () => { if (hideTimeout.current) { window.clearTimeout(hideTimeout.current); hideTimeout.current = null; } };
  const scheduleHide = () => { hideTimeout.current = window.setTimeout(() => { setHoveredTable(null); setRect(null); }, 200); };

  const withTableNode = (fn: (tableNode: any) => void) => {
    if (!hoveredTable) return;
    editor.update(() => {
      const tableNode = $getNearestNodeFromDOMNode(hoveredTable);
      if (!tableNode || !$isTableNode(tableNode)) return;
      fn(tableNode);
    });
  };

  const addRowAbove = () => withTableNode(tableNode => {
    const rows = tableNode.getChildren();
    const firstRow = rows[0];
    if (!firstRow) return;
    const cells = firstRow.getChildren();
    const firstCell = cells[0];
    if (!firstCell) return;
    firstCell.selectEnd();
    $insertTableRow__EXPERIMENTAL(false);
  });
  const addRowBelow = () => withTableNode(tableNode => {
    const rows = tableNode.getChildren();
    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;
    const cells = lastRow.getChildren();
    const lastCell = cells[cells.length - 1];
    if (!lastCell) return;
    lastCell.selectEnd();
    $insertTableRow__EXPERIMENTAL(true);
  });
  const addColumnLeft = () => withTableNode(tableNode => {
    const rows = tableNode.getChildren();
    const firstRow = rows[0];
    if (!firstRow) return;
    const cells = firstRow.getChildren();
    const firstCell = cells[0];
    if (!firstCell) return;
    firstCell.selectEnd();
    $insertTableColumn__EXPERIMENTAL(false);
  });
  const addColumnRight = () => withTableNode(tableNode => {
    const rows = tableNode.getChildren();
    const firstRow = rows[0];
    if (!firstRow) return;
    const cells = firstRow.getChildren();
    const lastCell = cells[cells.length - 1];
    if (!lastCell) return;
    lastCell.selectEnd();
    $insertTableColumn__EXPERIMENTAL(true);
  });

  if (!rect) return null;

  const base: React.CSSProperties = {
    position: "fixed", width: 18, height: 18, borderRadius: 4, background: "#0b57d0", color: "white",
    border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, lineHeight: 1, zIndex: 30, boxShadow: "0 1px 4px rgba(0,0,0,.25)", padding: 0,
  };

  return (
    <>
      <button type="button" title="Insert row above" onMouseEnter={keepVisible} onMouseLeave={scheduleHide}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addRowAbove(); }}
        style={{ ...base, left: rect.left + rect.width / 2 - 9, top: rect.top - 9 }}>+</button>
      <button type="button" title="Insert row below" onMouseEnter={keepVisible} onMouseLeave={scheduleHide}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addRowBelow(); }}
        style={{ ...base, left: rect.left + rect.width / 2 - 9, top: rect.bottom - 9 }}>+</button>
      <button type="button" title="Insert column left" onMouseEnter={keepVisible} onMouseLeave={scheduleHide}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addColumnLeft(); }}
        style={{ ...base, left: rect.left - 9, top: rect.top + rect.height / 2 - 9 }}>+</button>
      <button type="button" title="Insert column right" onMouseEnter={keepVisible} onMouseLeave={scheduleHide}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addColumnRight(); }}
        style={{ ...base, left: rect.right - 9, top: rect.top + rect.height / 2 - 9 }}>+</button>
    </>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  // Shared between InitialHtmlPlugin (which sets it) and OnChangePlugin's
  // callback below (which reads and clears it), so the one editor.update()
  // that hydrates existing content on mount doesn't get reported to the
  // host as a user edit.
  const skipNextChangeRef = useRef(false);
  const config = {
    namespace: "SLANEditor",
    theme: {
      paragraph: "my-p",
      heading: { h1: "my-h1", h2: "my-h2", h3: "my-h3", h4: "my-h4", h5: "my-h5", h6: "my-h6" },
      text: { bold: "my-b", italic: "my-i", underline: "my-u" },
      list: { ul: "my-ul", ol: "my-ol", listitem: "my-li", nested: { listitem: "my-nested-li" } },
      table: "my-table",
      tableRow: "my-row",
      tableCell: "my-cell",
      tableCellHeader: "my-cell-header",
    },
    nodes: [HeadingNode, ListNode, ListItemNode, TableNode, TableRowNode, TableCellNode, CustomImageNode],
    onError: (e: Error) => console.error(e),
  };
  return (
    <LexicalComposer initialConfig={config as any}>
      <div style={{ border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "white" }}>
        <Toolbar />
        <div style={{ position: "relative" }}>
          <RichTextPlugin contentEditable={<ContentEditable style={{ minHeight: 300, padding: 20, outline: "none" }} />} placeholder={<div style={{ position: "absolute", top: 20, left: 20, color: "#999", pointerEvents: "none" }}>{placeholder || "Write content..."}</div>} ErrorBoundary={LexicalErrorBoundary} />
          <HistoryPlugin /><ListPlugin /><TablePlugin /><PasteCleanupPlugin />
          {/* <TableCellResizerPlugin /> */}
          <TableActionMenuPlugin />
          <TableHoverControlsPlugin />
          <InitialHtmlPlugin value={value} skipNextChangeRef={skipNextChangeRef} />
          <OnChangePlugin
            ignoreSelectionChange
            onChange={(editorState, editor) => {
              // Skip the one firing caused by InitialHtmlPlugin loading
              // existing content on mount — that's not a user edit.
              if (skipNextChangeRef.current) {
                skipNextChangeRef.current = false;
                return;
              }
              editorState.read(() => {
                const html = $generateHtmlFromNodes(editor, null);
                onChange(inlineTableStyles(html));
              });
            }}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}