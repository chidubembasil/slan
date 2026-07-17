import { useState, useEffect, useCallback, useRef } from "react";


const BASE = import.meta.env.VITE_BASE_URL;

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_API_SECRET_KEY;

// Generic Cloudinary upload (auto-detects resource type — used for images
// like track/module thumbnails). CSV/Excel assessment files go straight to
// the backend as multipart form-data (see AddAssessmentForm below).
async function uploadFileToCloudinary(file: File, folder: string = "curriculum"): Promise<string> {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary credentials missing");
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signatureString = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signatureHex);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url as string;
}

type TrackStatus = "draft" | "published" | "archived";

type Track = {
  id: number;
  title: string;
  shortDescription?: string;
  description?: string;
  status: TrackStatus;
  isFree: boolean;
  thumbnail?: string;
  courseId: number;
  course?: { id: number; title: string };
};

// Minimal shape for the course filter dropdown.
type CourseOption = { id: number; title: string };

// Backend field for module thumbnails is `thumbnail` (confirmed via Swagger
// docs), kept alongside `thumbnailUrl` for backward compatibility.
// type ModuleThumbFields = { thumbnail?: string; thumbnailUrl?: string };
// const getModuleThumbnail = (m: ModuleThumbFields) => m.thumbnail || m.thumbnailUrl || "";

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

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto`}>
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
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

// ── Actions dropdown ────────────────────────────────────────────────────────

function ActionsMenu({
  items,
}: {
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        aria-label="More actions"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={`w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-gray-50 ${item.danger ? "text-red-600" : "text-gray-700"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

// ── Edit Track Form ───────────────────────────────────────────────────────────

function EditTrackForm({ track, onDone }: { track: Track; onDone: () => void }) {
  const [form, setForm] = useState({
    title: track.title,
    shortDescription: track.shortDescription ?? "",
    description: track.description ?? "",
    status: track.status,
    isFree: track.isFree,
    thumbnail: track.thumbnail ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(track.thumbnail || "");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(true);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // The `track` prop comes from the tracks list endpoint (admin/tracks),
  // which may only return a summary shape and can be missing fields like
  // `description`/`thumbnail`. Fetch the single-track endpoint here so the
  // edit form always reflects the real saved values instead of showing
  // blank fields the list response didn't include.
  useEffect(() => {
    let cancelled = false;

    const fetchFullTrack = async () => {
      setFetchingDetails(true);
      const token = localStorage.getItem("adminAccessToken");
      try {
        const res = await fetch(`${BASE}admin/tracks/${track.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load track details");
        const full = data?.data ?? data?.track ?? data;
        if (cancelled || !full) return;

        setForm({
          title: full.title ?? track.title,
          shortDescription: full.shortDescription ?? track.shortDescription ?? "",
          description: full.description ?? track.description ?? "",
          status: full.status ?? track.status,
          isFree: full.isFree ?? track.isFree,
          thumbnail: full.thumbnail ?? track.thumbnail ?? "",
        });
        setThumbnailPreview(full.thumbnail ?? track.thumbnail ?? "");
      } catch {
        // If the detail fetch fails, silently keep whatever (possibly
        // partial) data we already have from the list — don't block
        // editing over a failed background fetch.
      } finally {
        if (!cancelled) setFetchingDetails(false);
      }
    };

    fetchFullTrack();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }

    let thumbnailUrl = form.thumbnail;
    if (thumbnailFile) {
      setUploadingThumb(true);
      try {
        thumbnailUrl = await uploadFileToCloudinary(thumbnailFile, "curriculum");
      } catch (err: any) {
        setError(err.message || "Thumbnail upload failed");
        setUploadingThumb(false);
        return;
      }
      setUploadingThumb(false);
    }

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
          thumbnail: thumbnailUrl || undefined,
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
      {fetchingDetails && (
        <div className="text-xs text-gray-400 -mt-1 mb-1">Loading current values…</div>
      )}

      {/* Thumbnail Upload */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Thumbnail</label>
        <div className="flex items-center gap-4">
          {thumbnailPreview && (
            <img src={thumbnailPreview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          )}
          <div className="flex-1">
            <button
              onClick={() => thumbInputRef.current?.click()}
              disabled={uploadingThumb}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploadingThumb ? "Uploading…" : thumbnailPreview ? "Change Image" : "Upload Image"}
            </button>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailSelect}
              title="input"
            />
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP. Max 5MB.</p>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} title="input"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Short Description</label>
        <input value={form.shortDescription} onChange={e => set("shortDescription", e.target.value)} className={inputCls} title="input"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} title="textarea"/>
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
        <button onClick={handleSave} disabled={loading || uploadingThumb}
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
  content: string;
  estimatedReadMinutes: number;
  status: "draft" | "published" | "archived";
};

function AddModuleForm({ trackId, onDone, onCancel }: {
  trackId: number; onDone: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<ModuleForm>({
    title: "",
    description: "",
    content: "",
    estimatedReadMinutes: 0,
    status: "draft",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ModuleForm, string>>>({});

  const set = (k: keyof ModuleForm, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e: Partial<Record<keyof ModuleForm, string>> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setError("");
    if (!validate()) return;
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }

    let thumbnailUrl = "";
    if (thumbnailFile) {
      setUploadingThumb(true);
      try {
        thumbnailUrl = await uploadFileToCloudinary(thumbnailFile, "thumbnails");
      } catch (err: any) {
        setError(err.message || "Thumbnail upload failed");
        setUploadingThumb(false);
        return;
      }
      setUploadingThumb(false);
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/tracks/${trackId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content: form.content || undefined,
          estimatedReadMinutes: form.estimatedReadMinutes,
          status: form.status,
          // Backend field is `thumbnail`, not `thumbnailUrl` (per Swagger docs).
          thumbnail: thumbnailUrl || undefined,
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
      {/* Thumbnail Upload */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Thumbnail</label>
        <div className="flex items-center gap-4">
          {thumbnailPreview && (
            <img src={thumbnailPreview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          )}
          <div className="flex-1">
            <button
              type="button"
              onClick={() => thumbInputRef.current?.click()}
              disabled={uploadingThumb}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploadingThumb ? "Uploading…" : thumbnailPreview ? "Change Image" : "Upload Image"}
            </button>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailSelect}
              title="input"
            />
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input value={form.title} onChange={e => set("title", e.target.value)}
          className={inputCls} placeholder="e.g. Introduction to Leadership" />
        {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Content</label>
        <textarea rows={4} value={form.content} onChange={e => set("content", e.target.value)}
          className={textareaCls} placeholder="Module content (optional)" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Est. Read (mins)</label>
          <input type="number" min={0} value={form.estimatedReadMinutes}
            onChange={e => set("estimatedReadMinutes", Number(e.target.value))} className={inputCls} title="input"/>
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
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSubmit} disabled={loading || uploadingThumb}
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

// ── Assessment Form types & helpers (MCQ only) ────────────────────────────────

type SingleQuestion = {
  questionText: string;
  options: { id: string; text: string }[];
  correctAnswer: string; // option id
  explanation: string;
  orderIndex: number;
  points: number;
};

const emptyQuestion = (orderIndex = 0): SingleQuestion => ({
  questionText: "",
  options: [
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ],
  correctAnswer: "",
  explanation: "",
  orderIndex,
  points: 1,
});

function buildOptionsAndAnswer(q: SingleQuestion): {
  options: string[];
  correctAnswer: number;
} {
  const filledOptions = q.options.filter((o) => o.text.trim());
  const correctIndex = filledOptions.findIndex((o) => o.id === q.correctAnswer);
  return {
    options: filledOptions.map((o) => o.text),
    correctAnswer: correctIndex >= 0 ? correctIndex : 0,
  };
}

function validateQuestions(qs: SingleQuestion[]): string {
  for (const q of qs) {
    if (!q.questionText.trim()) return "Every question needs question text";
    const filled = q.options.filter((o) => o.text.trim());
    if (filled.length < 2) return "Every question needs at least 2 options";
    if (!q.correctAnswer) return "Every question needs a correct answer selected";
  }
  return "";
}

// ── Question Editor (MCQ only) ─────────────────────────────────────────────────

function QuestionEditor({
  q,
  index,
  onChange,
  onRemove,
  showRemove,
}: {
  q: SingleQuestion;
  index: number;
  onChange: (q: SingleQuestion) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const set = (k: keyof SingleQuestion, v: any) => onChange({ ...q, [k]: v });
  const setOption = (i: number, text: string) => {
    const opts = [...q.options];
    opts[i] = { ...opts[i], text };
    onChange({ ...q, options: opts });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Question {index + 1} <span className="text-gray-300 normal-case font-normal">· Multiple Choice</span>
        </span>
        {showRemove && (
          <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 font-medium">
            Remove
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Question Text <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={2}
          value={q.questionText}
          onChange={e => set("questionText", e.target.value)}
          className={textareaCls}
          placeholder="Enter question..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Options</label>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-gray-400 w-4">
                {opt.id.toUpperCase()}
              </span>
              <input
                value={opt.text}
                onChange={e => setOption(i, e.target.value)}
                placeholder={`Option ${opt.id.toUpperCase()}`}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Correct Answer <span className="text-red-500">*</span>
          </label>
          <select
            value={q.correctAnswer}
            onChange={e => set("correctAnswer", e.target.value)}
            className={inputCls}
            title="select"
          >
            <option value="">Select option…</option>
            {q.options.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.id.toUpperCase()} — {opt.text || "(empty)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Points</label>
          <input
            type="number" min={1}
            value={q.points}
            onChange={e => set("points", Number(e.target.value))}
            className={inputCls}
            title="input"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Explanation <span className="text-gray-400">(optional)</span>
        </label>
        <input
          value={q.explanation}
          onChange={e => set("explanation", e.target.value)}
          className={inputCls}
          placeholder="Why this is the correct answer"
        />
      </div>
    </div>
  );
}

// ── Add Assessment Form (Track) ───────────────────────────────────────────────
// Track assessments only support the "multiple questions" flow — no single
// question — and Step 2 offers two ways to submit questions:
//   • MCQ  → build questions in the UI, submits via POST /admin/assessment-items/bulk
//   • CSV  → upload a .csv/.xlsx file directly, submits via
//            POST /admin/assessment-items/bulk-upload (multipart/form-data)

type AssessmentStep = 1 | 2;
type QuestionInputMode = "mcq" | "csv";

function AddAssessmentForm({
  track,
  onDone,
  onCancel,
}: {
  track: Track;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<AssessmentStep>(1);

  // Step 1 — config
  const [config, setConfig] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 30,
    isActive: false,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  // Step 2 — question input mode toggle
  const [inputMode, setInputMode] = useState<QuestionInputMode>("mcq");

  // Step 2a — MCQ (manual) questions
  const [questions, setQuestions] = useState<SingleQuestion[]>([emptyQuestion(0)]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState("");

  // Step 2b — CSV/Excel bulk upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  const setC = (k: keyof typeof config, v: any) =>
    setConfig(f => ({ ...f, [k]: v }));

  // ── Step 1: save track assessment config ────────────────────────────────────
  const handleSaveConfig = async () => {
    const errs: Record<string, string> = {};
    if (!config.title.trim()) errs.title = "Title is required";
    if (!config.description.trim()) errs.description = "Description is required";
    setConfigErrors(errs);
    if (Object.keys(errs).length) return;

    setConfigError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setConfigError("Not authenticated"); return; }
    setConfigLoading(true);

    try {
      const res = await fetch(`${BASE}admin/tracks/${track.id}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: config.title,
          description: config.description,
          passMarkPercent: config.passMarkPercent,
          maxAttempts: config.maxAttempts,
          timeLimitMinutes: config.timeLimitMinutes,
          isActive: config.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create assessment config");
      const id =
        data?.data?.id ?? data?.id ?? data?.assessment?.id ?? data?.data?.assessmentId ?? null;
      setAssessmentId(id);
      setStep(2);
    } catch (err: any) {
      setConfigError(err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  // ── Step 2a: submit MCQ questions — POST /admin/assessment-items/bulk ───────
  const handleSubmitQuestions = async () => {
    setQError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setQError("Not authenticated"); return; }

    const validationError = validateQuestions(questions);
    if (validationError) { setQError(validationError); return; }

    setQLoading(true);
    try {
      const res = await fetch(`${BASE}admin/assessment-items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          parentId: assessmentId,
          parentType: "track_assessment",
          questions: questions.map(q => {
            const { options, correctAnswer } = buildOptionsAndAnswer(q);
            return {
              questionText: q.questionText,
              questionType: "multiple_choice",
              options,
              correctAnswer,
              explanation: q.explanation || undefined,
              orderIndex: q.orderIndex,
              points: q.points,
            };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Bulk submit failed");
      onDone();
    } catch (err: any) {
      setQError(err.message);
    } finally {
      setQLoading(false);
    }
  };

  // ── Step 2b: submit CSV/Excel file — POST /admin/assessment-items/bulk-upload ──
  // Required columns: question_text, question_type, correct_answer
  // Optional columns: option_a, option_b, option_c, option_d, explanation
  // question_type: multiple_choice | true_false
  // correct_answer (multiple_choice): 1-based option number (1 = option_a, 2 = option_b, ...)
  // correct_answer (true_false): True/False (or legacy 1=True/0/2=False)
  // parentId and parentType are sent as form fields alongside the file.
  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    setCsvFile(file);
  };

  const handleCsvSubmit = async () => {
    setCsvError("");
    if (!csvFile) { setCsvError("Please select a CSV or Excel file"); return; }
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setCsvError("Not authenticated"); return; }
    if (!assessmentId) { setCsvError("Missing assessment id — go back and try again"); return; }

    setCsvLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("parentId", String(assessmentId));
      formData.append("parentType", "track_assessment");

      const res = await fetch(`${BASE}admin/assessment-items/bulk-upload`, {
        method: "POST",
        // No Content-Type header — the browser sets the multipart boundary.
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "CSV upload failed");
      onDone();
    } catch (err: any) {
      setCsvError(err.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const addQuestion = () =>
    setQuestions(qs => [...qs, emptyQuestion(qs.length)]);
  const removeQuestion = (i: number) =>
    setQuestions(qs => qs.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, q: SingleQuestion) =>
    setQuestions(qs => qs.map((old, idx) => (idx === i ? q : old)));

  return (
    <div className="space-y-5">

      {/* Step tabs */}
      <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => step === 2 && setStep(1)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            step === 1
              ? "bg-[#004900] text-white"
              : "bg-white text-gray-400 hover:bg-gray-50 cursor-pointer"
          }`}
        >
          1 · Assessment Details
        </button>
        <button
          disabled={!assessmentId}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            step === 2
              ? "bg-[#004900] text-white"
              : "bg-white text-gray-400"
          } disabled:cursor-not-allowed`}
        >
          2 · Questions
        </button>
      </div>

      {/* ── STEP 1: Config ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={config.title}
              onChange={e => setC("title", e.target.value)}
              placeholder="e.g. Track Final Assessment"
              className={inputCls}
            />
            {configErrors.title && (
              <p className="text-xs text-red-600 mt-1">{configErrors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={config.description}
              onChange={e => setC("description", e.target.value)}
              placeholder="What this assessment covers"
              className={textareaCls}
            />
            {configErrors.description && (
              <p className="text-xs text-red-600 mt-1">{configErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Pass Mark (%)</label>
              <input
                type="number" min={0} max={100}
                value={config.passMarkPercent}
                onChange={e => setC("passMarkPercent", Number(e.target.value))}
                className={inputCls}
                placeholder="70"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Max Attempts</label>
              <input
                type="number" min={1}
                value={config.maxAttempts}
                onChange={e => setC("maxAttempts", Number(e.target.value))}
                className={inputCls}
                placeholder="2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Time Limit (mins)</label>
              <input
                type="number" min={0}
                value={config.timeLimitMinutes}
                onChange={e => setC("timeLimitMinutes", Number(e.target.value))}
                className={inputCls}
                placeholder="0 = unlimited"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.isActive}
              onChange={e => setC("isActive", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#004900]"
            />
            <span className="text-sm text-gray-700">Active immediately</span>
          </label>

          {configError && <p className="text-xs text-red-600">{configError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={configLoading}
              className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60 flex items-center gap-2"
            >
              {configLoading ? "Saving…" : "Save & Add Questions →"}
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Questions (MCQ builder or CSV upload) ── */}
      {step === 2 && (
        <div className="space-y-5">

          {/* Input mode toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Add questions via</label>
            <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden w-full sm:w-72">
              <button
                onClick={() => setInputMode("mcq")}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  inputMode === "mcq"
                    ? "bg-[#004900] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                MCQ Builder
              </button>
              <button
                onClick={() => setInputMode("csv")}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  inputMode === "csv"
                    ? "bg-[#004900] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                CSV / Excel Upload
              </button>
            </div>
          </div>

          {/* ── MCQ builder ── */}
          {inputMode === "mcq" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#004900]/5 border border-[#004900]/20 rounded-lg">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004900" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
                <p className="text-xs text-[#004900] font-medium">
                  Build questions here — submitted as a batch of multiple-choice questions.
                </p>
              </div>

              <div className="space-y-4">
                {questions.map((q, i) => (
                  <QuestionEditor
                    key={i}
                    q={q}
                    index={i}
                    onChange={updated => updateQuestion(i, updated)}
                    onRemove={() => removeQuestion(i)}
                    showRemove={questions.length > 1}
                  />
                ))}
                <button
                  onClick={addQuestion}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-medium text-gray-400 hover:border-[#004900]/40 hover:text-[#004900] transition-colors"
                >
                  + Add Another Question
                </button>
              </div>

              {qError && <p className="text-xs text-red-600">{qError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmitQuestions}
                  disabled={qLoading}
                  className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
                >
                  {qLoading
                    ? "Submitting…"
                    : `Save ${questions.length} Question${questions.length !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={onCancel}
                  className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── CSV / Excel upload ── */}
          {inputMode === "csv" && (
            <div className="space-y-5">
              <div className="px-3.5 py-3 bg-purple-50 border border-purple-200 rounded-lg space-y-1.5">
                <p className="text-xs text-purple-800 font-medium">
                  Upload a .csv or .xlsx file. Each row is one question. Max 5MB.
                </p>
                <p className="text-xs text-purple-700">
                  <span className="font-semibold">Required columns:</span> question_text, question_type, correct_answer
                </p>
                <p className="text-xs text-purple-700">
                  <span className="font-semibold">Optional columns:</span> option_a, option_b, option_c, option_d, explanation
                </p>
                <p className="text-xs text-purple-700">
                  <span className="font-semibold">question_type:</span> multiple_choice or true_false
                </p>
                <p className="text-xs text-purple-700">
                  <span className="font-semibold">correct_answer:</span> for multiple_choice, a 1-based option number (1 = option_a, 2 = option_b, …). For true_false, True/False.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  File <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    disabled={csvLoading}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {csvFile ? "Change File" : "Choose File"}
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleCsvFileSelect}
                    title="csv-file-input"
                  />
                  {csvFile && (
                    <span className="text-xs text-gray-600 truncate max-w-xs">{csvFile.name}</span>
                  )}
                </div>
              </div>

              {csvError && <p className="text-xs text-red-600">{csvError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCsvSubmit}
                  disabled={csvLoading || !csvFile}
                  className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
                >
                  {csvLoading ? "Uploading…" : "Upload & Save Questions"}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={onCancel}
                  className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "edit"; track: Track }
  | { type: "delete"; track: Track }
  | { type: "addModule"; track: Track }
  | { type: "addAssessment"; track: Track };

export default function ManageTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "all">("all");
  const [selectedTrackId, setSelectedTrackId] = useState<number | "all">("all");
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
      setTracks(Array.isArray(data) ? data : data.data ?? data.tracks ?? []);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Populates the course filter dropdown. Kept as a separate fetch (rather
  // than deriving from `tracks`) so every course shows up in the filter even
  // if it doesn't have any tracks yet.
  const fetchCourses = useCallback(async () => {
    const token = localStorage.getItem("adminAccessToken");
    try {
      const res = await fetch(`${BASE}admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load courses");
      const list: CourseOption[] = Array.isArray(data) ? data : data.data ?? data.courses ?? [];
      setCourses(list);
    } catch {
      // Non-fatal — the course filter simply won't populate if this fails;
      // the tracks table itself doesn't depend on it.
    }
  }, []);

  useEffect(() => { fetchTracks(); fetchCourses(); }, [fetchTracks, fetchCourses]);

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

  // Tracks belonging to the currently selected course (or all tracks, if
  // "all" is selected) — this is what populates the track filter's options.
  const tracksInSelectedCourse = selectedCourseId === "all"
    ? tracks
    : tracks.filter((t) => t.courseId === selectedCourseId || t.course?.id === selectedCourseId);

  const filteredTracks = selectedTrackId === "all"
    ? tracksInSelectedCourse
    : tracksInSelectedCourse.filter((t) => t.id === selectedTrackId);

  const handleCourseFilterChange = (value: string) => {
    setSelectedCourseId(value === "all" ? "all" : Number(value));
    // Changing the course invalidates whatever track was previously
    // selected, since it may not belong to the new course.
    setSelectedTrackId("all");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Tracks</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tracks belong to courses and group related modules</p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && !fetchError && courses.length > 0 && (
              <select
                value={selectedCourseId}
                onChange={(e) => handleCourseFilterChange(e.target.value)}
                className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
                aria-label="Filter by course"
              >
                <option value="all">All courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
            {!loading && !fetchError && tracksInSelectedCourse.length > 0 && (
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
                aria-label="Filter by track"
              >
                <option value="all">All tracks</option>
                {tracksInSelectedCourse.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {filteredTracks.length} track{filteredTracks.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

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

          {!loading && !fetchError && filteredTracks.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              {tracks.length === 0 ? "No tracks found." : "No tracks match this selection."}
            </div>
          )}

          {!loading && !fetchError && filteredTracks.length > 0 && (
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
                  {filteredTracks.map((track) => (
                    <tr key={track.id} className="hover:bg-gray-50/60 transition-colors">

                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{track.id}</td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                            {track.thumbnail ? (
                              <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="M21 15l-5-5L5 21" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{track.title}</div>
                            {track.shortDescription && (
                              <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                                {track.shortDescription}
                              </div>
                            )}
                          </div>
                        </div>
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
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Module
                          </button>

                          {/* Add Assessment */}
                          <button
                            onClick={() => setModal({ type: "addAssessment", track })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                              <rect x="9" y="3" width="6" height="4" rx="1" />
                              <line x1="9" y1="12" x2="15" y2="12" />
                              <line x1="9" y1="16" x2="13" y2="16" />
                            </svg>
                            Add Assessment
                          </button>

                          {/* Overflow menu */}
                          <ActionsMenu
                            items={[
                              { label: "Edit Track", onClick: () => setModal({ type: "edit", track }) },
                              { label: "Delete Track", onClick: () => setModal({ type: "delete", track }), danger: true },
                            ]}
                          />
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
              showToast("Module created successfully");
            }}
            onCancel={() => setModal({ type: "none" })}
          />
        </Modal>
      )}

      {/* ── Add Assessment Modal ── */}
      {modal.type === "addAssessment" && (
        <Modal
          title={`Add Assessment to "${modal.track.title}"`}
          onClose={() => setModal({ type: "none" })}
          wide
        >
          <AddAssessmentForm
            track={modal.track}
            onDone={() => {
              setModal({ type: "none" });
              showToast("Assessment and questions saved successfully");
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