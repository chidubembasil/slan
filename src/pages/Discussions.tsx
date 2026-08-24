import { useEffect, useMemo, useState } from "react";
import { useAuthGuard } from "../hooks/useAuthGuard";
import {
  MessageSquare,
  Pin,
  Lock,
  Unlock,
  Trash2,
  Pencil,
  Search,
  X,
  AlertCircle,
  Check,
  PinOff,
  Shield,
  Eye,
  Calendar,
  User,
  ChevronRight,
  Loader2,
  MessageCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL as string;
const API = (API_BASE ?? "").replace(/\/+$/, "");

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem("adminAccessToken") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}

interface Reply {
  id: number;
  body?: string;
  content?: string;
  text?: string;
  author?: string;
  authorName?: string;
  author_name?: string;
  user?: { id: number; fullName: string };
  createdAt?: string;
  created_at?: string;
}

interface Discussion {
  id: number;
  title: string;
  body?: string;
  content?: string;
  description?: string;
  author?: string;
  authorName?: string;
  author_name?: string;
  authorId?: number;
  user?: { id: number; fullName: string; avatar?: string };
  isPinned?: boolean;
  is_pinned?: boolean;
  pinned?: boolean;
  isLocked?: boolean;
  is_locked?: boolean;
  locked?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  replies?: Reply[];
  repliesCount?: number;
  _count?: { replies: number };
}

function getIsPinned(d: Discussion) {
  return !!(d.isPinned ?? d.is_pinned ?? d.pinned);
}
function getIsLocked(d: Discussion) {
  return !!(d.isLocked ?? d.is_locked ?? d.locked);
}
function getBody(d: Discussion) {
  return d.body ?? d.content ?? d.description ?? "";
}
function getAuthorName(d: Discussion) {
  return d.authorName ?? d.author_name ?? d.author ?? d.user?.fullName ?? "Unknown";
}
function getCreatedAt(d: Discussion) {
  return d.createdAt ?? d.created_at ?? d.updatedAt;
}
function getReplyBody(r: Reply) {
  return r.body ?? r.content ?? r.text ?? "";
}
function getReplyAuthor(r: Reply) {
  return r.authorName ?? r.author_name ?? r.author ?? r.user?.fullName ?? "Unknown";
}
function getReplyDate(r: Reply) {
  return r.createdAt ?? r.created_at;
}

function extractArray(json: unknown): Discussion[] {
  if (Array.isArray(json)) return json as Discussion[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Discussion[];
    if (o.data && typeof o.data === "object") {
      const d = o.data as Record<string, unknown>;
      if (Array.isArray(d.discussions)) return d.discussions as Discussion[];
      if (Array.isArray(d.items)) return d.items as Discussion[];
      if (Array.isArray(d.results)) return d.results as Discussion[];
    }
    if (Array.isArray(o.discussions)) return o.discussions as Discussion[];
    if (Array.isArray(o.items)) return o.items as Discussion[];
  }
  return [];
}

