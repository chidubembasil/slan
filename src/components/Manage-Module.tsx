import { useState, useEffect, useCallback, useRef } from "react";
import { RichTextEditor } from "./RichTextEditor"

const BASE = import.meta.env.VITE_BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type ModuleStatus = "draft" | "published" | "archived";
type Track = { id: number; title: string };

type Module = {
  id: number;
  title: string;
  description?: string;
  shortDescription?: string;
  status: ModuleStatus;
  estimatedReadMinutes?: number;
  trackId: number;
  track?: { id: number; title: string };
  // Backend field is actually `thumbnail` (confirmed via the Swagger docs for
  // PUT /admin/modules/{id}) — `thumbnailUrl` is kept as a fallback in case
  // any older records/endpoints still use it.
  thumbnail?: string;
  thumbnailUrl?: string;
};

// Single place that decides which field to read the module thumbnail from.
const getModuleThumbnail = (m: Pick<Module, "thumbnail" | "thumbnailUrl">) =>
  m.thumbnail || m.thumbnailUrl || "";

type UnitForm = {
  moduleId: string;
  title: string;
  description: string;
  content: string;
  summary: string;
  caseStudy: string;
  discussionPrompt: string;
  videoUrl: string;
  pdfUrl: string;
  estimatedReadMinutes: string;
  status: "draft" | "published" | "archived";
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

// ── Badge ─────────────────────────────────────────────────────────────────────

const statusBadge: Record<ModuleStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: ModuleStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[status]}`}>
      {status}
    </span>
  );
}

// ── Modal Shell ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-3xl"} max-h-[90vh] overflow-y-auto`}>
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Full Screen Modal Shell ────────────────────────────────────────────────────
// Same visual language as `Modal`, but takes over the entire viewport
// (screen width + height) instead of a centered card. Used for content that
// benefits from more room, e.g. viewing a reflection plus its full list of
// learner responses.

function FullScreenModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="bg-[#004900] px-6 py-4 flex items-center justify-between shrink-0">
        <h2 className="text-white font-semibold text-base">{title}</h2>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmModal({
  message, onConfirm, onCancel, loading,
}: {
  message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Actions dropdown (keeps row-level buttons from getting crowded) ───────────

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
        <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
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

// ── Cloudinary Upload ─────────────────────────────────────────────────────────
// Shared by unit video/pdf uploads, the module thumbnail upload, AND the
// assessment CSV/Excel bulk-upload file below.

const uploadToCloudinary = async (file: File, folder: string = "curriculum"): Promise<string> => {
  const API_KEY = import.meta.env.VITE_API_KEY;
  const API_SECRET = import.meta.env.VITE_API_SECRET_KEY;
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!API_KEY || !API_SECRET || !CLOUD_NAME) throw new Error("Cloudinary credentials missing");

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signatureString = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
  const signature = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signatureHex);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
    method: "POST", body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
};

// ── Thumbnail Picker ──────────────────────────────────────────────────────────

