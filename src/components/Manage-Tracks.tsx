import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

type TrackStatus = "draft" | "published" | "archived";

type Track = {
  id: number;
  title: string;
  shortDescription?: string;
  status: TrackStatus;
  isFree: boolean;
  thumbnail?: string;
  courseId: number;
  course?: { id: number; title: string };
};

// ── Badge ─────────────────────────────────────────────────────────────────────

const statusBadge: Record<TrackStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: TrackStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[status]}`}>
      {status}
    </span>
  );
}

// ── Modal Shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Track Form ───────────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

function EditTrackForm({ track, onDone }: { track: Track; onDone: () => void }) {
  const [form, setForm] = useState({
    title: track.title,
    shortDescription: track.shortDescription ?? "",
    description: "",
    status: track.status,
    isFree: track.isFree,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/tracks/${track.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          shortDescription: form.shortDescription || undefined,
          description: form.description || undefined,
          status: form.status,
          isFree: form.isFree,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Short Description</label>
        <input value={form.shortDescription} onChange={e => set("shortDescription", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
          <select value={form.status} onChange={e => set("status", e.target.value)}
            className={inputCls} aria-label="select">
            {statusOptions.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end pb-1">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isFree}
              onChange={e => set("isFree", e.target.checked)}
              className="w-4 h-4 accent-[#004900]" />
            <span className="text-gray-700">Free track</span>
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Add Module Form ───────────────────────────────────────────────────────────

type ModuleForm = {
  title: string;
  description: string;
  shortDescription: string;
  status: "draft" | "published" | "archived";
};

function AddModuleForm({ trackId, onDone, onCancel }: {
  trackId: number; onDone: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<ModuleForm>({
    title: "", description: "", shortDescription: "", status: "draft",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ModuleForm, string>>>({});

  const set = (k: keyof ModuleForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof ModuleForm, string>> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.shortDescription.trim()) e.shortDescription = "Short description is required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setError("");
    if (!validate()) return;
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          trackId,
          title: form.title,
          description: form.description,
          shortDescription: form.shortDescription,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create module");
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls}
          placeholder="e.g. Introduction to Leadership" />
        {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Short Description <span className="text-red-500">*</span>
        </label>
        <input value={form.shortDescription} onChange={e => set("shortDescription", e.target.value)}
          className={inputCls} placeholder="One-line summary" />
        {formErrors.shortDescription && <p className="text-xs text-red-600 mt-1">{formErrors.shortDescription}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)}
          className={textareaCls} placeholder="Full description of this module" />
        {formErrors.description && <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)}
          className={inputCls} aria-label="select">
          {statusOptions.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSubmit} disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
          {loading ? "Creating..." : "Create Module →"}
        </button>
        <button onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "edit"; track: Track }
  | { type: "delete"; track: Track }
  | { type: "addModule"; track: Track };

export default function ManageTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      const res = await fetch(`${BASE}admin/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load tracks");
      setTracks(Array.isArray(data) ? data : data.tracks ?? []);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTracks(); }, [fetchTracks]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}admin/tracks/${modal.track.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      setModal({ type: "none" });
      showToast(`Track "${modal.track.title}" deleted`);
      fetchTracks();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Tracks</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tracks belong to courses and group related modules</p>
          </div>
          <span className="text-sm text-gray-400">
            {tracks.length} track{tracks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading tracks…
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button onClick={fetchTracks} className="text-sm text-[#004900] underline">Retry</button>
            </div>
          )}

          {!loading && !fetchError && tracks.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              No tracks found.
            </div>
          )}

          {!loading && !fetchError && tracks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">ID</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Track Name</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Free</th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tracks.map((track) => (
                    <tr key={track.id} className="hover:bg-gray-50/60 transition-colors">

                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{track.id}</td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{track.title}</div>
                        {track.shortDescription && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                            {track.shortDescription}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {track.course?.title ?? `Course #${track.courseId}`}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <Badge status={track.status} />
                      </td>

                      <td className="px-6 py-4">
                        {track.isFree ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">Free</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Paid</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">

                          {/* Add Module */}
                          <button
                            onClick={() => setModal({ type: "addModule", track })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#004900] text-white hover:bg-[#003700] transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Module
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: "edit", track })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setModal({ type: "delete", track })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                            Delete
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {modal.type === "edit" && (
        <Modal title={`Edit Track — ${modal.track.title}`} onClose={() => setModal({ type: "none" })}>
          <EditTrackForm
            track={modal.track}
            onDone={() => {
              setModal({ type: "none" });
              showToast("Track updated successfully");
              fetchTracks();
            }}
          />
        </Modal>
      )}

      {/* ── Add Module Modal ── */}
      {modal.type === "addModule" && (
        <Modal title={`Add Module to "${modal.track.title}"`} onClose={() => setModal({ type: "none" })}>
          <AddModuleForm
            trackId={modal.track.id}
            onDone={() => {
              setModal({ type: "none" });
              showToast("Module added successfully");
            }}
            onCancel={() => setModal({ type: "none" })}
          />
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.track.title}"? This will cascade and remove all its modules and units.`}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: "none" })}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#004900] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}