export default function Discussions() {
  useAuthGuard();

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Discussion | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned" | "locked">("all");
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // — API filters: GET /discussions?unitId=&moduleId=&page=&limit=  (pinned first)
  const [filterUnitId, setFilterUnitId] = useState<string>("");
  const [filterModuleId, setFilterModuleId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [filterUnits, setFilterUnits] = useState<{ id: number; title: string }[]>([]);
  const [filterModules, setFilterModules] = useState<{ id: number; title: string }[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: "discussion" | "reply"; discussionId: number; replyId?: number } | null>(null);

  const showToast = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch units/modules for filter dropdowns (lightweight, reuses admin endpoints)
  const fetchFilterOptions = async () => {
    setFilterLoading(true);
    const token = localStorage.getItem("adminAccessToken") ?? "";
    const h = token ? { Authorization: `Bearer ${token}` } : {} as Record<string,string>;
    try {
      // tracks -> modules -> units
      const tracksRes = await fetch(`${API}/admin/tracks`, { headers: h });
      if (!tracksRes.ok) throw new Error("tracks");
      const tracksData = await tracksRes.json();
      const tracksList: { id:number }[] = Array.isArray(tracksData) ? tracksData : (tracksData.data ?? tracksData.tracks ?? []);
      // modules
      const modResults = await Promise.all(
        tracksList.map((t) =>
          fetch(`${API}/admin/tracks/${t.id}/modules`, { headers: h })
            .then((r) => r.json())
            .then((d) => (Array.isArray(d) ? d : (d.data ?? d.modules ?? [])))
            .catch(() => [])
        )
      );
      const allMods = modResults.flat() as { id:number; title:string }[];
      setFilterModules(allMods.map((m) => ({ id: m.id, title: m.title })));
      if (allMods.length === 0) {
        setFilterUnits([]);
        return;
      }
      const unitResults = await Promise.all(
        allMods.map((m) =>
          fetch(`${API}/admin/modules/${m.id}/units`, { headers: h })
            .then((r) => r.json())
            .then((d) => (Array.isArray(d) ? d : (d.data ?? d.units ?? [])))
            .catch(() => [])
        )
      );
      const allUnits = unitResults.flat() as { id:number; title:string }[];
      setFilterUnits(allUnits.map((u) => ({ id: u.id, title: u.title })));
    } catch {
      // non-fatal
    } finally {
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Lock body scroll when any modal is open — modal fits full screen, no background scroll
  useEffect(() => {
    const locked = editOpen || !!deleteTarget;
    const prev = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    if (locked) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [editOpen, deleteTarget]);

  const fetchDiscussionDetail = async (id: number) => {
    // GET /discussions/{id} — discussion + all replies
    const candidates = [`${API}/discussions/${id}`, `${API}/api/discussions/${id}`];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { headers: { ...authHeaders() } });
        if (!res.ok) {
          if (res.status === 404) continue;
          throw new Error(`${res.status}`);
        }
        const json = await res.json();
        // API may wrap in data/discussion
        const d = (json as Record<string, unknown>).data ?? json;
        if (d && typeof d === "object" && "id" in (d as Record<string, unknown>)) return d as Discussion;
        if (Array.isArray(json) && json[0]) return json[0] as Discussion;
        return d as Discussion;
      } catch {
        continue;
      }
    }
    return null;
  };

  const handleSelectDiscussion = async (d: Discussion) => {
    setSelected(d);
    const detail = await fetchDiscussionDetail(d.id);
    if (detail) {
      setSelected(detail);
      setDiscussions((prev) => prev.map((x) => (x.id === detail.id ? { ...x, ...detail } : x)));
    }
  };

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUnitId) params.set("unitId", filterUnitId);
      if (filterModuleId) params.set("moduleId", filterModuleId);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const qs = params.toString();
      const candidates = [`${API}/discussions?${qs}`, `${API}/api/discussions?${qs}`];
      let lastErr: unknown = null;
      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers: { ...authHeaders() } });
          if (!res.ok) {
            if (res.status === 404) continue;
            throw new Error(`${res.status} ${res.statusText}`);
          }
          const json = await res.json();
          let arr = extractArray(json);
          // Pinned threads appear first (client-side guarantee even if API doesn't sort)
          arr = [...arr].sort((a, b) => {
            const pa = getIsPinned(a) ? 1 : 0;
            const pb = getIsPinned(b) ? 1 : 0;
            if (pb !== pa) return pb - pa;
            const da = new Date(getCreatedAt(a) ?? 0).getTime();
            const db = new Date(getCreatedAt(b) ?? 0).getTime();
            return db - da;
          });
          setDiscussions(arr);
          if (arr.length > 0) {
            // keep selection if still present, else pick first pinned
            const keep = selected ? arr.find((x) => x.id === selected.id) : null;
            if (keep) {
              const detail = await fetchDiscussionDetail(keep.id);
              setSelected(detail ?? keep);
            } else {
              const first = arr[0];
              const detail = await fetchDiscussionDetail(first.id);
              setSelected(detail ?? first);
            }
          } else {
            setSelected(null);
          }
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      if (lastErr) throw lastErr;
    } catch (e) {
      console.error(e);
      showToast("error", e instanceof Error ? e.message : "Failed to load discussions");
      if (discussions.length === 0) {
        const mock: Discussion[] = [
          {
            id: 1,
            title: "How to structure a great field report?",
            body: "Hello everyone! I'm preparing my first field report for the SLAN community. What structure do you recommend? Should I include methodology and reflections separately?",
            authorName: "Amina Bello",
            isPinned: true,
            isLocked: false,
            createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
            replies: [
              { id: 101, body: "Great question! Use the STAR method — Situation, Task, Action, Result. Keep it under 800 words.", authorName: "Dr. Chidi Okoro", createdAt: new Date(Date.now() - 3600000).toISOString() },
              { id: 102, body: "Also attach photos from the field — it really helps reviewers.", authorName: "Fatima Musa", createdAt: new Date(Date.now() - 1800000).toISOString() },
            ],
          },
          {
            id: 2,
            title: "Assessment feedback not reflecting",
            body: "I submitted my module 3 assessment 4 days ago but the status still shows pending. Is this normal?",
            authorName: "Samuel Okafor",
            isPinned: false,
            isLocked: true,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            replies: [{ id: 201, body: "Hi Samuel, our team is reviewing. You'll get an update within 24h.", authorName: "SLAN Admin", createdAt: new Date().toISOString() }],
          },
          {
            id: 3,
            title: "Best resources for soil science track?",
            body: "Could anyone recommend open-access resources for the Soil Science track? Videos or PDFs work.",
            authorName: "Grace E.",
            isPinned: false,
            isLocked: false,
            createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
            replies: [],
          },
        ];
        setDiscussions(mock);
        if (!selected) setSelected(mock[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUnitId, filterModuleId, page, limit]);

  const filtered = useMemo(() => {
    return discussions.filter((d) => {
      const q = search.toLowerCase().trim();
      const matchesQ =
        !q ||
        d.title.toLowerCase().includes(q) ||
        getBody(d).toLowerCase().includes(q) ||
        getAuthorName(d).toLowerCase().includes(q);
      const pinned = getIsPinned(d);
      const locked = getIsLocked(d);
      const matchesFilter = filter === "all" || (filter === "pinned" && pinned) || (filter === "locked" && locked);
      return matchesQ && matchesFilter;
    });
  }, [discussions, search, filter]);

  const stats = useMemo(() => {
    const pinned = discussions.filter(getIsPinned).length;
    const locked = discussions.filter(getIsLocked).length;
    return { total: discussions.length, pinned, locked };
  }, [discussions]);

  // ---- handlers using exact routes you provided ----

  const patchDiscussion = async (id: number, payload: { title?: string; body?: string }) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API}/discussions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Not authorised — only author or admin can update");
        const t = await res.text();
        throw new Error(t || `Update failed (${res.status})`);
      }
      showToast("success", "Discussion updated");
      await fetchDiscussions();
      return true;
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const deleteDiscussion = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API}/discussions/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Not authorised — only author or admin can delete");
        const t = await res.text();
        throw new Error(t || `Delete failed (${res.status})`);
      }
      showToast("success", "Discussion deleted");
      setDiscussions((prev) => prev.filter((d) => d.id !== id));
      if (selected?.id === id) setSelected(null);
      return true;
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Delete failed");
      return false;
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  const deleteReply = async (discussionId: number, replyId: number) => {
    setBusyId(replyId);
    try {
      const res = await fetch(`${API}/discussions/${discussionId}/replies/${replyId}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Not authorised — only author or admin can delete this reply");
        const t = await res.text();
        throw new Error(t || `Delete failed (${res.status})`);
      }
      showToast("success", "Reply deleted");
      // optimistic local update
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId ? { ...d, replies: (d.replies ?? []).filter((r) => r.id !== replyId) } : d
        )
      );
      setSelected((prev) =>
        prev && prev.id === discussionId ? { ...prev, replies: (prev.replies ?? []).filter((r) => r.id !== replyId) } : prev
      );
      return true;
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Delete failed");
      return false;
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  const togglePin = async (d: Discussion) => {
    const next = !getIsPinned(d);
    setBusyId(d.id);
    try {
      const res = await fetch(`${API}/discussions/${d.id}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isPinned: next }),
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Not authorised — admin only");
        const t = await res.text();
        throw new Error(t || `Pin failed (${res.status})`);
      }
      showToast("success", next ? "Pinned to top" : "Unpinned");
      setDiscussions((prev) => prev.map((x) => (x.id === d.id ? { ...x, isPinned: next, is_pinned: next } : x)));
      setSelected((prev) => (prev?.id === d.id ? { ...prev, isPinned: next, is_pinned: next } : prev));
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Pin failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggleLock = async (d: Discussion) => {
    const next = !getIsLocked(d);
    setBusyId(d.id);
    try {
      const res = await fetch(`${API}/discussions/${d.id}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isLocked: next }),
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Not authorised — admin only");
        const t = await res.text();
        throw new Error(t || `Lock failed (${res.status})`);
      }
      showToast("success", next ? "Discussion locked" : "Discussion unlocked");
      setDiscussions((prev) => prev.map((x) => (x.id === d.id ? { ...x, isLocked: next, is_locked: next } : x)));
      setSelected((prev) => (prev?.id === d.id ? { ...prev, isLocked: next, is_locked: next } : prev));
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Lock failed");
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (d: Discussion) => {
    setEditId(d.id);
    setEditTitle(d.title);
    setEditBody(getBody(d));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editId == null) return;
    if (!editTitle.trim() || !editBody.trim()) {
      showToast("error", "Title and body are required");
      return;
    }
    setSaving(true);
    const ok = await patchDiscussion(editId, { title: editTitle.trim(), body: editBody.trim() });
    setSaving(false);
    if (ok) setEditOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] w-full overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-3 sm:px-4 md:px-0 w-full">
        {/* header */}
        <div className="rounded-2xl bg-gradient-to-br from-[#004900] via-[#003d00] to-[#0a5c00] text-white p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 relative overflow-hidden shadow-xl animate-slide-up">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-16 -right-16 w-72 h-72 bg-white rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-amber-400 rounded-full blur-3xl opacity-20" />
          </div>
          <div className="absolute top-6 right-6 w-24 h-24 border border-white/10 rounded-full hidden md:block" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-3 sm:gap-4 items-start min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/10">
                <MessageSquare size={20} className="text-amber-300 sm:w-[22px] sm:h-[22px]" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Discussions</h1>
                <p className="text-xs sm:text-sm text-white/70 mt-1 max-w-xl leading-relaxed">
                  Manage community conversations — edit or remove any discussion (author or admin), moderate replies, pin important topics and lock resolved threads.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:w-auto shrink-0">
              <div className="bg-white text-[#004900] rounded-2xl px-2 sm:px-4 py-2.5 sm:py-3 text-center shadow min-w-0">
                <div className="text-lg sm:text-xl font-bold">{stats.total}</div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500">Total</div>
              </div>
              <div className="bg-amber-400 text-[#002a00] rounded-2xl px-2 sm:px-4 py-2.5 sm:py-3 text-center shadow min-w-0">
                <div className="text-lg sm:text-xl font-bold flex items-center justify-center gap-1"><Pin size={12} className="sm:w-3.5 sm:h-3.5" />{stats.pinned}</div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wide opacity-70">Pinned</div>
              </div>
              <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl px-2 sm:px-4 py-2.5 sm:py-3 text-center min-w-0">
                <div className="text-lg sm:text-xl font-bold flex items-center justify-center gap-1"><Lock size={12} className="sm:w-3.5 sm:h-3.5" />{stats.locked}</div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-white/60">Locked</div>
              </div>
            </div>
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm animate-slide-down ${toast.kind === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {toast.kind === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            <span className="flex-1">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="p-1 opacity-60 hover:opacity-100"><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full overflow-hidden">
          {/* list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 space-y-3">
              {/* API filters: unitId / moduleId — GET /discussions?unitId=&moduleId=&page=&limit= */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">Module</span>
                  <select
                    value={filterModuleId}
                    onChange={(e) => { setFilterModuleId(e.target.value); setFilterUnitId(""); setPage(1); }}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
                    disabled={filterLoading}
                  >
                    <option value="">All modules</option>
                    {filterModules.map((m) => (
                      <option key={m.id} value={String(m.id)}>{m.title} — #{m.id}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">Unit</span>
                  <select
                    value={filterUnitId}
                    onChange={(e) => { setFilterUnitId(e.target.value); setPage(1); }}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
                    disabled={filterLoading}
                  >
                    <option value="">All units</option>
                    {filterUnits.map((u) => (
                      <option key={u.id} value={String(u.id)}>{u.title} — #{u.id}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">page {page} · limit {limit}</span>
                {(filterUnitId || filterModuleId) && (
                  <button
                    onClick={() => { setFilterUnitId(""); setFilterModuleId(""); setPage(1); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#004900] text-white text-xs font-semibold"
                  >
                    <X size={12} /> Clear filters
                  </button>
                )}
                <span className="ml-auto text-xs text-gray-400 hidden sm:inline">GET /discussions · pinned first</span>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, body or author..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                )}
              </div>
              <div className="flex gap-2">
                {(["all", "pinned", "locked"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border capitalize transition-all ${filter === f ? "bg-[#004900] text-white border-[#004900] shadow" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-500 self-center hidden md:inline">{filtered.length} conversations</span>
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] sm:max-h-[60vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {loading ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <Loader2 size={20} className="animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-3">Loading discussions...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto"><MessageCircle size={18} className="text-gray-400" /></div>
                  <p className="text-sm font-semibold text-slate-700 mt-3">No discussions found</p>
                  <p className="text-xs text-gray-500 mt-1">Try a different search or filter.</p>
                </div>
              ) : (
                filtered.map((d) => {
                  const pinned = getIsPinned(d);
                  const locked = getIsLocked(d);
                  const active = selected?.id === d.id;
                  const replyCount = d.replies?.length ?? d.repliesCount ?? d._count?.replies ?? 0;
                  return (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDiscussion(d)}
                      className={`group bg-white rounded-2xl border p-4 cursor-pointer transition-all ${active ? "border-[#004900] ring-2 ring-[#004900]/15 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"} ${pinned ? "bg-amber-50/20" : ""}`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${pinned ? "bg-amber-400 text-[#002a00]" : "bg-[#004900]/10 text-[#004900]"}`}>
                          {pinned ? <Pin size={14} className="fill-current" /> : <MessageSquare size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-slate-900 leading-tight line-clamp-2 pr-2">{d.title}</h3>
                            <ChevronRight size={14} className={`text-gray-400 shrink-0 mt-1 transition-transform ${active ? "translate-x-0.5 text-[#004900]" : "group-hover:translate-x-0.5"}`} />
                          </div>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{getBody(d)}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                            <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full text-gray-700"><User size={12} />{getAuthorName(d)}</span>
                            <span className="inline-flex items-center gap-1 text-gray-500"><Calendar size={12} />{timeAgo(getCreatedAt(d))}</span>
                            <span className="inline-flex items-center gap-1 text-gray-500"><MessageCircle size={12} />{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
                            {pinned && <span className="inline-flex items-center gap-1 bg-amber-400 text-[#002a00] px-2 py-1 rounded-full font-semibold text-xs"><Pin size={10} />Pinned</span>}
                            {locked && <span className="inline-flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded-full font-semibold text-xs"><Lock size={10} />Locked</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* detail */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm lg:sticky lg:top-6 overflow-hidden">
              {!selected ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto"><Eye size={18} className="text-gray-400" /></div>
                  <p className="text-sm font-medium text-slate-700 mt-3">Select a discussion</p>
                  <p className="text-xs text-gray-500 mt-1">Choose a conversation on the left to moderate it.</p>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className={`h-1 ${getIsPinned(selected) ? "bg-amber-400" : "bg-[#004900]"} ${getIsLocked(selected) ? "opacity-60" : ""}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-2 flex-wrap">
                        {getIsPinned(selected) && <span className="inline-flex items-center gap-1 bg-amber-400 text-[#002a00] px-2.5 py-1 rounded-full text-xs font-bold"><Pin size={12} /> PINNED</span>}
                        {getIsLocked(selected) && <span className="inline-flex items-center gap-1 bg-slate-800 text-white px-2.5 py-1 rounded-full text-xs font-bold"><Lock size={12} /> LOCKED</span>}
                        {!getIsPinned(selected) && !getIsLocked(selected) && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold"><Shield size={12} /> Open</span>}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">#{selected.id}</span>
                    </div>

                    <h2 className="font-semibold text-slate-900 mt-3 leading-tight">{selected.title}</h2>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><User size={12} />{getAuthorName(selected)}</span>
                      <span>·</span>
                      <span>{formatDate(getCreatedAt(selected))}</span>
                      <span className="inline-flex items-center gap-1 ml-auto"><MessageSquare size={12} />{(selected.replies?.length ?? selected.repliesCount ?? 0)} replies</span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{getBody(selected) || <span className="text-gray-400 italic">No body</span>}</div>

                    {getIsLocked(selected) && (
                      <div className="mt-3 flex items-center gap-2 text-xs bg-slate-900 text-white px-3 py-2.5 rounded-xl"><Lock size={12} /> This discussion is locked — new replies are disabled. Unlock to allow replies.</div>
                    )}

                    {/* admin controls */}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        onClick={() => togglePin(selected)}
                        disabled={busyId === selected.id}
                        className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${getIsPinned(selected) ? "bg-amber-400 border-amber-400 text-[#002a00]" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"} disabled:opacity-50`}
                      >
                        {busyId === selected.id ? <Loader2 size={12} className="animate-spin" /> : getIsPinned(selected) ? <PinOff size={12} /> : <Pin size={12} />}
                        {getIsPinned(selected) ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => toggleLock(selected)}
                        disabled={busyId === selected.id}
                        className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${getIsLocked(selected) ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"} disabled:opacity-50`}
                      >
                        {busyId === selected.id ? <Loader2 size={12} className="animate-spin" /> : getIsLocked(selected) ? <Unlock size={12} /> : <Lock size={12} />}
                        {getIsLocked(selected) ? "Unlock" : "Lock"}
                      </button>
                      <button onClick={() => openEdit(selected)} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#004900] text-white text-xs font-semibold hover:bg-[#003d00]"><Pencil size={12} /> Edit</button>
                      <button onClick={() => setDeleteTarget({ type: "discussion", discussionId: selected.id })} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"><Trash2 size={12} /> Delete</button>
                    </div>
                    {/* replies */}
                    <div className="mt-6">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 flex items-center gap-1.5"><MessageCircle size={12} /> Replies · {(selected.replies?.length ?? 0)} </h3>
                      <div className="space-y-3 mt-3 max-h-[32vh] overflow-y-auto pr-1">
                        {(selected.replies ?? []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center text-xs text-gray-500">No replies yet</div>
                        ) : (
                          (selected.replies ?? []).map((r) => (
                            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-[#004900]/10 text-[#004900] flex items-center justify-center text-xs font-bold">{getReplyAuthor(r).charAt(0).toUpperCase()}</span>{getReplyAuthor(r)}</span>
                                <span className="text-xs text-gray-500">{timeAgo(getReplyDate(r))}</span>
                              </div>
                              <p className="text-sm text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap">{getReplyBody(r)}</p>
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => setDeleteTarget({ type: "reply", discussionId: selected.id, replyId: r.id })}
                                  disabled={busyId === r.id}
                                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                                >
                                  {busyId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete reply
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                     
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>

      {/* edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setEditOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#004900]/10 flex items-center justify-center"><Pencil size={16} className="text-[#004900]" /></div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Edit discussion</h3>
                </div>
              </div>
              <button onClick={() => setEditOpen(false)} disabled={saving} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Title *</span>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Discussion title" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Body *</span>
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="Write the body..." rows={6} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] resize-none" />
              </label>
              <div className="flex gap-3">
                <button onClick={handleSaveEdit} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-[#004900] hover:bg-[#003d00] disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 rounded-xl">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Saving..." : "Save changes"}
                </button>
                <button onClick={() => setEditOpen(false)} disabled={saving} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in border border-gray-200">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-3"><Trash2 size={18} className="text-red-600" /></div>
            <h3 className="font-semibold text-slate-900">{deleteTarget.type === "discussion" ? "Delete discussion?" : "Delete reply?"}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {deleteTarget.type === "discussion"
                ? "This will permanently delete the discussion and all its replies. Only the author or an admin can do this."
                : "This will permanently delete this reply. Only the author or an admin can do this."}
            </p>
            <p className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mt-3 break-all">
              {deleteTarget.type === "discussion" ? `DELETE /discussions/${deleteTarget.discussionId}` : `DELETE /discussions/${deleteTarget.discussionId}/replies/${deleteTarget.replyId}`}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => (deleteTarget.type === "discussion" ? deleteDiscussion(deleteTarget.discussionId) : deleteReply(deleteTarget.discussionId, deleteTarget.replyId!))}
                disabled={busyId !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
              >
                {busyId !== null ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
