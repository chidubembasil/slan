import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem("adminAccessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const statusColors: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

const statusOptions = ["draft", "published", "archived"];

type ManageTab = "tracks" | "modules" | "units";

// ── Types ──────────────────────────────────────────────────────────────────

type Track = {
  id: number; title: string; slug: string; description: string;
  shortDescription: string; thumbnail: string; orderIndex: number;
  isFree: boolean; price: number; status: string;
  createdAt: string; updatedAt: string;
};

type Module = {
  id: number; title: string; description: string; content: string;
  orderIndex: number; estimatedReadMinutes: number;
  passMarkPercent: number; maxAttempts: number; status: string;
  createdAt: string; updatedAt: string;
};

type Unit = {
  id: number; title: string; description: string; content: string;
  summary: string; caseStudy: string; discussionPrompt: string;
  videoUrl: string; pdfUrl: string; orderIndex: number;
  estimatedReadMinutes: number; passMarkPercent: number;
  maxAttempts: number; status: string;
  createdAt: string; updatedAt: string;
};

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 ${type === "success" ? "bg-[#004900] text-white" : "bg-red-600 text-white"}`}>
      {type === "success"
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
      }
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white text-xs">✕</button>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Confirm Delete</p>
            <p className="text-xs text-gray-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────

function EditModal({ title, fields, data, onSave, onClose, loading }: {
  title: string;
  fields: { key: string; label: string; type: "text" | "textarea" | "number" | "select" | "checkbox" | "url"; options?: string[]; required?: boolean }[];
  data: Record<string, any>;
  onSave: (updated: Record<string, any>) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<Record<string, any>>({ ...data });

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea rows={3} value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} className={inputCls + " resize-none"} aria-label="textarea"/>
              ) : f.type === "select" ? (
                <select value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} className={inputCls} aria-label="this.selectComponent('', comp => {
                  console.log(comp);
                });">
                  {f.options?.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!form[f.key]} onChange={e => set(f.key, e.target.checked)} className="w-4 h-4 accent-[#004900]" />
                  <span className="text-gray-700">Yes</span>
                </label>
              ) : (
                <input type={f.type === "url" ? "url" : f.type === "number" ? "number" : "text"} value={form[f.key] ?? ""} onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} className={inputCls} aria-label="input"/>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading} className="px-5 py-2 text-sm text-white bg-[#004900] rounded-lg hover:bg-[#003700] disabled:opacity-60">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TRACKS TAB
// ══════════════════════════════════════════════════════════════════════════

function TracksTab({ toast }: { toast: (msg: string, type?: "success" | "error") => void }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<Track | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Track | null>(null);
  const [statusLoading, setStatusLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<Record<number, any>>({});

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/tracks`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTracks(Array.isArray(data) ? data : data.tracks ?? []);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTracks(); }, [fetchTracks]);

  const fetchDetail = async (id: number) => {
    if (detailData[id]) { setExpandedId(expandedId === id ? null : id); return; }
    try {
      const res = await fetch(`${BASE}admin/tracks/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDetailData(d => ({ ...d, [id]: data }));
      setExpandedId(id);
    } catch (e: any) { toast(e.message, "error"); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await fetch(`${BASE}admin/tracks/${deleteItem.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast(`Track "${deleteItem.title}" deleted`);
      setDeleteItem(null);
      fetchTracks();
    } catch (e: any) { toast(e.message, "error"); setDeleteItem(null); }
  };

  const handleEdit = async (updated: Record<string, any>) => {
    if (!editItem) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${BASE}admin/tracks/${editItem.id}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast(`Track "${updated.title}" updated`);
      setEditItem(null);
      setDetailData({});
      fetchTracks();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setEditLoading(false); }
  };

  const handleStatusPatch = async (track: Track, status: string) => {
    setStatusLoading(track.id);
    try {
      const res = await fetch(`${BASE}admin/tracks/${track.id}/status`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast(`Status updated to "${status}"`);
      fetchTracks();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setStatusLoading(null); }
  };

  const filtered = tracks.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.status?.toLowerCase().includes(search.toLowerCase())
  );

  const trackEditFields = [
    { key: "title", label: "Title", type: "text" as const, required: true },
    { key: "shortDescription", label: "Short Description", type: "text" as const, required: true },
    { key: "description", label: "Description", type: "textarea" as const, required: true },
    { key: "thumbnail", label: "Thumbnail URL", type: "url" as const },
    { key: "orderIndex", label: "Order Index", type: "number" as const },
    { key: "isFree", label: "Is Free", type: "checkbox" as const },
    { key: "price", label: "Price (₦)", type: "number" as const },
    { key: "status", label: "Status", type: "select" as const, options: statusOptions },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20" />
        </div>
        <button onClick={fetchTracks} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading tracks...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No tracks found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(track => (
            <div key={track.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              {/* Row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 bg-[#004900]/10 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-[#004900] text-xs font-bold">{track.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{track.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{track.shortDescription}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[track.status] || "bg-gray-100 text-gray-500"}`}>
                    {track.status}
                  </span>
                  <span className="text-xs text-gray-400">{track.isFree ? "Free" : `₦${track.price}`}</span>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => fetchDetail(track.id)} title="View" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button onClick={() => setEditItem(track)} title="Edit" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {/* Quick status */}
                  <select
                    value={track.status}
                    onChange={e => handleStatusPatch(track, e.target.value)}
                    disabled={statusLoading === track.id}
                    title="Quick status change"
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 cursor-pointer"
                  >
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setDeleteItem(track)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === track.id && detailData[track.id] && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-gray-400 mb-0.5">Order Index</p><p className="font-medium">{detailData[track.id].orderIndex}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Modules</p><p className="font-medium">{detailData[track.id].modules?.length ?? 0}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Created</p><p className="font-medium">{new Date(detailData[track.id].createdAt).toLocaleDateString()}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Updated</p><p className="font-medium">{new Date(detailData[track.id].updatedAt).toLocaleDateString()}</p></div>
                  </div>
                  {detailData[track.id].description && (
                    <p className="text-xs text-gray-600 mt-3 leading-relaxed">{detailData[track.id].description}</p>
                  )}
                  {detailData[track.id].modules?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Modules</p>
                      <div className="flex flex-wrap gap-2">
                        {detailData[track.id].modules.map((m: any) => (
                          <span key={m.id} className="bg-white border border-gray-200 text-xs px-2 py-1 rounded-lg text-gray-700">
                            #{m.id} {m.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <EditModal title={`Edit Track #${editItem.id}`} fields={trackEditFields} data={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} loading={editLoading} />
      )}
      {deleteItem && (
        <ConfirmDialog message={`Delete "${deleteItem.title}"? This will also delete all its modules and units.`} onConfirm={handleDelete} onCancel={() => setDeleteItem(null)} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MODULES TAB
// ══════════════════════════════════════════════════════════════════════════

function ModulesTab({ toast }: { toast: (msg: string, type?: "success" | "error") => void }) {
  const [trackId, setTrackId] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<Module | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Module | null>(null);
  const [statusLoading, setStatusLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<Record<number, any>>({});
  const [fetched, setFetched] = useState(false);

  const fetchModules = async () => {
    if (!trackId.trim()) { toast("Enter a Track ID first", "error"); return; }
    setLoading(true); setFetched(true);
    try {
      const res = await fetch(`${BASE}admin/tracks/${trackId}/modules`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setModules(Array.isArray(data) ? data : data.modules ?? []);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const fetchDetail = async (id: number) => {
    if (detailData[id]) { setExpandedId(expandedId === id ? null : id); return; }
    try {
      const res = await fetch(`${BASE}admin/modules/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDetailData(d => ({ ...d, [id]: data }));
      setExpandedId(id);
    } catch (e: any) { toast(e.message, "error"); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await fetch(`${BASE}admin/modules/${deleteItem.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast(`Module "${deleteItem.title}" deleted`);
      setDeleteItem(null);
      fetchModules();
    } catch (e: any) { toast(e.message, "error"); setDeleteItem(null); }
  };

  const handleEdit = async (updated: Record<string, any>) => {
    if (!editItem) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${BASE}admin/modules/${editItem.id}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast(`Module "${updated.title}" updated`);
      setEditItem(null); setDetailData({});
      fetchModules();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setEditLoading(false); }
  };

  const handleStatusPatch = async (mod: Module, status: string) => {
    setStatusLoading(mod.id);
    try {
      const res = await fetch(`${BASE}admin/modules/${mod.id}/status`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast(`Status updated to "${status}"`);
      fetchModules();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setStatusLoading(null); }
  };

  const filtered = modules.filter(m =>
    m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.status?.toLowerCase().includes(search.toLowerCase())
  );

  const moduleEditFields = [
    { key: "title", label: "Title", type: "text" as const, required: true },
    { key: "description", label: "Description", type: "textarea" as const, required: true },
    { key: "content", label: "Content", type: "textarea" as const },
    { key: "orderIndex", label: "Order Index", type: "number" as const },
    { key: "estimatedReadMinutes", label: "Estimated Read (mins)", type: "number" as const },
    { key: "passMarkPercent", label: "Pass Mark (%)", type: "number" as const },
    { key: "maxAttempts", label: "Max Attempts", type: "number" as const },
    { key: "status", label: "Status", type: "select" as const, options: statusOptions },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Track ID:</span>
          <input
            type="number" min="1" value={trackId}
            onChange={e => setTrackId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchModules()}
            placeholder="e.g. 1"
            className="w-20 text-sm focus:outline-none"
          />
        </div>
        <button onClick={fetchModules} className="px-4 py-2 bg-[#004900] text-white text-sm rounded-lg hover:bg-[#003700]">
          Load Modules
        </button>
        {fetched && (
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search modules..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20" />
          </div>
        )}
      </div>

      {!fetched ? (
        <div className="text-center py-16 text-gray-400 text-sm">Enter a Track ID and click Load Modules</div>
      ) : loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading modules...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No modules found for Track #{trackId}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(mod => (
            <div key={mod.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-blue-600 text-xs font-bold">{mod.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{mod.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{mod.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[mod.status] || "bg-gray-100 text-gray-500"}`}>{mod.status}</span>
                  <span className="text-xs text-gray-400">{mod.estimatedReadMinutes}min</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => fetchDetail(mod.id)} title="View" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button onClick={() => setEditItem(mod)} title="Edit" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <select value={mod.status} onChange={e => handleStatusPatch(mod, e.target.value)} disabled={statusLoading === mod.id} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer" aria-label="select">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setDeleteItem(mod)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>

              {expandedId === mod.id && detailData[mod.id] && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-gray-400 mb-0.5">Pass Mark</p><p className="font-medium">{detailData[mod.id].passMarkPercent}%</p></div>
                    <div><p className="text-gray-400 mb-0.5">Max Attempts</p><p className="font-medium">{detailData[mod.id].maxAttempts}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Units</p><p className="font-medium">{detailData[mod.id].units?.length ?? 0}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Order</p><p className="font-medium">{detailData[mod.id].orderIndex}</p></div>
                  </div>
                  {detailData[mod.id].units?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Units</p>
                      <div className="flex flex-wrap gap-2">
                        {detailData[mod.id].units.map((u: any) => (
                          <span key={u.id} className="bg-white border border-gray-200 text-xs px-2 py-1 rounded-lg text-gray-700">#{u.id} {u.title}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editItem && <EditModal title={`Edit Module #${editItem.id}`} fields={moduleEditFields} data={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} loading={editLoading} />}
      {deleteItem && <ConfirmDialog message={`Delete "${deleteItem.title}"? This will also delete all its units.`} onConfirm={handleDelete} onCancel={() => setDeleteItem(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// UNITS TAB
// ══════════════════════════════════════════════════════════════════════════

function UnitsTab({ toast }: { toast: (msg: string, type?: "success" | "error") => void }) {
  const [moduleId, setModuleId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<Unit | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Unit | null>(null);
  const [statusLoading, setStatusLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<Record<number, any>>({});
  const [fetched, setFetched] = useState(false);

  const fetchUnits = async () => {
    if (!moduleId.trim()) { toast("Enter a Module ID first", "error"); return; }
    setLoading(true); setFetched(true);
    try {
      const res = await fetch(`${BASE}admin/modules/${moduleId}/units`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUnits(Array.isArray(data) ? data : data.units ?? []);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const fetchDetail = async (id: number) => {
    if (detailData[id]) { setExpandedId(expandedId === id ? null : id); return; }
    try {
      const res = await fetch(`${BASE}admin/units/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDetailData(d => ({ ...d, [id]: data }));
      setExpandedId(id);
    } catch (e: any) { toast(e.message, "error"); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await fetch(`${BASE}admin/units/${deleteItem.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast(`Unit "${deleteItem.title}" deleted`);
      setDeleteItem(null); fetchUnits();
    } catch (e: any) { toast(e.message, "error"); setDeleteItem(null); }
  };

  const handleEdit = async (updated: Record<string, any>) => {
    if (!editItem) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${BASE}admin/units/${editItem.id}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast(`Unit "${updated.title}" updated`);
      setEditItem(null); setDetailData({});
      fetchUnits();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setEditLoading(false); }
  };

  const handleStatusPatch = async (unit: Unit, status: string) => {
    setStatusLoading(unit.id);
    try {
      const res = await fetch(`${BASE}admin/units/${unit.id}/status`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      toast(`Status updated to "${status}"`);
      fetchUnits();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setStatusLoading(null); }
  };

  const filtered = units.filter(u =>
    u.title?.toLowerCase().includes(search.toLowerCase()) ||
    u.status?.toLowerCase().includes(search.toLowerCase())
  );

  const unitEditFields = [
    { key: "title", label: "Title", type: "text" as const, required: true },
    { key: "description", label: "Description", type: "textarea" as const, required: true },
    { key: "content", label: "Content", type: "textarea" as const },
    { key: "summary", label: "Summary", type: "textarea" as const },
    { key: "caseStudy", label: "Case Study", type: "textarea" as const },
    { key: "discussionPrompt", label: "Discussion Prompt", type: "textarea" as const },
    { key: "videoUrl", label: "Video URL", type: "url" as const },
    { key: "pdfUrl", label: "PDF URL", type: "url" as const },
    { key: "orderIndex", label: "Order Index", type: "number" as const },
    { key: "estimatedReadMinutes", label: "Estimated Read (mins)", type: "number" as const },
    { key: "passMarkPercent", label: "Pass Mark (%)", type: "number" as const },
    { key: "maxAttempts", label: "Max Attempts", type: "number" as const },
    { key: "status", label: "Status", type: "select" as const, options: statusOptions },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Module ID:</span>
          <input
            type="number" min="1" value={moduleId}
            onChange={e => setModuleId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchUnits()}
            placeholder="e.g. 1"
            className="w-20 text-sm focus:outline-none"
          />
        </div>
        <button onClick={fetchUnits} className="px-4 py-2 bg-[#004900] text-white text-sm rounded-lg hover:bg-[#003700]">
          Load Units
        </button>
        {fetched && (
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search units..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20" />
          </div>
        )}
      </div>

      {!fetched ? (
        <div className="text-center py-16 text-gray-400 text-sm">Enter a Module ID and click Load Units</div>
      ) : loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading units...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No units found for Module #{moduleId}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(unit => (
            <div key={unit.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-purple-600 text-xs font-bold">{unit.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{unit.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{unit.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[unit.status] || "bg-gray-100 text-gray-500"}`}>{unit.status}</span>
                  <span className="text-xs text-gray-400">{unit.estimatedReadMinutes}min</span>
                  {unit.videoUrl && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">VID</span>}
                  {unit.pdfUrl && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">PDF</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => fetchDetail(unit.id)} title="View" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button onClick={() => setEditItem(unit)} title="Edit" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <select value={unit.status} onChange={e => handleStatusPatch(unit, e.target.value)} disabled={statusLoading === unit.id} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer" aria-label="select">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setDeleteItem(unit)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>

              {expandedId === unit.id && detailData[unit.id] && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-gray-400 mb-0.5">Pass Mark</p><p className="font-medium">{detailData[unit.id].passMarkPercent}%</p></div>
                    <div><p className="text-gray-400 mb-0.5">Max Attempts</p><p className="font-medium">{detailData[unit.id].maxAttempts}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Order</p><p className="font-medium">{detailData[unit.id].orderIndex}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Read Time</p><p className="font-medium">{detailData[unit.id].estimatedReadMinutes}min</p></div>
                  </div>
                  {detailData[unit.id].summary && <div><p className="text-xs font-medium text-gray-500 mb-1">Summary</p><p className="text-xs text-gray-600">{detailData[unit.id].summary}</p></div>}
                  {detailData[unit.id].discussionPrompt && <div><p className="text-xs font-medium text-gray-500 mb-1">Discussion Prompt</p><p className="text-xs text-gray-600">{detailData[unit.id].discussionPrompt}</p></div>}
                  {(detailData[unit.id].videoUrl || detailData[unit.id].pdfUrl) && (
                    <div className="flex gap-3">
                      {detailData[unit.id].videoUrl && <a href={detailData[unit.id].videoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">▶ Video</a>}
                      {detailData[unit.id].pdfUrl && <a href={detailData[unit.id].pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-orange-600 hover:underline">📄 PDF</a>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editItem && <EditModal title={`Edit Unit #${editItem.id}`} fields={unitEditFields} data={editItem} onSave={handleEdit} onClose={() => setEditItem(null)} loading={editLoading} />}
      {deleteItem && <ConfirmDialog message={`Delete unit "${deleteItem.title}"?`} onConfirm={handleDelete} onCancel={() => setDeleteItem(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════

const tabs: { id: ManageTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "tracks", label: "Tracks",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  },
  {
    id: "modules", label: "Modules",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  },
  {
    id: "units", label: "Units",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  },
];

export default function CurriculumManage() {
  const [activeTab, setActiveTab] = useState<ManageTab>("tracks");
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Nav */}
      <div className="max-w-5xl mx-auto px-8 pt-6">
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-7 py-3.5 text-sm font-medium border-b-2 transition-all flex-1 justify-center -mb-px ${
                activeTab === tab.id
                  ? "border-[#004900] text-[#004900] bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={activeTab === tab.id ? "text-[#004900]" : "text-gray-400"}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="bg-white rounded-b-xl rounded-tr-xl border border-gray-200 border-t-0 p-6 shadow-sm">
          {activeTab === "tracks" && <TracksTab toast={showToast} />}
          {activeTab === "modules" && <ModulesTab toast={showToast} />}
          {activeTab === "units" && <UnitsTab toast={showToast} />}
        </div>
      </div>

      {toastMsg && <Toast message={toastMsg.text} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
    </div>
  );
}