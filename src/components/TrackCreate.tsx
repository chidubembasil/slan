import { useState } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

type TrackForm = {
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  isFree: boolean;
  status: "draft" | "published" | "archived";
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

const statusOptions = ["draft", "published", "archived"] as const;

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs sm:text-sm font-semibold text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 animate-in fade-in">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm placeholder:text-gray-400";
const textareaCls = "w-full px-3.5 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm placeholder:text-gray-400 resize-none";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 bg-gradient-to-br from-[#004900] to-[#006400] text-white px-4 sm:px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50">
      <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors shrink-0">✕</button>
    </div>
  );
}

const uploadToCloudinary = async (file: File, folder: string = "curriculum"): Promise<string> => {
  const API_KEY = import.meta.env.VITE_API_KEY;
  const API_SECRET = import.meta.env.VITE_API_SECRET_KEY;
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!API_KEY || !API_SECRET || !CLOUD_NAME) throw new Error("Cloudinary credentials missing");

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signatureString = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
  const signature = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0")).join("");

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

export default function TrackCreate({
  courseId,
  onComplete,
  onCancel,
}: {
  courseId: number;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<TrackForm>({
    title: "", description: "", shortDescription: "",
    thumbnail: "", isFree: false, status: "draft",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors<TrackForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const set = (key: keyof TrackForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<TrackForm> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.shortDescription.trim()) e.shortDescription = "Short description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setSubmitError("No authentication token found. Please log in again."); return; }

    setLoading(true);
    let finalThumbnail = form.thumbnail;

    try {
      if (thumbnailFile) {
        finalThumbnail = await uploadToCloudinary(thumbnailFile, "thumbnails");
      }

      const res = await fetch(`${BASE}admin/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          courseId,
          title: form.title,
          description: form.description,
          shortDescription: form.shortDescription,
          thumbnail: finalThumbnail || undefined,
          isFree: form.isFree,
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create track");

      setToast(`Track "${form.title}" created successfully`);
      setTimeout(() => {
        setToast(null);
        if (onComplete) onComplete();
      }, 2000);

      setForm({ title: "", description: "", shortDescription: "", thumbnail: "", isFree: false, status: "draft" });
      setThumbnailFile(null);
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-[#004900] via-[#005a00] to-[#007a00] rounded-2xl p-4 sm:p-6 lg:p-8 text-white shadow-lg shadow-[#004900]/20 mb-4 sm:mb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="w-5 h-5 sm:w-6 sm:h-6">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold leading-tight">Create New Track</h2>
            <p className="text-xs sm:text-sm text-white/80 mt-1 leading-relaxed">Tracks group related modules under course #{courseId}. Fill in the details below.</p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5">
          <Field label="Title" required error={errors.title}>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Leadership Foundations" className={inputCls} />
          </Field>

          <Field label="Short Description" required error={errors.shortDescription}>
            <input type="text" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)}
              placeholder="One-line summary shown in listings" className={inputCls} />
          </Field>

          <Field label="Description" required error={errors.description}>
            <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Full description of this track — what learners will achieve" className={textareaCls} />
          </Field>

          <Field label="Thumbnail Image">
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 flex items-center gap-3 px-3.5 py-2.5 sm:py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#004900]/30 hover:bg-[#004900]/[0.02] transition-colors group">
                <span className="w-9 h-9 rounded-xl bg-gray-50 group-hover:bg-[#004900]/10 flex items-center justify-center shrink-0 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </span>
                <span className="text-sm text-gray-600 truncate">{thumbnailFile ? thumbnailFile.name : "Choose image — JPG, PNG, WebP"}</span>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setThumbnailFile(file);
                  set("thumbnail", file ? file.name : "");
                }} className="hidden" aria-label="input" />
              </label>
              {thumbnailFile && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium whitespace-nowrap self-start sm:self-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Selected
                </span>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <Field label="Status" required>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}
                className={inputCls} aria-label="select">
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </Field>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-[#004900]/20 cursor-pointer transition-all group">
                <input type="checkbox" checked={form.isFree}
                  onChange={(e) => set("isFree", e.target.checked)}
                  className="w-4 h-4 sm:w-5 sm:h-5 accent-[#004900] rounded" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Free track</span>
                  <p className="text-xs text-gray-400 hidden sm:block">Learners can access without payment</p>
                </div>
                <span className={`shrink-0 w-10 h-6 rounded-full p-1 transition-colors flex items-center ${form.isFree ? "bg-[#004900] justify-end" : "bg-gray-300 justify-start"}`}>
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                </span>
              </label>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </span>
              <p className="text-sm text-red-700 flex-1">{submitError}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2 sm:pt-4 border-t border-gray-100 mt-2">
            <button type="submit" disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#004900] to-[#006400] text-white px-6 sm:px-8 py-3 sm:py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#004900]/20 disabled:opacity-60 transition-all">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Track
                  <span aria-hidden>→</span>
                </>
              )}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel}
                className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
