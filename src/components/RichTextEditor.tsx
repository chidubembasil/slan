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
import { $getRoot, $getSelection, $isRangeSelection, $createParagraphNode, $getNodeByKey, DecoratorNode } from "lexical";
import type { NodeKey } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $patchStyleText } from "@lexical/selection";
import { HeadingNode, $createHeadingNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { TableNode, TableCellNode, TableRowNode, INSERT_TABLE_COMMAND } from "@lexical/table";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";

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
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// Image Node with right-click Delete
class CustomImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  static getType(){ return "custom-image"; }
  static clone(n: CustomImageNode){ return new CustomImageNode(n.__src, n.__key); }
  constructor(src: string, key?: NodeKey){ super(key); this.__src=src; }
  createDOM(){ const d=document.createElement("span"); d.style.display="inline-block"; return d; }
  updateDOM(){ return false; }
  decorate(){ return <ImageRenderer src={this.__src} nodeKey={this.getKey()} />; }
}
function ImageRenderer({src, nodeKey}:{src:string, nodeKey:NodeKey}){
  const [editor]=useLexicalComposerContext();
  const [menu, setMenu]=useState<{x:number,y:number}|null>(null);
  useEffect(()=>{ const c=()=>setMenu(null); window.addEventListener("click",c); return()=>window.removeEventListener("click",c); },[]);
  return (
    <span onContextMenu={e=>{ e.preventDefault(); setMenu({x:e.clientX,y:e.clientY}); }} style={{position:"relative", display:"inline-block", margin:8}}>
      <img src={src} alt="" style={{maxWidth:400, border:"1px solid #ccc", borderRadius:4}} />
      {menu && <div style={{position:"fixed", left:menu.x, top:menu.y, background:"white", border:"1px solid #ddd", borderRadius:6, padding:4, zIndex:9999}}>
        <button onMouseDown={e=>{ e.preventDefault(); editor.update(()=>{ $getNodeByKey(nodeKey)?.remove(); }); }} style={{background:"#dc2626", color:"white", border:0, padding:"6px 14px", borderRadius:4, cursor:"pointer"}}>Delete</button>
      </div>}
    </span>
  );
}

// Load initial HTML value
function InitialHtmlPlugin({value}:{value:string}){
  const [editor]=useLexicalComposerContext();
  const didInit = useRef(false);
  useEffect(()=>{
    if(didInit.current ||!value) return;
    didInit.current=true;
    editor.update(()=>{
      const parser=new DOMParser();
      const dom=parser.parseFromString(value, "text/html");
      const nodes=$generateNodesFromDOM(editor, dom);
      $getRoot().clear();
      $getRoot().append(...nodes);
    });
  },[editor, value]);
  return null;
}

// Table Grid like your Screenshot 2832
function TableGridPicker({onSelect, onClose}:{onSelect:(r:number,c:number)=>void; onClose:()=>void}){
  const [hover, setHover]=useState({r:0,c:0});
  return (
    <div style={{background:"white", border:"1px solid #d1d5db", borderRadius:8, padding:12, width:260, boxShadow:"0 10px 30px rgba(0,0,0,.15)"}}>
      <div style={{display:"grid", gridTemplateColumns:"repeat(10, 1fr)", gap:4}}>
        {Array.from({length:100}).map((_,i)=>{ const r=Math.floor(i/10)+1, c=i%10+1, a=r<=hover.r && c<=hover.c;
          return <div key={i} onMouseEnter={()=>setHover({r,c})} onClick={()=>{onSelect(r,c); onClose();}} style={{width:20,height:20, border:"1px solid #9ca3af", background:a?"#3b82f6":"white", cursor:"pointer"}}/>
        })}
      </div>
      <div style={{textAlign:"center", fontSize:12, marginTop:8}}>{hover.r?`${hover.r} x ${hover.c} Table`:"Insert Table"}</div>
    </div>
  );
}