function ThumbnailPicker({
  previewUrl,
  onFileSelected,
  uploading,
}: {
  previewUrl: string;
  onFileSelected: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
        {previewUrl ? (
          <img src={previewUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3.5 py-2 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : previewUrl ? "Change Image" : "Choose Image"}
        </button>
        <p className="text-xs text-gray-400 mt-1.5">PNG or JPG, up to 5MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          title="Upload thumbnail image"
        />
      </div>
    </div>
  );
}

// ── Edit Module Form ──────────────────────────────────────────────────────────

function EditModuleForm({ module, onDone }: { module: Module; onDone: () => void }) {
  const [form, setForm] = useState({
    title: module.title,
    description: module.description ?? "",
    shortDescription: module.shortDescription ?? "",
    estimatedReadMinutes: module.estimatedReadMinutes ?? 0,
    status: module.status,
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  // Tracks the actual persisted thumbnail URL (as opposed to `thumbnailPreview`,
  // which can also briefly hold a local blob: URL while previewing a newly
  // picked file). This is what we fall back to on save if no new file was chosen.
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string>(getModuleThumbnail(module));
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(getModuleThumbnail(module));
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(true);
  const [error, setError] = useState("");

  // The row-level `module` prop comes from the tracks/modules LIST endpoint,
  // which often returns a trimmed-down object (missing description,
  // shortDescription, estimatedReadMinutes, thumbnail). That's why the
  // form was opening with those fields blank even though the backend has
  // real values for them. Fetch the full module record on mount and hydrate
  // the form once it arrives, while still showing whatever we already have
  // immediately so the modal isn't empty while the request is in flight.
  useEffect(() => {
    let cancelled = false;
    const fetchDetails = async () => {
      const token = localStorage.getItem("adminAccessToken");
      try {
        const res = await fetch(`${BASE}admin/modules/${module.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load module details");
        const full: Module = data?.data ?? data?.module ?? data;
        if (cancelled) return;
        setForm({
          title: full.title ?? module.title,
          description: full.description ?? "",
          shortDescription: full.shortDescription ?? "",
          estimatedReadMinutes: full.estimatedReadMinutes ?? 0,
          status: full.status ?? module.status,
        });
        const thumb = getModuleThumbnail(full);
        setExistingThumbnailUrl(thumb);
        setThumbnailPreview(thumb);
      } catch {
        // Keep whatever we already had from the list row; don't block editing.
      } finally {
        if (!cancelled) setFetchingDetails(false);
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [module.id]);

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleThumbnailSelected = (file: File) => {
    setThumbnailFile(file);
    // Local preview via object URL — instant, no network round trip.
    const objectUrl = URL.createObjectURL(file);
    setThumbnailPreview(objectUrl);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setLoading(true);

    let finalThumbnailUrl = existingThumbnailUrl;
    try {
      if (thumbnailFile) {
        setUploadingThumbnail(true);
        finalThumbnailUrl = await uploadToCloudinary(thumbnailFile, "thumbnails");
        setUploadingThumbnail(false);
      }

      const res = await fetch(`${BASE}admin/modules/${module.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          shortDescription: form.shortDescription || undefined,
          estimatedReadMinutes: form.estimatedReadMinutes,
          status: form.status,
          // Backend field is `thumbnail` (see Swagger docs for this endpoint),
          // not `thumbnailUrl` — this was the reason thumbnails weren't saving.
          thumbnail: finalThumbnailUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      onDone();
    } catch (err: any) {
      setError(err.message || "Something went wrong while saving the thumbnail");
    } finally {
      setLoading(false);
      setUploadingThumbnail(false);
    }
  };

  return (
    <div className="space-y-4">
      {fetchingDetails && (
        <p className="text-xs text-gray-400">Loading full module details…</p>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Thumbnail</label>
        <ThumbnailPicker
          previewUrl={thumbnailPreview}
          onFileSelected={handleThumbnailSelected}
          uploading={uploadingThumbnail}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="Module title" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={inputCls} placeholder="One-line summary" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Content</label>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={textareaCls} placeholder="Full description" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Est. Read (mins)</label>
          <input type="number" min={0} value={form.estimatedReadMinutes} onChange={(e) => set("estimatedReadMinutes", Number(e.target.value))} className={inputCls} title="input"/>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
        <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls} aria-label="select">
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
          {loading ? (uploadingThumbnail ? "Uploading thumbnail…" : "Saving...") : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── UnitCreate rendered inside Modal ─────────────────────────────────────────

function UnitCreateModal({
  module,
  onDone,
  onCancel,
}: {
  module: Module;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UnitForm>({
    moduleId: String(module.id),
    title: "",
    description: "",
    content: "",
    summary: "",
    caseStudy: "",
    discussionPrompt: "",
    videoUrl: "",
    pdfUrl: "",
    estimatedReadMinutes: "0",
    status: "draft",
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors<UnitForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (key: keyof UnitForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<UnitForm> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.content.trim()) e.content = "Content is required";
    if (form.estimatedReadMinutes === "" || isNaN(Number(form.estimatedReadMinutes)))
      e.estimatedReadMinutes = "Must be a valid number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setSubmitError("No authentication token found. Please log in again."); return; }
    setLoading(true);
    let finalVideoUrl = form.videoUrl;
    let finalPdfUrl = form.pdfUrl;
    try {
      if (videoFile) finalVideoUrl = await uploadToCloudinary(videoFile, "videos");
      if (pdfFile) finalPdfUrl = await uploadToCloudinary(pdfFile, "pdfs");
      const res = await fetch(`${BASE}admin/modules/${module.id}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content: form.content || undefined,
          summary: form.summary || undefined,
          caseStudy: form.caseStudy || undefined,
          discussionPrompt: form.discussionPrompt || undefined,
          videoUrl: finalVideoUrl || undefined,
          pdfUrl: finalPdfUrl || undefined,
          estimatedReadMinutes: Number(form.estimatedReadMinutes),
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create unit");
      onDone();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#004900]/5 border border-[#004900]/20 rounded-lg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004900" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <p className="text-xs text-[#004900] font-medium">
          Adding unit to: <span className="font-bold">{module.title}</span>
          <span className="text-gray-400 ml-1">(Module #{module.id})</span>
        </p>
      </div>
      <Field label="Title" required error={errors.title}>
        <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. What is Instructional Leadership?" className={inputCls} />
      </Field>
      <Field label="Description" required>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Brief description of this unit" className={textareaCls} />
      </Field>

      <Field label="Content" required error={errors.content}>
        <RichTextEditor
          value={form.content}
          onChange={(html) => set("content", html)}
          placeholder="Main learning content for this unit"
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Summary">
          <textarea rows={3} value={form.summary} onChange={(e) => set("summary", e.target.value)}
            placeholder="Key takeaways (optional)" className={textareaCls} />
        </Field>
        <Field label="Case Study">
          <textarea rows={3} value={form.caseStudy} onChange={(e) => set("caseStudy", e.target.value)}
            placeholder="Real-world case study (optional)" className={textareaCls} />
        </Field>
      </div>
      <Field label="Discussion Prompt">
        <textarea rows={2} value={form.discussionPrompt} onChange={(e) => set("discussionPrompt", e.target.value)}
          placeholder="Reflection or discussion question (optional)" className={textareaCls} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Video">
          <input type="file" accept="video/*" onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setVideoFile(file);
            set("videoUrl", file ? file.name : "");
          }} className={inputCls} aria-label="Upload video" />
          {videoFile && <p className="text-xs text-gray-500 mt-1">Selected: {videoFile.name}</p>}
        </Field>
        <Field label="PDF">
          <input type="file" accept=".pdf" onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setPdfFile(file);
            set("pdfUrl", file ? file.name : "");
          }} className={inputCls} aria-label="Upload PDF" />
          {pdfFile && <p className="text-xs text-gray-500 mt-1">Selected: {pdfFile.name}</p>}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Est. Read (mins)" error={errors.estimatedReadMinutes}>
          <input type="number" min="0" value={form.estimatedReadMinutes}
            onChange={(e) => set("estimatedReadMinutes", e.target.value)} className={inputCls} aria-label="Estimated read minutes" />
        </Field>
        <Field label="Status" required>
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls} aria-label="Status">
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </Field>
      </div>
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
          {loading ? "Creating unit..." : "Create Unit →"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Assessment Form types ─────────────────────────────────────────────────────
// Only multiple-choice questions are supported now (true/false and
// short-answer have been removed).

type QuestionMode = "single" | "bulk" | "file";

type SingleQuestion = {
  questionText: string;
  options: { id: string; text: string }[];
  correctAnswer: string; // option id, e.g. "a"
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

// Converts the UI's {id, text}[] option shape + letter-based correctAnswer
// into what the API expects: options as string[], correctAnswer as a
// 0-based index.
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

// ── Add Assessment Form (Module) ──────────────────────────────────────────────
// Module assessments keep all 3 input modes: single question, multiple
// questions, or a CSV/Excel upload.

type AssessmentStep = 1 | 2;

function AddAssessmentForm({
  module,
  onDone,
  onCancel,
}: {
  module: Module;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<AssessmentStep>(1);

  // Step 1 — config
  const [config, setConfig] = useState({
    title: "",
    description: "",
    timeLimitMinutes: 0,
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
  const [fileUploading, setFileUploading] = useState(false);

  const setC = (k: keyof typeof config, v: any) =>
    setConfig(f => ({ ...f, [k]: v }));

  // ── Step 1: save module assessment config ───────────────────────────────────
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
      // POST /admin/modules/{moduleId}/assessment
      const res = await fetch(`${BASE}admin/modules/${module.id}/assessment`, {
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
    const parentType = "module_assessment";

    setQLoading(true);
    try {
      if (mode === "file") {
        // File → upload to Cloudinary first, then send the resulting URL to
        // the backend as JSON.
        if (!fileRef) { setQError("Please select a CSV or Excel file"); setQLoading(false); return; }

        let fileUrl = "";
        try {
          setFileUploading(true);
          fileUrl = await uploadToCloudinary(fileRef, "assessment-uploads");
        } catch (err: any) {
          throw new Error(err.message || "Failed to upload file to Cloudinary");
        } finally {
          setFileUploading(false);
        }

        const res = await fetch(`${BASE}admin/assessment-items/bulk-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            parentId,
            parentType,
            fileUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "File upload failed");

      } else {
        const validationError = validateQuestions(questions);
        if (validationError) { setQError(validationError); setQLoading(false); return; }

        if (mode === "single") {
          // Single question → POST /admin/assessment-items
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
              questionType: "multiple_choice",
              options,
              correctAnswer,
              explanation: q.explanation || undefined,
              orderIndex: q.orderIndex,
              points: q.points,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || "Failed to add question");

        } else {
          // Multiple questions → POST /admin/assessment-items/bulk
          const res = await fetch(`${BASE}admin/assessment-items/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            credentials: "include",
            body: JSON.stringify({
              parentId,
              parentType,
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
        }
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
          {/* Module context pill */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-50 border border-purple-100 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <p className="text-xs text-purple-700 font-medium">
              Module assessment for: <span className="font-bold">{module.title}</span>
              <span className="text-purple-400 ml-1">(Module #{module.id})</span>
            </p>
            <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
              No certificate issued
            </span>
          </div>

          <Field label="Title" required error={configErrors.title}>
            <input
              value={config.title}
              onChange={e => setC("title", e.target.value)}
              placeholder="e.g. Module Final Assessment"
              className={inputCls}
            />
          </Field>

          <Field label="Description" required error={configErrors.description}>
            <textarea
              rows={3}
              value={config.description}
              onChange={e => setC("description", e.target.value)}
              placeholder="What this assessment covers"
              className={textareaCls}
            />
          </Field>

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
                  {m === "single" && "Single Question"}
                  {m === "bulk" && "Multiple Questions"}
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

          {/* File upload mode */}
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
                  {["question_text", "correct_answer"].map(col => (
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
                  All rows are treated as <strong>multiple_choice</strong>.
                  <br />
                  <strong>correct_answer</strong>: a / b / c / d
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
                ? mode === "file"
                  ? (fileUploading ? "Uploading file…" : "Saving…")
                  : "Submitting…"
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

// ── Module Reflection Form ─────────────────────────────────────────────────────
// Wired to the real admin reflection endpoints:
//   POST   /admin/modules/{moduleId}/reflection        → create reflection
//   GET    /admin/modules/{moduleId}/reflection         → get reflection (+ response count)
//   PATCH  /admin/reflections/{reflectionId}             → update reflection

type ReflectionMode = "add" | "edit";

function ModuleReflectionForm({
  module,
  mode,
  onDone,
  onCancel,
}: {
  module: Module;
  mode: ReflectionMode;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  // Needed for PATCH /admin/reflections/{reflectionId} in edit mode — comes
  // back from GET /admin/modules/{moduleId}/reflection.
  const [reflectionId, setReflectionId] = useState<number | null>(null);
  const [fetching, setFetching] = useState(mode === "edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill for "edit" mode via GET /admin/modules/{moduleId}/reflection.
  useEffect(() => {
    if (mode !== "edit") return;
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem("adminAccessToken");
      try {
        const res = await fetch(`${BASE}admin/modules/${module.id}/reflection`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load reflection");
        if (cancelled) return;
        const refl = data?.data ?? data?.reflection ?? data;
        setDescription(refl?.description ?? "");
        setCriteria(refl?.criteria ?? "");
        setReflectionId(refl?.id ?? null);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load existing reflection");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, module.id]);

  const handleSubmit = async () => {
    setError("");
    if (!description.trim() || !criteria.trim()) {
      setError("Both description and criteria are required");
      return;
    }
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }

    if (mode === "edit" && !reflectionId) {
      setError("Could not find an existing reflection to update");
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === "add"
          ? `${BASE}admin/modules/${module.id}/reflection`
          : `${BASE}admin/reflections/${reflectionId}`;
      const res = await fetch(url, {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ description, criteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save reflection");
      onDone();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {fetching ? (
        <p className="text-xs text-gray-400">Loading existing reflection…</p>
      ) : (
        <>
          <Field label="Description" required>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={textareaCls}
              placeholder="Reflection description"
            />
          </Field>
          <Field label="Criteria" required>
            <textarea
              rows={4}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              className={textareaCls}
              placeholder="Reflection criteria"
            />
          </Field>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSubmit}
          disabled={loading || fetching}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
        >
          {loading ? "Saving…" : mode === "add" ? "Submit" : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── View Module Reflection (full-screen) ──────────────────────────────────────
// Read-only view wired to:
//   GET /admin/modules/{moduleId}/reflection            → description, criteria, id
//   GET /admin/reflections/{reflectionId}/responses      → list all learner responses
// Rendered inside <FullScreenModal>, which already provides the X close button.

type ReflectionResponse = {
  id: number;
  userId?: number;
  user?: { id?: number; name?: string; fullName?: string; email?: string };
  response?: string;
  answer?: string;
  content?: string;
  submittedAt?: string;
  createdAt?: string;
};

function ViewModuleReflection({ module }: { module: Module }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [reflectionId, setReflectionId] = useState<number | null>(null);

  const [responses, setResponses] = useState<ReflectionResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesError, setResponsesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchResponses = async (id: number, token: string | null) => {
      setResponsesLoading(true);
      setResponsesError("");
      try {
        // GET /admin/reflections/{reflectionId}/responses
        const res = await fetch(`${BASE}admin/reflections/${id}/responses`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load learner responses");
        if (cancelled) return;
        const list: ReflectionResponse[] = Array.isArray(data)
          ? data
          : data.data ?? data.responses ?? [];
        setResponses(list);
      } catch (err: any) {
        if (!cancelled) setResponsesError(err.message || "Failed to load learner responses");
      } finally {
        if (!cancelled) setResponsesLoading(false);
      }
    };

    const fetchReflection = async () => {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("adminAccessToken");
      try {
        // GET /admin/modules/{moduleId}/reflection
        const res = await fetch(`${BASE}admin/modules/${module.id}/reflection`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load reflection");
        if (cancelled) return;
        const refl = data?.data ?? data?.reflection ?? data;
        setDescription(refl?.description ?? "");
        setCriteria(refl?.criteria ?? "");
        const id = refl?.id ?? null;
        setReflectionId(id);
        if (id) await fetchResponses(id, token);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load reflection");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReflection();
    return () => { cancelled = true; };
  }, [module.id]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading reflection…</p>;
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Reflection details */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004900" strokeWidth="2">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">
            Reflection for "{module.title}"
            <span className="text-gray-400 font-normal ml-1">(Module #{module.id})</span>
          </h3>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{description || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Criteria</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{criteria || "—"}</p>
        </div>
      </div>

      {/* Learner responses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Learner Responses</h3>
          {!responsesLoading && !responsesError && (
            <span className="text-xs text-gray-400">
              {responses.length} response{responses.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!reflectionId && (
          <p className="text-sm text-gray-400">
            No reflection ID was returned, so learner responses can't be loaded.
          </p>
        )}

        {reflectionId && responsesLoading && (
          <p className="text-sm text-gray-400">Loading learner responses…</p>
        )}

        {reflectionId && !responsesLoading && responsesError && (
          <p className="text-sm text-red-600">{responsesError}</p>
        )}

        {reflectionId && !responsesLoading && !responsesError && responses.length === 0 && (
          <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center">
            <p className="text-sm text-gray-400">No learner responses yet.</p>
          </div>
        )}

        {reflectionId && !responsesLoading && !responsesError && responses.length > 0 && (
          <div className="space-y-3">
            {responses.map((r) => {
              const name =
                r.user?.fullName ||
                r.user?.name ||
                r.user?.email ||
                (r.userId ? `Learner #${r.userId}` : "Learner");
              const text = r.response ?? r.answer ?? r.content ?? "";
              const date = r.submittedAt || r.createdAt;
              return (
                <div key={r.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{name}</span>
                    {date && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(date).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{text || "—"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "edit"; module: Module }
  | { type: "delete"; module: Module }
  | { type: "addUnit"; module: Module }
  | { type: "addAssessment"; module: Module }
  | { type: "addReflection"; module: Module }
  | { type: "editReflection"; module: Module }
  | { type: "viewReflection"; module: Module };

export default function ManageModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchModules = useCallback(async () => {
    setLoading(true); setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      const tracksRes = await fetch(`${BASE}admin/tracks`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: "include",
      });
      const tracksData = await tracksRes.json();
      if (!tracksRes.ok) throw new Error(tracksData.message || "Failed to load tracks");
      const allTracks: Track[] = Array.isArray(tracksData)
        ? tracksData
        : tracksData.data ?? tracksData.tracks ?? [];
      setTracks(allTracks);
      if (allTracks.length === 0) { setModules([]); return; }

      const results = await Promise.all(
        allTracks.map((track) =>
          fetch(`${BASE}admin/tracks/${track.id}/modules`, {
            headers: { Authorization: `Bearer ${token}` }, credentials: "include",
          })
            .then((r) => r.json())
            .then((d) => {
              const mods: Module[] = Array.isArray(d) ? d : d.data ?? d.modules ?? [];
              return mods.map((m) => ({
                ...m,
                track: m.track ?? { id: track.id, title: track.title },
              }));
            })
            .catch(() => [] as Module[])
        )
      );
      setModules(results.flat());
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}admin/modules/${modal.module.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }, credentials: "include",
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.message || "Delete failed"); }
      setModal({ type: "none" });
      showToast(`Module "${modal.module.title}" deleted`);
      fetchModules();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => setModal({ type: "none" });

  const filteredModules = selectedTrackId === "all"
    ? modules
    : modules.filter((m) => m.trackId === selectedTrackId || m.track?.id === selectedTrackId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Modules</h1>
            <p className="text-sm text-gray-500 mt-0.5">Modules belong to tracks and group related units</p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && !fetchError && tracks.length > 0 && (
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
                aria-label="Filter by track"
              >
                <option value="all">All tracks</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {filteredModules.length} module{filteredModules.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading modules…
            </div>
          )}
          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button onClick={fetchModules} className="text-sm text-[#004900] underline">Retry</button>
            </div>
          )}
          {!loading && !fetchError && filteredModules.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              {modules.length === 0
                ? "No modules found. Create a module from a track first."
                : "No modules in this track."}
            </div>
          )}
          {!loading && !fetchError && filteredModules.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">ID</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Module Name</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Track</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredModules.map((mod) => {
                    const thumb = getModuleThumbnail(mod);
                    return (
                      <tr key={mod.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-4 text-gray-400 font-mono text-xs">{mod.id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                              {thumb ? (
                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <path d="M21 15l-5-5L5 21" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{mod.title}</div>
                              {mod.shortDescription && (
                                <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                                  {mod.shortDescription}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {mod.track?.title ?? `Track #${mod.trackId}`}
                          </span>
                        </td>
                        <td className="px-6 py-4"><Badge status={mod.status} /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">

                            {/* Add Unit */}
                            <button
                              onClick={() => setModal({ type: "addUnit", module: mod })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#004900] text-white hover:bg-[#003700] transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              Add Unit
                            </button>

                            {/* Add Assessment */}
                            <button
                              onClick={() => setModal({ type: "addAssessment", module: mod })}
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

                            {/* Overflow menu: reflection, edit, delete */}
                            <ActionsMenu
                              items={[
                                { label: "Add Reflection", onClick: () => setModal({ type: "addReflection", module: mod }) },
                                { label: "Edit Reflection", onClick: () => setModal({ type: "editReflection", module: mod }) },
                                { label: "View Reflection", onClick: () => setModal({ type: "viewReflection", module: mod }) },
                                { label: "Edit Module", onClick: () => setModal({ type: "edit", module: mod }) },
                                { label: "Delete Module", onClick: () => setModal({ type: "delete", module: mod }), danger: true },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {modal.type === "edit" && (
        <Modal title={`Edit Module — ${modal.module.title}`} onClose={closeModal}>
          <EditModuleForm
            module={modal.module}
            onDone={() => {
              closeModal();
              showToast("Module updated successfully");
              fetchModules();
            }}
          />
        </Modal>
      )}

      {/* ── Add Unit Modal ── */}
      {modal.type === "addUnit" && (
        <Modal title={`Add Unit to "${modal.module.title}"`} onClose={closeModal} wide>
          <UnitCreateModal
            module={modal.module}
            onDone={() => {
              closeModal();
              showToast(`Unit created successfully in "${modal.module.title}"`);
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {/* ── Add Assessment Modal ── */}
      {modal.type === "addAssessment" && (
        <Modal
          title={`Add Assessment to "${modal.module.title}"`}
          onClose={closeModal}
        >
          <AddAssessmentForm
            module={modal.module}
            onDone={() => {
              closeModal();
              showToast("Assessment and questions saved successfully");
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {/* ── Add Reflection Modal ── */}
      {modal.type === "addReflection" && (
        <Modal title={`Add Reflection — ${modal.module.title}`} onClose={closeModal}>
          <ModuleReflectionForm
            module={modal.module}
            mode="add"
            onDone={() => {
              closeModal();
              showToast("Reflection saved");
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {/* ── Edit Reflection Modal ── */}
      {modal.type === "editReflection" && (
        <Modal title={`Edit Reflection — ${modal.module.title}`} onClose={closeModal}>
          <ModuleReflectionForm
            module={modal.module}
            mode="edit"
            onDone={() => {
              closeModal();
              showToast("Reflection updated");
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {/* ── View Reflection Modal (full screen, X to close) ── */}
      {modal.type === "viewReflection" && (
        <FullScreenModal
          title={`Reflection — ${modal.module.title}`}
          onClose={closeModal}
        >
          <ViewModuleReflection module={modal.module} />
        </FullScreenModal>
      )}

      {/* ── Delete Confirm ── */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.module.title}"? This will also remove all its units and assessments.`}
          onConfirm={handleDelete}
          onCancel={closeModal}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 ${
          toast.type === "error" ? "bg-red-600" : "bg-[#004900]"
        } text-white`}>
          {toast.type === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}