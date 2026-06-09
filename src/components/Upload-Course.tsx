import { useState } from "react";

const BASE = import.meta.env.VITE_BASE_URL;


type TrackForm = {
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  orderIndex: string;
  isFree: boolean;
  price: string;
  status: "draft" | "published" | "archived";
};

type ModuleForm = {
  trackId: string;
  title: string;
  description: string;
  content: string;
  orderIndex: string;
  estimatedReadMinutes: string;
  passMarkPercent: string;
  maxAttempts: string;
  status: "draft" | "published" | "archived";
};

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
  orderIndex: string;
  estimatedReadMinutes: string;
  passMarkPercent: string;
  maxAttempts: string;
  status: "draft" | "published" | "archived";
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

// ── Helpers ────────────────────────────────────────────────────────────────

const statusOptions = ["draft", "published", "archived"] as const;

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";

const textareaCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] resize-none";

// ── Section Wrapper ────────────────────────────────────────────────────────

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
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

// ── Success Toast ──────────────────────────────────────────────────────────

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

// ══════════════════════════════════════════════════════════════════════════
// TRACK FORM
// ══════════════════════════════════════════════════════════════════════════

function TrackFormSection({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [form, setForm] = useState<TrackForm>({
    title: "", description: "", shortDescription: "", thumbnail: "",
    orderIndex: "0", isFree: false, price: "0", status: "draft",
  });
  const [errors, setErrors] = useState<FormErrors<TrackForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (key: keyof TrackForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<TrackForm> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.shortDescription.trim()) e.shortDescription = "Short description is required";
    if (form.orderIndex === "" || isNaN(Number(form.orderIndex)))
      e.orderIndex = "Must be a valid number";
    if (!form.isFree && (form.price === "" || isNaN(Number(form.price)) || Number(form.price) < 0))
      e.price = "Enter a valid price";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${BASE}admin/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          shortDescription: form.shortDescription,
          thumbnail: form.thumbnail || undefined,
          orderIndex: Number(form.orderIndex),
          isFree: form.isFree,
          price: Number(form.price),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create track");

      onSuccess(`Track "${form.title}" created successfully`);
      setForm({ title: "", description: "", shortDescription: "", thumbnail: "", orderIndex: "0", isFree: false, price: "0", status: "draft" });
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section number="1" title="Create Track" subtitle="Top-level learning path — groups related modules together">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Title" required error={errors.title}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. School Leadership Fundamentals"
              className={inputCls}
            />
          </Field>
          <Field label="Order Index" required error={errors.orderIndex}>
            <input
              type="number"
              min="0"
              value={form.orderIndex}
              onChange={(e) => set("orderIndex", e.target.value)}
              className={inputCls}
              aria-label="input"
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
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Full description of this track"
            className={textareaCls}
          />
        </Field>

        <Field label="Thumbnail URL" error={errors.thumbnail}>
          <input
            type="url"
            value={form.thumbnail}
            onChange={(e) => set("thumbnail", e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Status" required>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputCls}
              aria-label="select"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>

          <Field label="Price (₦)" error={errors.price}>
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              disabled={form.isFree}
              className={inputCls + (form.isFree ? " opacity-40 cursor-not-allowed" : "")}
              aria-label="input"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={form.isFree}
            onChange={(e) => { set("isFree", e.target.checked); if (e.target.checked) set("price", "0"); }}
            className="w-4 h-4 accent-[#004900]"
          />
          <span className="text-gray-700">This track is free</span>
        </label>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#004900] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating track..." : "Create Track →"}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE FORM
// ══════════════════════════════════════════════════════════════════════════

function ModuleFormSection({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [form, setForm] = useState<ModuleForm>({
    trackId: "", title: "", description: "", content: "",
    orderIndex: "0", estimatedReadMinutes: "0",
    passMarkPercent: "65", maxAttempts: "2", status: "draft",
  });
  const [errors, setErrors] = useState<FormErrors<ModuleForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (key: keyof ModuleForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<ModuleForm> = {};
    if (!form.trackId.trim() || isNaN(Number(form.trackId))) e.trackId = "Valid Track ID is required";
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.orderIndex === "" || isNaN(Number(form.orderIndex))) e.orderIndex = "Must be a valid number";
    if (form.estimatedReadMinutes === "" || isNaN(Number(form.estimatedReadMinutes))) e.estimatedReadMinutes = "Must be a valid number";
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

    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${BASE}admin/tracks/${form.trackId}/modules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content: form.content || undefined,
          orderIndex: Number(form.orderIndex),
          estimatedReadMinutes: Number(form.estimatedReadMinutes),
          passMarkPercent: Number(form.passMarkPercent),
          maxAttempts: Number(form.maxAttempts),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create module");

      onSuccess(`Module "${form.title}" created successfully`);
      setForm({ trackId: form.trackId, title: "", description: "", content: "", orderIndex: "0", estimatedReadMinutes: "0", passMarkPercent: "65", maxAttempts: "2", status: "draft" });
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section number="2" title="Create Module" subtitle="Belongs to a track — groups related units together">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Track ID" required error={errors.trackId}>
          <input
            type="number"
            min="1"
            value={form.trackId}
            onChange={(e) => set("trackId", e.target.value)}
            placeholder="Enter the ID of the parent track"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Title" required error={errors.title}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Introduction to Leadership"
              className={inputCls}
            />
          </Field>
          <Field label="Order Index" required error={errors.orderIndex}>
            <input
              type="number"
              min="0"
              value={form.orderIndex}
              onChange={(e) => set("orderIndex", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
        </div>

        <Field label="Description" required error={errors.description}>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What this module covers"
            className={textareaCls}
          />
        </Field>

        <Field label="Content" error={errors.content}>
          <textarea
            rows={4}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Extended content or overview (optional)"
            className={textareaCls}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Estimated Read (mins)" error={errors.estimatedReadMinutes}>
            <input
              type="number"
              min="0"
              value={form.estimatedReadMinutes}
              onChange={(e) => set("estimatedReadMinutes", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
          <Field label="Pass Mark (%)" error={errors.passMarkPercent}>
            <input
              type="number"
              min="0"
              max="100"
              value={form.passMarkPercent}
              onChange={(e) => set("passMarkPercent", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
          <Field label="Max Attempts" error={errors.maxAttempts}>
            <input
              type="number"
              min="1"
              value={form.maxAttempts}
              onChange={(e) => set("maxAttempts", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
        </div>

        <Field label="Status" required>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className={inputCls + " w-auto"}
            aria-label="select"
          >
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

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#004900] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating module..." : "Create Module →"}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// UNIT FORM
// ══════════════════════════════════════════════════════════════════════════

function UnitFormSection({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [form, setForm] = useState<UnitForm>({
    moduleId: "", title: "", description: "", content: "",
    summary: "", caseStudy: "", discussionPrompt: "",
    videoUrl: "", pdfUrl: "",
    orderIndex: "0", estimatedReadMinutes: "0",
    passMarkPercent: "60", maxAttempts: "3", status: "draft",
  });
  const [errors, setErrors] = useState<FormErrors<UnitForm>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (key: keyof UnitForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors<UnitForm> = {};
    if (!form.moduleId.trim() || isNaN(Number(form.moduleId))) e.moduleId = "Valid Module ID is required";
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.orderIndex === "" || isNaN(Number(form.orderIndex))) e.orderIndex = "Must be a valid number";
    if (form.estimatedReadMinutes === "" || isNaN(Number(form.estimatedReadMinutes))) e.estimatedReadMinutes = "Must be a valid number";
    const pmp = Number(form.passMarkPercent);
    if (isNaN(pmp) || pmp < 0 || pmp > 100) e.passMarkPercent = "Must be 0–100";
    const ma = Number(form.maxAttempts);
    if (isNaN(ma) || ma < 1) e.maxAttempts = "Must be at least 1";
    if (form.videoUrl && !form.videoUrl.startsWith("http")) e.videoUrl = "Must be a valid URL";
    if (form.pdfUrl && !form.pdfUrl.startsWith("http")) e.pdfUrl = "Must be a valid URL";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${BASE}admin/modules/${form.moduleId}/units`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content: form.content || undefined,
          summary: form.summary || undefined,
          caseStudy: form.caseStudy || undefined,
          discussionPrompt: form.discussionPrompt || undefined,
          videoUrl: form.videoUrl || undefined,
          pdfUrl: form.pdfUrl || undefined,
          orderIndex: Number(form.orderIndex),
          estimatedReadMinutes: Number(form.estimatedReadMinutes),
          passMarkPercent: Number(form.passMarkPercent),
          maxAttempts: Number(form.maxAttempts),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create unit");

      onSuccess(`Unit "${form.title}" created successfully`);
      setForm({
        moduleId: form.moduleId, title: "", description: "", content: "",
        summary: "", caseStudy: "", discussionPrompt: "",
        videoUrl: "", pdfUrl: "",
        orderIndex: "0", estimatedReadMinutes: "0",
        passMarkPercent: "60", maxAttempts: "3", status: "draft",
      });
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section number="3" title="Create Unit" subtitle="Belongs to a module — the smallest unit of learning content">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Module ID" required error={errors.moduleId}>
          <input
            type="number"
            min="1"
            value={form.moduleId}
            onChange={(e) => set("moduleId", e.target.value)}
            placeholder="Enter the ID of the parent module"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Title" required error={errors.title}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. What is Instructional Leadership?"
              className={inputCls}
            />
          </Field>
          <Field label="Order Index" required error={errors.orderIndex}>
            <input
              type="number"
              min="0"
              value={form.orderIndex}
              onChange={(e) => set("orderIndex", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
        </div>

        <Field label="Description" required error={errors.description}>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Brief description of this unit"
            className={textareaCls}
          />
        </Field>

        <Field label="Content" error={errors.content}>
          <textarea
            rows={5}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Main learning content for this unit"
            className={textareaCls}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Summary" error={errors.summary}>
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Key takeaways (optional)"
              className={textareaCls}
            />
          </Field>
          <Field label="Case Study" error={errors.caseStudy}>
            <textarea
              rows={3}
              value={form.caseStudy}
              onChange={(e) => set("caseStudy", e.target.value)}
              placeholder="Real-world case study (optional)"
              className={textareaCls}
            />
          </Field>
        </div>

        <Field label="Discussion Prompt" error={errors.discussionPrompt}>
          <textarea
            rows={2}
            value={form.discussionPrompt}
            onChange={(e) => set("discussionPrompt", e.target.value)}
            placeholder="Reflection or discussion question for learners (optional)"
            className={textareaCls}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Video URL" error={errors.videoUrl}>
            <input
              type="url"
              value={form.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
          <Field label="PDF URL" error={errors.pdfUrl}>
            <input
              type="url"
              value={form.pdfUrl}
              onChange={(e) => set("pdfUrl", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Field label="Estimated Read (mins)" error={errors.estimatedReadMinutes}>
            <input
              type="number"
              min="0"
              value={form.estimatedReadMinutes}
              onChange={(e) => set("estimatedReadMinutes", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
          <Field label="Pass Mark (%)" error={errors.passMarkPercent}>
            <input
              type="number"
              min="0"
              max="100"
              value={form.passMarkPercent}
              onChange={(e) => set("passMarkPercent", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
          <Field label="Max Attempts" error={errors.maxAttempts}>
            <input
              type="number"
              min="1"
              value={form.maxAttempts}
              onChange={(e) => set("maxAttempts", e.target.value)}
              className={inputCls}
              aria-label="input"
            />
          </Field>
          <Field label="Status" required>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputCls}
              aria-label="select"
            >
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

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#004900] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating unit..." : "Create Unit →"}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════

type FormTab = "track" | "module" | "unit";

const formTabs: { id: FormTab; label: string; num: string; description: string }[] = [
  { id: "track", label: "Track", num: "1", description: "Top-level learning path" },
  { id: "module", label: "Module", num: "2", description: "Belongs to a track" },
  { id: "unit", label: "Unit", num: "3", description: "Belongs to a module" },
];

export default function CurriculumCreate() {
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FormTab>("track");

  const handleSuccess = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Tab Nav */}
      <div className="max-w-4xl mx-auto px-8 pt-6">

        

        {/* Tab buttons */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
          {formTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-7 py-3.5 text-sm font-medium border-b-2 transition-all flex-1 justify-center -mb-px ${
                activeTab === tab.id
                  ? "border-[#004900] text-[#004900] bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  activeTab === tab.id ? "bg-[#004900] text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {tab.num}
              </span>
              {tab.label}
              <span className={`text-xs hidden md:inline ${activeTab === tab.id ? "text-[#004900]/60" : "text-gray-400"}`}>
                — {tab.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Form */}
      <div className="max-w-4xl mx-auto px-8 py-6">
        {activeTab === "track" && <TrackFormSection onSuccess={handleSuccess} />}
        {activeTab === "module" && <ModuleFormSection onSuccess={handleSuccess} />}
        {activeTab === "unit" && <UnitFormSection onSuccess={handleSuccess} />}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}