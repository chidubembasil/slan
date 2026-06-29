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
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] resize-none";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 bg-[#004900] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">✕</button>
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
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
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
            placeholder="Full description of this track" className={textareaCls} />
        </Field>

        <Field label="Thumbnail Image">
          <input type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setThumbnailFile(file);
            set("thumbnail", file ? file.name : "");
          }} className={inputCls} aria-label="input" />
          {thumbnailFile && <p className="text-xs text-gray-500 mt-1">Selected: {thumbnailFile.name}</p>}
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Status" required>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className={inputCls} aria-label="select">
              {statusOptions.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={form.isFree}
            onChange={(e) => set("isFree", e.target.checked)}
            className="w-4 h-4 accent-[#004900]" />
          <span className="text-gray-700">This track is free</span>
        </label>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="bg-[#004900] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
            {loading ? "Creating..." : "Create Track →"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </form>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}