import { useState, useEffect, useCallback } from "react";
import TrackCreate from "./TrackCreate";

const BASE = import.meta.env.VITE_BASE_URL;

type CourseStatus = "draft" | "published" | "archived";

type Course = {
  id: number;
  title: string;
  shortDescription: string;
  status: CourseStatus;
  thumbnail?: string;
  trackCount?: number;
};

// ── helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<CourseStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: CourseStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[status]}`}>
      {status}
    </span>
  );
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <p className="text-sm text-gray-700 mb-6">{message}</p>
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

// ── edit form ─────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

function EditCourseForm({ course, onDone }: { course: Course; onDone: () => void }) {
  const [form, setForm] = useState({
    title: course.title,
    shortDescription: course.shortDescription,
    description: "",
    status: course.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          shortDescription: form.shortDescription,
          description: form.description || undefined,
          status: form.status,
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
        <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} aria-label="input"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Short Description</label>
        <input value={form.shortDescription} onChange={e => set("shortDescription", e.target.value)} className={inputCls} aria-label="input"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} aria-label="input"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls} aria-label="select">
          {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
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

// ── main page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "addTrack"; course: Course }
  | { type: "edit"; course: Course }
  | { type: "view"; course: Course }
  | { type: "delete"; course: Course };

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      const res = await fetch(`${BASE}admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load courses");
      // handle both { courses: [] } and [] shapes
      setCourses(Array.isArray(data) ? data : data.data ?? data.courses ?? []);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}admin/courses/${modal.course.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      setModal({ type: "none" });
      showToast(`Course "${modal.course.title}" deleted`);
      fetchCourses();
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
            <h1 className="text-2xl font-bold text-gray-900">Manage Courses</h1>
            <p className="text-sm text-gray-500 mt-0.5">Top-level containers for the SLAN curriculum</p>
          </div>
          <span className="text-sm text-gray-400">{courses.length} course{courses.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading courses…
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button onClick={fetchCourses}
                className="text-sm text-[#004900] underline">Retry</button>
            </div>
          )}

          {!loading && !fetchError && courses.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              No courses found.
            </div>
          )}

          {!loading && !fetchError && courses.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">ID</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course Name</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tracks</th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{course.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{course.title}</div>
                        {course.shortDescription && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                            {course.shortDescription}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={course.status} />
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {course.trackCount ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">

                          {/* Add Track */}
                          <button
                            onClick={() => setModal({ type: "addTrack", course })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#004900] text-white hover:bg-[#003700] transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Track
                          </button>

                          {/* View */}
                          <button
                            onClick={() => setModal({ type: "view", course })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: "edit", course })}
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
                            onClick={() => setModal({ type: "delete", course })}
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

      {/* ── Add Track Modal ── */}
      {modal.type === "addTrack" && (
        <Modal
          title={`Add Track to "${modal.course.title}"`}
          onClose={() => setModal({ type: "none" })}
        >
          <TrackCreate
            courseId={modal.course.id}
            onComplete={() => {
              setModal({ type: "none" });
              showToast("Track added successfully");
              fetchCourses();
            }}
            onCancel={() => setModal({ type: "none" })}
          />
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {modal.type === "edit" && (
        <Modal
          title={`Edit Course — ${modal.course.title}`}
          onClose={() => setModal({ type: "none" })}
        >
          <EditCourseForm
            course={modal.course}
            onDone={() => {
              setModal({ type: "none" });
              showToast("Course updated");
              fetchCourses();
            }}
          />
        </Modal>
      )}

      {/* ── View Modal ── */}
      {modal.type === "view" && (
        <Modal
          title={`Course Details`}
          onClose={() => setModal({ type: "none" })}
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">ID</p>
                <p className="font-mono font-medium text-gray-800">{modal.course.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <Badge status={modal.course.status} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Title</p>
              <p className="font-medium text-gray-800">{modal.course.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Short Description</p>
              <p className="text-gray-700">{modal.course.shortDescription || "—"}</p>
            </div>
            {modal.course.thumbnail && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Thumbnail</p>
                <img src={modal.course.thumbnail} alt="thumbnail"
                  className="w-full max-w-xs rounded-xl object-cover border border-gray-100" />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.course.title}"? This will cascade and remove all its tracks, modules, and units.`}
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