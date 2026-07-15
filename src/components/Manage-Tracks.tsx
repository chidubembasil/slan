import { useState, useEffect, useCallback, useRef } from "react";


const BASE = import.meta.env.VITE_BASE_URL;

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_API_SECRET_KEY;

// Generic Cloudinary upload (auto-detects resource type — used for images
// like track/module thumbnails). CSV/Excel assessment files no longer go
// through Cloudinary — they're posted straight to the backend as multipart
// form-data, matching what the backend's /assessment-items/bulk-upload
// endpoint actually expects (see AddAssessmentForm below).
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
          thumbnailUrl: thumbnailUrl || undefined,
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

// ── Assessment Form types & helpers ───────────────────────────────────────────

type QuestionMode = "single" | "bulk" | "file";

type SingleQuestion = {
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  orderIndex: number;
  points: number;
};

const emptyQuestion = (orderIndex = 0): SingleQuestion => ({
  questionText: "",
  questionType: "multiple_choice",
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
// ── Payload helper ─────────────────────────────────────────────────────────
// Converts the UI's {id, text}[] option shape + letter-based correctAnswer
// into what the API expects: options as string[], correctAnswer as a
// 0-based index (for multiple_choice). true_false / short_answer pass through.
function buildOptionsAndAnswer(q: SingleQuestion): {
  options: string[] | undefined;
  correctAnswer: number;
} {
  if (q.questionType === "multiple_choice") {
    const filledOptions = q.options.filter((o) => o.text.trim());

    const correctIndex = filledOptions.findIndex(
      (o) => o.id === q.correctAnswer
    );

    return {
      options: filledOptions.map((o) => o.text),
      correctAnswer: correctIndex >= 0 ? correctIndex : 0,
    };
  }

  if (q.questionType === "true_false") {
    return {
      options: undefined,
      correctAnswer: q.correctAnswer === "true" ? 1 : 0,
    };
  }

  // Short Answer
  return {
    options: [q.correctAnswer],
    correctAnswer: 0,
  };
}

// ── Question Editor ───────────────────────────────────────────────────────────

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
          Question {index + 1}
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            value={q.questionType}
            onChange={e => set("questionType", e.target.value)}
            className={inputCls}
            title="select"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
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

      {q.questionType === "multiple_choice" && (
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
      )}

      {q.questionType === "true_false" && (
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
            <option value="">Select…</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      )}

      {q.questionType === "multiple_choice" && (
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
      )}

      {q.questionType === "short_answer" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Correct Answer <span className="text-red-500">*</span>
          </label>
          <input
            value={q.correctAnswer}
            onChange={e => set("correctAnswer", e.target.value)}
            className={inputCls}
            placeholder="Expected answer"
          />
        </div>
      )}

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

type AssessmentStep = 1 | 2;

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
    timeLimitMinutes: 30,
    isActive: false,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  // Step 2 — questions
  const [mode, setMode] = useState<QuestionMode>("single");
  const [questions, setQuestions] = useState<SingleQuestion[]>([emptyQuestion(0)]);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState("");

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

  // ── Step 2: submit questions ─────────────────────────────────────────────────
  const handleSubmitQuestions = async () => {
    setQError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setQError("Not authenticated"); return; }

    const parentId = assessmentId;
    const parentType = "track_assessment";

    setQLoading(true);
    try {
      if (mode === "single") {
        const q = questions[0];
        const { options, correctAnswer } = buildOptionsAndAnswer(q);
        const res = await fetch(`${BASE}admin/assessment-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            parentId,
            parentType,
            questionText: q.questionText,
            questionType: q.questionType,
            options,
            correctAnswer,
            explanation: q.explanation || undefined,
            orderIndex: q.orderIndex,
            points: q.points,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Failed to add question");

      } else if (mode === "bulk") {
        // The /bulk endpoint's backend validator only accepts a *numeric*
        // correctAnswer for every item in the batch. That's correct for
        // multiple_choice, but wrong for short_answer / true_false, which
        // need a string ("true"/"false" or free text). Sending a mixed
        // batch straight to /bulk trips that validator and the whole
        // request fails with a "Validation error" — even for questions
        // that were valid on their own.
        //
        // To make mixed-type batches actually work, we don't use /bulk at
        // all here. Every question — regardless of type — is submitted
        // one at a time through the single-item endpoint
        // (POST /admin/assessment-items), which already accepts both
        // numeric and string correctAnswer values correctly.
        for (const q of questions) {
          const { options, correctAnswer } = buildOptionsAndAnswer(q);
          const res = await fetch(`${BASE}admin/assessment-items`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            credentials: "include",
            body: JSON.stringify({
              parentId,
              parentType,
              questionText: q.questionText,
              questionType: q.questionType,
              options,
              correctAnswer,
              explanation: q.explanation || undefined,
              orderIndex: q.orderIndex,
              points: q.points,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(
              data.message || data.error || `Failed to add question: "${q.questionText.slice(0, 40)}"`
            );
          }
        }

      } else if (mode === "file") {
        // File upload → sent directly to the backend as multipart form-data,
        // matching the working Module-assessment implementation. (Previously
        // this uploaded to Cloudinary first and posted a JSON { fileUrl }
        // payload, which the backend's bulk-upload endpoint rejected with a
        // 400 "File processing failed" — it expects the actual file.)
        if (!fileRef) { setQError("Please select a CSV or Excel file"); setQLoading(false); return; }

        const formData = new FormData();
        formData.append("file", fileRef);
        formData.append("parentId", String(parentId));
        formData.append("parentType", parentType);

        const res = await fetch(`${BASE}admin/assessment-items/bulk-upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "File processing failed");
      }

      onDone();
    } catch (err: any) {
      setQError(err.message);
    } finally {
      setQLoading(false);
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

      {/* ── STEP 2: Questions ── */}
      {step === 2 && (
        <div className="space-y-5">

          {/* Mode selector */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">
              How do you want to add questions?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["single", "bulk", "file"] as QuestionMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    if (m !== "file") setQuestions([emptyQuestion(0)]);
                    setFileRef(null);
                    setQError("");
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                    mode === m
                      ? "border-[#004900] bg-[#004900]/5 text-[#004900]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {m === "single" && "Single  Choice"}
                  {m === "bulk" && "Multiple  Choices"}
                  {m === "file" && "Upload File (CSV/Excel)"}
                </button>
              ))}
            </div>
          </div>

          {/* Single / Bulk — question editors */}
          {(mode === "single" || mode === "bulk") && (
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
              {mode === "bulk" && (
                <button
                  onClick={addQuestion}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-medium text-gray-400 hover:border-[#004900]/40 hover:text-[#004900] transition-colors"
                >
                  + Add Another Question
                </button>
              )}
            </div>
          )}

          {/* File upload mode — direct multipart to backend */}
          {mode === "file" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-[#004900]/30 transition-colors">
                <svg
                  className="mx-auto mb-3 text-gray-300"
                  width="40" height="40"
                  viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <polyline points="9 14 12 11 15 14" />
                </svg>
                <p className="text-sm text-gray-500 mb-1">
                  {fileRef ? fileRef.name : "Drop a CSV or Excel file here, or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mb-3">Max 5 MB · .csv, .xlsx</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#004900] text-white hover:bg-[#003700]"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => setFileRef(e.target.files?.[0] ?? null)}
                  title="input"
                />
              </div>

              {/* Column reference */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["question_text", "question_type", "correct_answer"].map(col => (
                    <code key={col} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                      {col}
                    </code>
                  ))}
                </div>
                <p className="text-xs font-semibold text-blue-700 mt-2.5 mb-1.5">Optional columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["option_a", "option_b", "option_c", "option_d", "explanation", "points"].map(col => (
                    <code key={col} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                      {col}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2 leading-relaxed">
                  <strong>question_type</strong>: multiple_choice, true_false, short_answer
                  <br />
                  <strong>correct_answer</strong>: a / b / c / d for MCQ; true / false for true_false
                </p>
              </div>
            </div>
          )}

          {qError && <p className="text-xs text-red-600">{qError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmitQuestions}
              disabled={qLoading}
              className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
            >
              {qLoading
                ? "Submitting…"
                : mode === "file"
                ? "Upload & Save"
                : mode === "bulk"
                ? `Save ${questions.length} Question${questions.length !== 1 ? "s" : ""}`
                : "Save Question"}
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

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Tracks</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tracks belong to courses and group related modules</p>
          </div>
          <span className="text-sm text-gray-400">
            {tracks.length} track{tracks.length !== 1 ? "s" : ""}
          </span>
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
                        <div className="flex items-center gap-3">
                          {track.thumbnail && (
                            <img src={track.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          )}
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
                        <div className="flex items-center justify-end gap-2 flex-wrap">

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