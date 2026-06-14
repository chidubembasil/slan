import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Shared between both files — keep in sync with UnitCreate.tsx
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
  passMarkPercent?: number;
  maxAttempts?: number;
  trackId: number;
  track?: { id: number; title: string };
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
  estimatedReadMinutes: string;
  passMarkPercent: string;
  maxAttempts: string;
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
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto`}>
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
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

// ── Edit Module Form ──────────────────────────────────────────────────────────

function EditModuleForm({ module, onDone }: { module: Module; onDone: () => void }) {
  const [form, setForm] = useState({
    title: module.title,
    description: module.description ?? "",
    shortDescription: module.shortDescription ?? "",
    estimatedReadMinutes: module.estimatedReadMinutes ?? 0,
    passMarkPercent: module.passMarkPercent ?? 65,
    maxAttempts: module.maxAttempts ?? 2,
    status: module.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/modules/${module.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          shortDescription: form.shortDescription || undefined,
          estimatedReadMinutes: form.estimatedReadMinutes,
          passMarkPercent: form.passMarkPercent,
          maxAttempts: form.maxAttempts,
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="Module title" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Short Description</label>
        <input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={inputCls} placeholder="One-line summary" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={textareaCls} placeholder="Full description" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Est. Read (mins)</label>
          <input type="number" min={0} value={form.estimatedReadMinutes} onChange={(e) => set("estimatedReadMinutes", Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Pass Mark %</label>
          <input type="number" min={0} max={100} value={form.passMarkPercent} onChange={(e) => set("passMarkPercent", Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Max Attempts</label>
          <input type="number" min={1} value={form.maxAttempts} onChange={(e) => set("maxAttempts", Number(e.target.value))} className={inputCls} />
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
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Cloudinary Upload (same as UnitCreate.tsx) ────────────────────────────────

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

// ── Field helper (same as UnitCreate.tsx) ────────────────────────────────────

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
// moduleId is pre-filled and hidden — user doesn't type it manually.

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
    passMarkPercent: "60",
    maxAttempts: "3",
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
          passMarkPercent: Number(form.passMarkPercent),
          maxAttempts: Number(form.maxAttempts),
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

      {/* Module context pill — read-only, shows which module this belongs to */}
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

      <Field label="Description" required error={errors.description}>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Brief description of this unit" className={textareaCls} />
      </Field>

      <Field label="Content">
        <textarea rows={5} value={form.content} onChange={(e) => set("content", e.target.value)}
          placeholder="Main learning content for this unit" className={textareaCls} />
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

      <div className="grid grid-cols-3 gap-4">
        <Field label="Est. Read (mins)" error={errors.estimatedReadMinutes}>
          <input type="number" min="0" value={form.estimatedReadMinutes}
            onChange={(e) => set("estimatedReadMinutes", e.target.value)} className={inputCls} aria-label="Estimated read minutes" />
        </Field>
        <Field label="Pass Mark (%)" error={errors.passMarkPercent}>
          <input type="number" min="0" max="100" value={form.passMarkPercent}
            onChange={(e) => set("passMarkPercent", e.target.value)} className={inputCls} aria-label="Pass mark percent" />
        </Field>
        <Field label="Max Attempts" error={errors.maxAttempts}>
          <input type="number" min="1" value={form.maxAttempts}
            onChange={(e) => set("maxAttempts", e.target.value)} className={inputCls} aria-label="Max attempts" />
        </Field>
      </div>

      <Field label="Status" required>
        <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls} aria-label="Status">
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

// ── Add Assessment Form ───────────────────────────────────────────────────────

type AssessmentConfigForm = {
  title: string;
  description: string;
  passMarkPercent: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  isActive: boolean;
};

type QuestionOption = { id: string; text: string };

type QuestionForm = {
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  points: number;
};

function AddAssessmentForm({
  module, onDone, onCancel,
}: {
  module: Module; onDone: () => void; onCancel: () => void;
}) {
  const [tab, setTab] = useState<"config" | "questions">("config");
  const [config, setConfig] = useState<AssessmentConfigForm>({
    title: "", description: "", passMarkPercent: 70, maxAttempts: 2, timeLimitMinutes: 0, isActive: false,
  });
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [savedAssessmentId, setSavedAssessmentId] = useState<number | null>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [newQ, setNewQ] = useState<QuestionForm>({
    questionText: "", questionType: "multiple_choice",
    options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }],
    correctAnswer: "", explanation: "", points: 1,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [error, setError] = useState("");
  const [configErrors, setConfigErrors] = useState<Partial<Record<keyof AssessmentConfigForm, string>>>({});
  const [qErrors, setQErrors] = useState<Partial<Record<keyof QuestionForm | "options", string>>>({});

  const setC = (k: keyof AssessmentConfigForm, v: string | number | boolean) =>
    setConfig((f) => ({ ...f, [k]: v }));
  const setQ = (k: keyof QuestionForm, v: any) => setNewQ((f) => ({ ...f, [k]: v }));
  const updateOption = (idx: number, text: string) => {
    const opts = [...newQ.options];
    opts[idx] = { ...opts[idx], text };
    setQ("options", opts);
  };

  const handleSaveConfig = async () => {
    const e: Partial<Record<keyof AssessmentConfigForm, string>> = {};
    if (!config.title.trim()) e.title = "Title is required";
    if (!config.description.trim()) e.description = "Description is required";
    setConfigErrors(e);
    if (Object.keys(e).length) return;
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setConfigLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}admin/modules/${module.id}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ title: config.title, description: config.description, passMarkPercent: config.passMarkPercent, maxAttempts: config.maxAttempts, timeLimitMinutes: config.timeLimitMinutes, isActive: config.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save assessment config");
      const assessmentId = data.data?.id ?? data.id ?? data.data?.assessmentId ?? null;
      setSavedAssessmentId(assessmentId);
      setConfigSaved(true);
      setTab("questions");
    } catch (err: any) { setError(err.message); } finally { setConfigLoading(false); }
  };

  const handleAddQuestion = async () => {
    const e: Partial<Record<keyof QuestionForm | "options", string>> = {};
    if (!newQ.questionText.trim()) e.questionText = "Question text is required";
    if (newQ.questionType === "multiple_choice" && newQ.options.some((o) => !o.text.trim())) e.options = "All options must be filled in";
    if (!newQ.correctAnswer.trim()) e.correctAnswer = "Correct answer is required";
    setQErrors(e);
    if (Object.keys(e).length) return;
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setQuestionLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}admin/assessment-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          parentId: savedAssessmentId, parentType: "module_assessment",
          questionText: newQ.questionText, questionType: newQ.questionType,
          options: newQ.questionType === "multiple_choice" ? newQ.options : undefined,
          correctAnswer: newQ.correctAnswer, explanation: newQ.explanation || undefined,
          orderIndex: questions.length, points: newQ.points,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add question");
      setQuestions((prev) => [...prev, { ...newQ }]);
      setNewQ({ questionText: "", questionType: "multiple_choice", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }], correctAnswer: "", explanation: "", points: 1 });
      setQErrors({});
    } catch (err: any) { setError(err.message); } finally { setQuestionLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab("config")} className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${tab === "config" ? "bg-white text-[#004900] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          1 · Assessment Config
        </button>
        <button onClick={() => { if (configSaved) setTab("questions"); }} disabled={!configSaved}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${tab === "questions" ? "bg-white text-[#004900] shadow-sm" : "text-gray-500 hover:text-gray-700"} disabled:opacity-40 disabled:cursor-not-allowed`}>
          2 · Questions {questions.length > 0 && `(${questions.length})`}
        </button>
      </div>

      {tab === "config" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
            <input value={config.title} onChange={(e) => setC("title", e.target.value)} className={inputCls} placeholder="e.g. Module Final Assessment" />
            {configErrors.title && <p className="text-xs text-red-600 mt-1">{configErrors.title}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea rows={3} value={config.description} onChange={(e) => setC("description", e.target.value)} className={textareaCls} placeholder="What this assessment covers" />
            {configErrors.description && <p className="text-xs text-red-600 mt-1">{configErrors.description}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Pass Mark %</label>
              <input type="number" min={0} max={100} value={config.passMarkPercent} onChange={(e) => setC("passMarkPercent", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Max Attempts</label>
              <input type="number" min={1} value={config.maxAttempts} onChange={(e) => setC("maxAttempts", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Time Limit (mins)</label>
              <input type="number" min={0} value={config.timeLimitMinutes} onChange={(e) => setC("timeLimitMinutes", Number(e.target.value))} className={inputCls} placeholder="0 = unlimited" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={config.isActive} onChange={(e) => setC("isActive", e.target.checked)} className="w-4 h-4 accent-[#004900]" />
            <span className="text-gray-700">Active immediately</span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={handleSaveConfig} disabled={configLoading} className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
              {configLoading ? "Saving..." : "Save & Add Questions →"}
            </button>
            <button onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {tab === "questions" && (
        <div className="space-y-5">
          {questions.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Added Questions ({questions.length})</p>
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-white rounded-lg px-3.5 py-2.5 border border-gray-100">
                  <span className="text-xs font-mono text-gray-400 mt-0.5 shrink-0">Q{i + 1}</span>
                  <p className="text-xs text-gray-700 line-clamp-2">{q.questionText}</p>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">{q.points}pt</span>
                </div>
              ))}
            </div>
          )}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Question</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Question Text <span className="text-red-500">*</span></label>
              <textarea rows={2} value={newQ.questionText} onChange={(e) => setQ("questionText", e.target.value)} className={textareaCls} placeholder="Enter the question..." />
              {qErrors.questionText && <p className="text-xs text-red-600 mt-1">{qErrors.questionText}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Question Type</label>
                <select value={newQ.questionType} onChange={(e) => setQ("questionType", e.target.value)} className={inputCls} aria-label="select">
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Points</label>
                <input type="number" min={1} value={newQ.points} onChange={(e) => setQ("points", Number(e.target.value))} className={inputCls} />
              </div>
            </div>
            {newQ.questionType === "multiple_choice" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Options</label>
                <div className="space-y-2">
                  {newQ.options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 w-4 shrink-0">{opt.id.toUpperCase()}</span>
                      <input value={opt.text} onChange={(e) => updateOption(idx, e.target.value)} className={inputCls} placeholder={`Option ${opt.id.toUpperCase()}`} />
                    </div>
                  ))}
                </div>
                {qErrors.options && <p className="text-xs text-red-600 mt-1">{qErrors.options}</p>}
              </div>
            )}
            {newQ.questionType === "true_false" ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Correct Answer <span className="text-red-500">*</span></label>
                <select value={newQ.correctAnswer} onChange={(e) => setQ("correctAnswer", e.target.value)} className={inputCls} aria-label="select">
                  <option value="">Select…</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
                {qErrors.correctAnswer && <p className="text-xs text-red-600 mt-1">{qErrors.correctAnswer}</p>}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Correct Answer <span className="text-red-500">*</span></label>
                <input value={newQ.correctAnswer} onChange={(e) => setQ("correctAnswer", e.target.value)} className={inputCls}
                  placeholder={newQ.questionType === "multiple_choice" ? "e.g. A or the option text" : "Expected answer"} />
                {qErrors.correctAnswer && <p className="text-xs text-red-600 mt-1">{qErrors.correctAnswer}</p>}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Explanation (optional)</label>
              <input value={newQ.explanation} onChange={(e) => setQ("explanation", e.target.value)} className={inputCls} placeholder="Why this answer is correct" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={handleAddQuestion} disabled={questionLoading} className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60">
              {questionLoading ? "Adding..." : "Add Question →"}
            </button>
            <button onClick={onDone} className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[#004900] text-[#004900] hover:bg-green-50">
              Done ({questions.length} question{questions.length !== 1 ? "s" : ""})
            </button>
            <button onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "edit"; module: Module }
  | { type: "delete"; module: Module }
  | { type: "addUnit"; module: Module }
  | { type: "addAssessment"; module: Module };

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
      const tracksRes = await fetch(`${BASE}admin/tracks`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
      const tracksData = await tracksRes.json();
      if (!tracksRes.ok) throw new Error(tracksData.message || "Failed to load tracks");
      const allTracks: Track[] = Array.isArray(tracksData) ? tracksData : tracksData.data ?? tracksData.tracks ?? [];
      setTracks(allTracks);
      if (allTracks.length === 0) { setModules([]); return; }

      const results = await Promise.all(
        allTracks.map((track) =>
          fetch(`${BASE}admin/tracks/${track.id}/modules`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
            .then((r) => r.json())
            .then((d) => {
              const mods: Module[] = Array.isArray(d) ? d : d.data ?? d.modules ?? [];
              return mods.map((m) => ({ ...m, track: m.track ?? { id: track.id, title: track.title } }));
            })
            .catch(() => [] as Module[])
        )
      );
      setModules(results.flat());
    } catch (err: any) { setFetchError(err.message); } finally { setLoading(false); }
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
    } catch (err: any) { showToast(err.message, "error"); } finally { setDeleting(false); }
  };

  const closeModal = () => setModal({ type: "none" });

  const filteredModules = selectedTrackId === "all"
    ? modules
    : modules.filter((m) => m.trackId === selectedTrackId || m.track?.id === selectedTrackId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Modules</h1>
            <p className="text-sm text-gray-500 mt-0.5">Modules belong to tracks and group related units</p>
          </div>
          <span className="text-sm text-gray-400">{filteredModules.length} module{filteredModules.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Track filter pills */}
        {!loading && !fetchError && tracks.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <button onClick={() => setSelectedTrackId("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedTrackId === "all" ? "bg-[#004900] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#004900] hover:text-[#004900]"}`}>
              All tracks
            </button>
            {tracks.map((t) => (
              <button key={t.id} onClick={() => setSelectedTrackId(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedTrackId === t.id ? "bg-[#004900] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#004900] hover:text-[#004900]"}`}>
                {t.title}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading modules…</div>}
          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button onClick={fetchModules} className="text-sm text-[#004900] underline">Retry</button>
            </div>
          )}
          {!loading && !fetchError && filteredModules.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              {modules.length === 0 ? "No modules found. Create a module from a track first." : "No modules in this track."}
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
                  {filteredModules.map((mod) => (
                    <tr key={mod.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{mod.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{mod.title}</div>
                        {mod.shortDescription && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">{mod.shortDescription}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {mod.track?.title ?? `Track #${mod.trackId}`}
                        </span>
                      </td>
                      <td className="px-6 py-4"><Badge status={mod.status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Add Unit — now opens UnitCreate as modal */}
                          <button onClick={() => setModal({ type: "addUnit", module: mod })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#004900] text-white hover:bg-[#003700] transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Unit
                          </button>
                          {/* Add Assessment */}
                          <button onClick={() => setModal({ type: "addAssessment", module: mod })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                            Add Assessment
                          </button>
                          {/* Edit */}
                          <button onClick={() => setModal({ type: "edit", module: mod })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>
                          {/* Delete */}
                          <button onClick={() => setModal({ type: "delete", module: mod })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
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
        <Modal title={`Edit Module — ${modal.module.title}`} onClose={closeModal}>
          <EditModuleForm module={modal.module} onDone={() => { closeModal(); showToast("Module updated successfully"); fetchModules(); }} />
        </Modal>
      )}

      {/* ── Add Unit Modal — uses UnitCreate form, wide modal ── */}
      {modal.type === "addUnit" && (
        <Modal title={`Add Unit to "${modal.module.title}"`} onClose={closeModal} wide>
          <UnitCreateModal
            module={modal.module}
            onDone={() => { closeModal(); showToast(`Unit created successfully in "${modal.module.title}"`); }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {/* ── Add Assessment Modal ── */}
      {modal.type === "addAssessment" && (
        <Modal title={`Add Assessment to "${modal.module.title}"`} onClose={closeModal}>
          <AddAssessmentForm
            module={modal.module}
            onDone={() => { closeModal(); showToast("Assessment saved successfully"); }}
            onCancel={closeModal}
          />
        </Modal>
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
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 ${toast.type === "error" ? "bg-red-600" : "bg-[#004900]"} text-white`}>
          {toast.type === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          )}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}