import { useState, useEffect, useCallback } from "react";
import CourseCreate from "../components/Upload-Course";
import TrackCreate from "../components/TrackCreate";

const BASE = import.meta.env.VITE_BASE_URL;

type CourseStatus = "draft" | "published" | "archived";

type Course = {
  id: number;
  title: string;
  shortDescription: string;
  description?: string;
  status: CourseStatus;
  thumbnail?: string;
  trackCount?: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <p className="text-sm text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Course Form ───────────────────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

function EditCourseForm({ course, onDone }: { course: Course; onDone: () => void }) {
  const [form, setForm] = useState({
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description || "",
    status: course.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const token = localStorage.getItem("adminAccessToken");
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError("");
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Short Description</label>
        <input
          value={form.shortDescription}
          onChange={(e) => set("shortDescription", e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={textareaCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className={inputCls}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-[#004900] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
type ModalState =
  | { type: "none" }
  | { type: "createCourse" }
  | { type: "edit"; course: Course }
  | { type: "view"; course: Course }
  | { type: "delete"; course: Course }
  | { type: "addTrack"; course: Course };

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
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

      setCourses(Array.isArray(data) ? data : data.courses ?? []);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Delete failed");
      }

      setModal({ type: "none" });
      showToast(`Course "${modal.course.title}" deleted successfully`);
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
            <p className="text-sm text-gray-500">Top-level containers for the SLAN curriculum</p>
          </div>
          <button
            onClick={() => setModal({ type: "createCourse" })}
            className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700]"
          >
            + New Course
          </button>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400">Loading courses...</div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-red-600">{fetchError}</p>
              <button onClick={fetchCourses} className="text-[#004900] underline text-sm">
                Retry
              </button>
            </div>
          )}

          {!loading && !fetchError && courses.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              No courses found.
            </div>
          )}

          {!loading && !fetchError && courses.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase">ID</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase">Course</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase">Tracks</th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-gray-400">{course.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{course.title}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{course.shortDescription}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={course.status} />
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {course.trackCount ?? 0}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setModal({ type: "addTrack", course })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#004900] text-white text-xs font-medium rounded-lg hover:bg-[#003700]"
                          >
                            + Track
                          </button>
                          <button
                            onClick={() => setModal({ type: "view", course })}
                            className="px-3 py-1.5 border border-gray-300 text-xs rounded-lg hover:bg-gray-50"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setModal({ type: "edit", course })}
                            className="px-3 py-1.5 border border-blue-200 text-blue-600 text-xs rounded-lg hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setModal({ type: "delete", course })}
                            className="px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50"
                          >
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

      {/* Create Course Modal */}
      {modal.type === "createCourse" && (
        <Modal title="Create New Course" onClose={() => setModal({ type: "none" })}>
          <CourseCreate
            onComplete={() => {
              setModal({ type: "none" });
              showToast("Course created successfully");
              fetchCourses();
            }}
          />
        </Modal>
      )}

      {/* Add Track Modal */}
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
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {modal.type === "edit" && (
        <Modal title={`Edit Course — ${modal.course.title}`} onClose={() => setModal({ type: "none" })}>
          <EditCourseForm
            course={modal.course}
            onDone={() => {
              setModal({ type: "none" });
              showToast("Course updated successfully");
              fetchCourses();
            }}
          />
        </Modal>
      )}

      {/* View Modal */}
      {modal.type === "view" && (
        <Modal title="Course Details" onClose={() => setModal({ type: "none" })}>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">ID</p>
                <p className="font-mono font-medium">{modal.course.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <Badge status={modal.course.status} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Title</p>
              <p className="font-medium">{modal.course.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Short Description</p>
              <p className="text-gray-700">{modal.course.shortDescription || "—"}</p>
            </div>
            {modal.course.thumbnail && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Thumbnail</p>
                <img
                  src={modal.course.thumbnail}
                  alt="thumbnail"
                  className="w-full max-w-xs rounded-xl object-cover border border-gray-100"
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.course.title}"? This action cannot be undone and will delete all associated tracks, modules, and units.`}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: "none" })}
          loading={deleting}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#004900] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}