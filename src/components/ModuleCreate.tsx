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

function Section({ number, title, subtitle, children }: {
  number: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-[#004900] px-8 py-5 flex items-center gap-4">
        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {number}
        </span>
        <div>
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <p className="text-white/70 text-xs">{subtitle}</p>
        </div>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 bg-[#004900] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-fade-in">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">✕</button>
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-6">
        <Section number="2" title="Create Module" subtitle="Belongs to a track — groups related units together">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Track ID" required error={errors.trackId}>
              <input type="number" min="1" value={form.trackId}
                onChange={(e) => set("trackId", e.target.value)}
                placeholder="Enter the ID of the parent track" className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Title" required error={errors.title}>
                <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Introduction to Leadership" className={inputCls} />
              </Field>
            </div>

            <Field label="Description" required error={errors.description}>
              <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="What this module covers" className={textareaCls} />
            </Field>

            <Field label="Content">
              <textarea rows={5} value={form.content} onChange={(e) => set("content", e.target.value)}
                placeholder="Extended content or overview (optional)" className={textareaCls} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="slan-btn-primary">
              {loading ? "Creating module..." : "Create Module →"}
            </button>
          </form>
        </Section>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}