function Toolbar(){
  const [editor]=useLexicalComposerContext();
  const [tab, setTab]=useState<"Home"|"Insert">("Home");
  const [showTable, setShowTable]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const btn:React.CSSProperties={border:"1px solid #e5e7eb", background:"white", padding:"4px 8px", borderRadius:4, cursor:"pointer", fontSize:13};

  const applyStyle=(s:Record<string,string>)=>editor.update(()=>{ const sel=$getSelection(); if($isRangeSelection(sel)) $patchStyleText(sel, s as any); });
  const formatBlock=(t:"paragraph"|"h1")=>editor.update(()=>{ const sel=$getSelection(); if($isRangeSelection(sel)){ if(t==="paragraph") $setBlocksType(sel, ()=>$createParagraphNode()); else $setBlocksType(sel, ()=>$createHeadingNode("h1")); }});

  const upload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const timestamp=Math.round(Date.now()/1000);
    const sig=await sha1(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`);
    const fd=new FormData(); fd.append("file", file); fd.append("api_key", CLOUDINARY_API_KEY); fd.append("timestamp", String(timestamp)); fd.append("signature", sig);
    const res=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {method:"POST", body:fd});
    const data=await res.json();
    if(data.secure_url){
      editor.update(()=>{ const sel=$getSelection(); if($isRangeSelection(sel)) sel.insertNodes([new CustomImageNode(data.secure_url)]); });
      fetch("/api/images",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({url:data.secure_url})}).catch(()=>{});
    }
  };

  return (
    <div style={{borderBottom:"1px solid #d1d5db"}}>
      <div style={{display:"flex", background:"#f1f1f1", fontSize:13}}>{["Home","Insert"].map(t=><div key={t} onClick={()=>setTab(t as any)} style={{padding:"8px 14px", cursor:"pointer", borderBottom:tab===t?"2px solid #0b57d0":"2px solid transparent", fontWeight:tab===t?600:400}}>{t}</div>)}</div>
      {tab==="Home"?(
        <div style={{display:"flex", gap:8, padding:8, background:"white", flexWrap:"wrap"}}>
          <button onClick={()=>formatBlock("paragraph")} style={{...btn, color:"#0b57d0", borderColor:"#0b57d0"}}>¶ Paragraph</button>
          <button onClick={()=>formatBlock("paragraph")} style={btn}>Normal</button>
          <button onClick={()=>formatBlock("h1")} style={{...btn, fontWeight:700}}>Heading 1</button>
          <button onClick={()=>editor.update(()=>{ const s=$getSelection(); if($isRangeSelection(s)) (s as any).formatText("bold"); })} style={btn}><b>B</b></button>
          <button onClick={()=>editor.update(()=>{ const s=$getSelection(); if($isRangeSelection(s)) (s as any).formatText("italic"); })} style={btn}><i>I</i></button>
          <button onClick={()=>applyStyle({"font-size":"14px"})} style={btn}>A+</button>
        </div>
      ):(
        <div style={{display:"flex", gap:12, padding:8, background:"white", position:"relative"}}>
          <div style={{position:"relative"}}><button onClick={()=>setShowTable(!showTable)} style={btn}>⊞ Table ▼</button>{showTable && <div style={{position:"absolute", top:36, zIndex:10}}><TableGridPicker onSelect={(r,c)=>editor.dispatchCommand(INSERT_TABLE_COMMAND,{rows:String(r), columns:String(c)})} onClose={()=>setShowTable(false)} /></div>}</div>
          <button onClick={()=>fileRef.current?.click()} style={btn}>🖼️ Picture</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({value, onChange, placeholder}: RichTextEditorProps){
  const config={ namespace:"SLANEditor", theme:{paragraph:"my-p", heading:{h1:"my-h1"}, text:{bold:"my-b", italic:"my-i"}, table:"my-table", tableCell:"my-cell"}, nodes:[HeadingNode, ListNode, ListItemNode, TableNode, TableRowNode, TableCellNode, CustomImageNode], onError:(e:Error)=>console.error(e) };
  return (
    <LexicalComposer initialConfig={config as any}>
      <div style={{border:"1px solid #d1d5db", borderRadius:8, overflow:"hidden", background:"white"}}>
        <Toolbar />
        <div style={{position:"relative"}}>
          <RichTextPlugin contentEditable={<ContentEditable style={{minHeight:300, padding:20, outline:"none"}} />} placeholder={<div style={{position:"absolute", top:20, left:20, color:"#999", pointerEvents:"none"}}>{placeholder || "Write content..."}</div>} ErrorBoundary={LexicalErrorBoundary} />
          <HistoryPlugin /><ListPlugin /><TablePlugin />
          <InitialHtmlPlugin value={value} />
          <OnChangePlugin onChange={(editorState, editor)=>{ editorState.read(()=>{ const html=$generateHtmlFromNodes(editor, null); onChange(html); }); }} />
        </div>
      </div>
    </LexicalComposer>
  );
}