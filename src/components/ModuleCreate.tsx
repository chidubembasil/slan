import { useState } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

type ModuleForm = {
  trackId: string;
  title: string;
  description: string;
  content: string;
  estimatedReadMinutes: string;
  passMarkPercent: string;
  maxAttempts: string;
  status: "draft" | "published" | "archived";
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

const statusOptions = ["draft", "published", "archived"] as const;

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs sm:text-[13px] font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 sm:px-3.5 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm placeholder:text-gray-400";
const textareaCls = "w-full px-3 sm:px-3.5 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] resize-none transition-all shadow-sm placeholder:text-gray-400";

function Section({ number, title, subtitle, children }: {
  number: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#004900] via-[#004900] to-[#006400] px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center gap-3 sm:gap-4">
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white font-bold text-sm shrink-0 border border-white/10">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-semibold text-base sm:text-lg leading-tight truncate">{title}</h2>
          <p className="text-white/70 text-xs sm:text-[13px] leading-tight line-clamp-1">{subtitle}</p>
        </div>
      </div>
      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto bg-[#004900] text-white px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl shadow-lg flex items-center gap-3 z-50">
      <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-sm font-medium flex-1 min-w-0 truncate">{message}</span>
      <button onClick={onClose} className="ml-1 sm:ml-2 text-white/70 hover:text-white shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">✕</button>
    </div>
  );
}

export default function ModuleCreate({ onComplete }: { onComplete?: () => void }) {
  const [form, setForm] = useState<ModuleForm>({
    trackId: "", title: "", description: "", content: "",
    estimatedReadMinutes: "0", passMarkPercent: "65", maxAttempts: "2", status: "draft",
  });

  const [errors, setErrors] = useState<FormErrors<ModuleForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const set = (key: keyof ModuleForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<ModuleForm> = {};
    if (!form.trackId.trim() || isNaN(Number(form.trackId))) e.trackId = "Valid Track ID is required";
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.estimatedReadMinutes === "" || isNaN(Number(form.estimatedReadMinutes))) 
      e.estimatedReadMinutes = "Must be a valid number";
    const pmp = Number(form.passMarkPercent);
    if (isNaN(pmp) || pmp < 0 || pmp > 100) e.passMarkPercent = "Must be 0–100";
    const ma = Number(form.maxAttempts);
    if (isNaN(ma) || ma < 1) e.maxAttempts = "Must be at least 1";
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

    try {
      const res = await fetch(`${BASE}admin/tracks/${form.trackId}/modules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content: form.content || undefined,
          estimatedReadMinutes: Number(form.estimatedReadMinutes),
          passMarkPercent: Number(form.passMarkPercent),
          maxAttempts: Number(form.maxAttempts),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create module");

      setToast(`Module "${form.title}" created successfully`);
      setTimeout(() => {
        setToast(null);
        if (onComplete) onComplete();
      }, 3000);

      // Reset form
      setForm({
        trackId: form.trackId, title: "", description: "", content: "",
        estimatedReadMinutes: "0", passMarkPercent: "65", maxAttempts: "2", status: "draft",
      });
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 w-full overflow-hidden">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 w-full">
        {/* Page intro */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Create Module</h1>
          <p className="text-sm text-gray-500 mt-1">Add a new learning module to an existing track.</p>
        </div>

        <Section number="2" title="Create Module" subtitle="Belongs to a track — groups related units together">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <Field label="Track ID" required error={errors.trackId}>
              <input type="number" min="1" value={form.trackId}
                onChange={(e) => set("trackId", e.target.value)}
                placeholder="Enter the ID of the parent track" className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:gap-5">
              <Field label="Title" required error={errors.title}>
                <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Introduction to Leadership" className={inputCls} />
              </Field>
            </div>

            <Field label="Description" required error={errors.description}>
              <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="What this module covers" className={textareaCls + " sm:rows-4"} />
            </Field>

            <Field label="Content">
              <textarea rows={4} value={form.content} onChange={(e) => set("content", e.target.value)}
                placeholder="Extended content or overview (optional)" className={textareaCls + " sm:rows-5"} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <Field label="Estimated Read (mins)" error={errors.estimatedReadMinutes}>
                <input type="number" min="0" value={form.estimatedReadMinutes}
                  onChange={(e) => set("estimatedReadMinutes", e.target.value)} className={inputCls} aria-label="input"/>
              </Field>
              <Field label="Pass Mark (%)" error={errors.passMarkPercent}>
                <input type="number" min="0" max="100" value={form.passMarkPercent}
                  onChange={(e) => set("passMarkPercent", e.target.value)} className={inputCls} aria-label="input" />
              </Field>
              <Field label="Max Attempts" error={errors.maxAttempts}>
                <input type="number" min="1" value={form.maxAttempts}
                  onChange={(e) => set("maxAttempts", e.target.value)} className={inputCls} aria-label="input" />
              </Field>
            </div>

            <Field label="Status" required>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls} aria-label="select">
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </Field>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1 sm:pt-2">
              <button type="submit" disabled={loading}
                className="w-full sm:w-auto bg-gradient-to-r from-[#004900] to-[#006400] text-white px-6 py-2.5 sm:py-3 rounded-xl text-sm font-medium hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 shadow-sm shadow-[#004900]/20 transition-all inline-flex items-center justify-center gap-2">
                {loading ? "Creating module..." : "Create Module →"}
              </button>
              <p className="text-xs text-gray-400 text-center sm:text-left py-2">Module will be created under Track #{form.trackId || "—"}</p>
            </div>
          </form>
        </Section>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
