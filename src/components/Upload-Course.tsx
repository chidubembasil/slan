import { useState } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

type CourseForm = {
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  status: "draft" | "published" | "archived";
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

const statusOptions = ["draft", "published", "archived"] as const;

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] shadow-sm transition-all placeholder:text-gray-400";
const textareaCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] shadow-sm transition-all resize-none placeholder:text-gray-400";

function Section({ number, title, subtitle, children }: {
  number: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#004900] to-[#006400] px-5 sm:px-6 lg:px-8 py-5 sm:py-6 flex items-center gap-3 sm:gap-4">
        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-inner">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-white font-bold text-base sm:text-lg lg:text-xl leading-tight">{title}</h2>
          <p className="text-white/70 text-xs sm:text-sm mt-0.5 leading-tight">{subtitle}</p>
        </div>
      </div>
      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-[#004900] to-[#006400] text-white px-4 sm:px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50 max-w-[calc(100vw-2rem)] animate-fade-in">
      <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-xs sm:text-sm font-medium leading-tight">{message}</span>
      <button onClick={onClose} className="ml-1 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/90 hover:text-white transition-colors shrink-0">✕</button>
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

export default function CourseCreate({ onComplete }: { onComplete?: () => void }) {
  const [form, setForm] = useState<CourseForm>({
    title: "", description: "", shortDescription: "", thumbnail: "", status: "draft",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors<CourseForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const set = (key: keyof CourseForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<CourseForm> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.shortDescription.trim()) e.shortDescription = "Short description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    const token = localStorage.getItem("adminAccessToken");
    if (!token) {
      setSubmitError("No authentication token found. Please log in again.");
      return;
    }

    setLoading(true);
    let finalThumbnail = form.thumbnail;

    try {
      if (thumbnailFile) {
        finalThumbnail = await uploadToCloudinary(thumbnailFile, "thumbnails");
      }

      const res = await fetch(`${BASE}admin/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          shortDescription: form.shortDescription,
          thumbnail: finalThumbnail || undefined,
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create course");

      setToast(`Course "${form.title}" created successfully`);
      setTimeout(() => {
        setToast(null);
        if (onComplete) onComplete();
      }, 3000);

      // Reset form
      setForm({ title: "", description: "", shortDescription: "", thumbnail: "", status: "draft" });
      setThumbnailFile(null);
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#004900] uppercase tracking-widest mb-2">
            <span className="w-6 h-[2px] bg-[#004900] rounded-full" /> Curriculum
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">Create a new course</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2 max-w-2xl">Set up the top-level container that groups tracks, modules and assessments.</p>
        </div>

        <Section number="1" title="Create Course" subtitle="Top-level container — groups related tracks together">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              <Field label="Title" required error={errors.title}>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. School Leadership Fundamentals"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Short Description" required error={errors.shortDescription}>
              <input
                type="text"
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                placeholder="One-line summary shown in listings"
                className={inputCls}
              />
            </Field>

            <Field label="Description" required error={errors.description}>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Full description of this course"
                className={textareaCls}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <Field label="Thumbnail Image">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setThumbnailFile(file);
                      set("thumbnail", file ? file.name : "");
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-[#004900]/5 file:text-[#004900] file:text-xs file:font-semibold hover:file:bg-[#004900]/10 file:transition-colors cursor-pointer"
                    aria-label="input"
                  />
                </div>
                {thumbnailFile && (
                  <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Selected: <span className="font-medium text-gray-700 truncate max-w-[180px] sm:max-w-xs">{thumbnailFile.name}</span>
                  </p>
                )}
              </Field>

              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={inputCls}
                  aria-label="select"
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </span>
                <span className="leading-relaxed">{submitError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#004900] to-[#006400] text-white px-6 sm:px-8 py-3 rounded-xl text-sm font-semibold hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 shadow-md shadow-[#004900]/20 transition-all w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating course...
                  </>
                ) : (
                  <>Create Course →</>
                )}
              </button>
              <p className="text-xs text-gray-400 self-center text-center sm:text-left px-1">Course will be created as draft until published.</p>
            </div>
          </form>
        </Section>

        {/* Helper card */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Tracks", desc: "Group modules inside this course" },
            { title: "Modules", desc: "Organize units logically" },
            { title: "Assessments", desc: "Add quizzes per course" },
          ].map(card => (
            <div key={card.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <p className="text-xs font-bold text-[#004900] uppercase tracking-wide">{card.title}</p>
              <p className="text-sm text-gray-600 mt-1">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
