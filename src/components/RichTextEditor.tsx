import React, { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
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

      .my-table { border-collapse: collapse; margin: 10px 0; table-layout: fixed; }
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
        <button onMouseDown={e => { e.preventDefault(); editor.update(() => { $getNodeByKey(nodeKey)?.remove(); }); }} style={{ background: "#dc2626", color: "white", border: 0, padding: "6px 14px", borderRadius: 4, cursor: "pointer" }}>Delete</button>
      </div>}
    </span>
  );
}

// --- Paste cleanup ---
// Anything pasted in from Word/Google Docs/a news site arrives full of inline
// styles, <span>/<font> wrappers, and classes. We strip all of that down to a
// small whitelist of structural/semantic tags so pasted content inherits the
// editor's own styling instead of bringing its source formatting along.
const PASTE_ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "b", "strong", "i", "em", "u",
  "a",
  "table", "thead", "tbody", "tr", "td", "th",
  "blockquote",
]);
const PASTE_BLOCKED_TAGS = new Set(["script", "style", "meta", "link", "head", "iframe", "object", "embed", "img"]);

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
    children.forEach(c => clean.appendChild(c));
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

// Load initial HTML value
function InitialHtmlPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !value) return;
    didInit.current = true;
    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(value, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      $getRoot().clear();
      $getRoot().append(...nodes);
    });
  }, [editor, value]);
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
      <button onClick={() => setOpen(!open)} style={{ border: "1px solid #e5e7eb", background: "white", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
        {label} <span style={{ fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: 32, left: 0, zIndex: 20, background: "white", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,.12)", width, overflow: "hidden" }}>
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
  const [fontSizeIdx, setFontSizeIdx] = useState(3); // 16px default
  const fileRef = useRef<HTMLInputElement>(null);
  const btn: React.CSSProperties = { border: "1px solid #e5e7eb", background: "white", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 13 };
  const menuItem: React.CSSProperties = { padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6" };

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
    <div style={{ borderBottom: "1px solid #d1d5db" }}>
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
            <button onClick={() => setFontSize(fontSizeIdx - 1)} style={{ ...btn, border: "none", borderRight: "1px solid #e5e7eb" }} title="Decrease font size">A-</button>
            <span style={{ padding: "0 8px", fontSize: 13, minWidth: 24, textAlign: "center" }}>{FONT_SIZES[fontSizeIdx]}</span>
            <button onClick={() => setFontSize(fontSizeIdx + 1)} style={{ ...btn, border: "none", borderLeft: "1px solid #e5e7eb" }} title="Increase font size">A+</button>
          </div>

          <button onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} style={btn}><b>B</b></button>
          <button onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} style={btn}><i>I</i></button>
          <button onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} style={btn}><u>U</u></button>

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

          <button onClick={() => fileRef.current?.click()} style={btn}>🖼️ Picture</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
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
          <InitialHtmlPlugin value={value} />
          <OnChangePlugin onChange={(editorState, editor) => { editorState.read(() => { const html = $generateHtmlFromNodes(editor, null); onChange(html); }); }} />
        </div>
      </div>
    </LexicalComposer>
  );
}