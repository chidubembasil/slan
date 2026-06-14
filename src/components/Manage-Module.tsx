import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

type ModuleStatus = "draft" | "published" | "archived";

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

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

// ── Badge ─────────────────────────────────────────────────────────────────────

const statusBadge: Record<ModuleStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[status]}`}
    >
      {status}
    </span>
  );
}

// ── Modal Shell ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Module Form ──────────────────────────────────────────────────────────

function EditModuleForm({
  module,
  onDone,
}: {
  module: Module;
  onDone: () => void;
}) {
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="Module title"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Short Description
        </label>
        <input
          value={form.shortDescription}
          onChange={(e) => set("shortDescription", e.target.value)}
          className={inputCls}
          placeholder="One-line summary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Description
        </label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={textareaCls}
          placeholder="Full description"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Est. Read (mins)
          </label>
          <input
            type="number"
            min={0}
            value={form.estimatedReadMinutes}
            onChange={(e) => set("estimatedReadMinutes", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Pass Mark %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.passMarkPercent}
            onChange={(e) => set("passMarkPercent", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Max Attempts
          </label>
          <input
            type="number"
            min={1}
            value={form.maxAttempts}
            onChange={(e) => set("maxAttempts", Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Status
        </label>
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className={inputCls}
          aria-label="select"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Add Unit Form ─────────────────────────────────────────────────────────────
// POST /admin/modules/{moduleId}/units
// Fields from UnitCreate.tsx (image 3):
// title, description, content, summary, caseStudy, discussionPrompt,
// videoUrl, pdfUrl, estimatedReadMinutes, passMarkPercent, maxAttempts, status

type UnitForm = {
  title: string;
  description: string;
  content: string;
  summary: string;
  caseStudy: string;
  discussionPrompt: string;
  videoUrl: string;
  pdfUrl: string;
  estimatedReadMinutes: number;
  passMarkPercent: number;
  maxAttempts: number;
  status: "draft" | "published" | "archived";
};

function AddUnitForm({
  moduleId,
  onDone,
  onCancel,
}: {
  moduleId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UnitForm>({
    title: "",
    description: "",
    content: "",
    summary: "",
    caseStudy: "",
    discussionPrompt: "",
    videoUrl: "",
    pdfUrl: "",
    estimatedReadMinutes: 0,
    passMarkPercent: 60,
    maxAttempts: 3,
    status: "draft",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UnitForm, string>>>({});
  const set = (k: keyof UnitForm, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof UnitForm, string>> = {};
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
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/modules/${moduleId}/units`, {
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
          summary: form.summary || undefined,
          caseStudy: form.caseStudy || undefined,
          discussionPrompt: form.discussionPrompt || undefined,
          videoUrl: form.videoUrl || undefined,
          pdfUrl: form.pdfUrl || undefined,
          estimatedReadMinutes: form.estimatedReadMinutes,
          passMarkPercent: form.passMarkPercent,
          maxAttempts: form.maxAttempts,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create unit");
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Required */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="e.g. What is Leadership?"
        />
        {formErrors.title && (
          <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={textareaCls}
          placeholder="Full description of this unit"
        />
        {formErrors.description && (
          <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Content
        </label>
        <textarea
          rows={4}
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          className={textareaCls}
          placeholder="Main body content of the unit"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Summary
        </label>
        <textarea
          rows={2}
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          className={textareaCls}
          placeholder="Key takeaways summary"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Case Study
        </label>
        <textarea
          rows={3}
          value={form.caseStudy}
          onChange={(e) => set("caseStudy", e.target.value)}
          className={textareaCls}
          placeholder="Real-world case study (optional)"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Discussion Prompt
        </label>
        <textarea
          rows={2}
          value={form.discussionPrompt}
          onChange={(e) => set("discussionPrompt", e.target.value)}
          className={textareaCls}
          placeholder="Prompt for group discussion (optional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Video URL
          </label>
          <input
            value={form.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
            className={inputCls}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            PDF URL
          </label>
          <input
            value={form.pdfUrl}
            onChange={(e) => set("pdfUrl", e.target.value)}
            className={inputCls}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Est. Read (mins)
          </label>
          <input
            type="number"
            min={0}
            value={form.estimatedReadMinutes}
            onChange={(e) =>
              set("estimatedReadMinutes", Number(e.target.value))
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Pass Mark %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.passMarkPercent}
            onChange={(e) => set("passMarkPercent", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Max Attempts
          </label>
          <input
            type="number"
            min={1}
            value={form.maxAttempts}
            onChange={(e) => set("maxAttempts", Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Status
        </label>
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className={inputCls}
          aria-label="select"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Unit →"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Add Assessment Form ───────────────────────────────────────────────────────
// Step 1: POST /admin/modules/{moduleId}/assessment  → assessment config
// Step 2: POST /admin/assessment-items               → questions (parentType: "module_assessment" hidden)

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
  module,
  onDone,
  onCancel,
}: {
  module: Module;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"config" | "questions">("config");

  const [config, setConfig] = useState<AssessmentConfigForm>({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 0,
    isActive: false,
  });

  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [savedAssessmentId, setSavedAssessmentId] = useState<number | null>(
    null
  );
  const [configSaved, setConfigSaved] = useState(false);

  const [newQ, setNewQ] = useState<QuestionForm>({
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
    points: 1,
  });

  const [configLoading, setConfigLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [error, setError] = useState("");
  const [configErrors, setConfigErrors] = useState<Partial<Record<keyof AssessmentConfigForm, string>>>({});
  const [qErrors, setQErrors] = useState<Partial<Record<keyof QuestionForm | "options", string>>>({});

  const setC = (k: keyof AssessmentConfigForm, v: string | number | boolean) =>
    setConfig((f) => ({ ...f, [k]: v }));
  const setQ = (k: keyof QuestionForm, v: any) =>
    setNewQ((f) => ({ ...f, [k]: v }));

  const updateOption = (idx: number, text: string) => {
    const opts = [...newQ.options];
    opts[idx] = { ...opts[idx], text };
    setQ("options", opts);
  };

  // STEP 1 — save assessment config to /admin/modules/{moduleId}/assessment
  const handleSaveConfig = async () => {
    const e: Partial<Record<keyof AssessmentConfigForm, string>> = {};
    if (!config.title.trim()) e.title = "Title is required";
    if (!config.description.trim()) e.description = "Description is required";
    setConfigErrors(e);
    if (Object.keys(e).length) return;

    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setConfigLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}admin/modules/${module.id}/assessment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      if (!res.ok)
        throw new Error(data.message || "Failed to save assessment config");
      const assessmentId =
        data.data?.id ?? data.id ?? data.data?.assessmentId ?? null;
      setSavedAssessmentId(assessmentId);
      setConfigSaved(true);
      setTab("questions");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  // STEP 2 — add question to /admin/assessment-items
  const handleAddQuestion = async () => {
    const e: Partial<Record<keyof QuestionForm | "options", string>> = {};
    if (!newQ.questionText.trim()) e.questionText = "Question text is required";
    if (
      newQ.questionType === "multiple_choice" &&
      newQ.options.some((o) => !o.text.trim())
    )
      e.options = "All options must be filled in";
    if (!newQ.correctAnswer.trim())
      e.correctAnswer = "Correct answer is required";
    setQErrors(e);
    if (Object.keys(e).length) return;

    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setQuestionLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}admin/assessment-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          parentId: savedAssessmentId,
          parentType: "module_assessment", // hidden from UI
          questionText: newQ.questionText,
          questionType: newQ.questionType,
          options:
            newQ.questionType === "multiple_choice"
              ? newQ.options
              : undefined,
          correctAnswer: newQ.correctAnswer,
          explanation: newQ.explanation || undefined,
          orderIndex: questions.length,
          points: newQ.points,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add question");
      setQuestions((prev) => [...prev, { ...newQ }]);
      setNewQ({
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
        points: 1,
      });
      setQErrors({});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuestionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab("config")}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === "config"
              ? "bg-white text-[#004900] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          1 · Assessment Config
        </button>
        <button
          onClick={() => {
            if (configSaved) setTab("questions");
          }}
          disabled={!configSaved}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === "questions"
              ? "bg-white text-[#004900] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          2 · Questions {questions.length > 0 && `(${questions.length})`}
        </button>
      </div>

      {/* ── Tab 1: Config ── */}
      {tab === "config" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={config.title}
              onChange={(e) => setC("title", e.target.value)}
              className={inputCls}
              placeholder="e.g. Module Final Assessment"
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
              onChange={(e) => setC("description", e.target.value)}
              className={textareaCls}
              placeholder="What this assessment covers"
            />
            {configErrors.description && (
              <p className="text-xs text-red-600 mt-1">
                {configErrors.description}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Pass Mark %
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={config.passMarkPercent}
                onChange={(e) =>
                  setC("passMarkPercent", Number(e.target.value))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Max Attempts
              </label>
              <input
                type="number"
                min={1}
                value={config.maxAttempts}
                onChange={(e) => setC("maxAttempts", Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Time Limit (mins)
              </label>
              <input
                type="number"
                min={0}
                value={config.timeLimitMinutes}
                onChange={(e) =>
                  setC("timeLimitMinutes", Number(e.target.value))
                }
                className={inputCls}
                placeholder="0 = unlimited"
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={config.isActive}
              onChange={(e) => setC("isActive", e.target.checked)}
              className="w-4 h-4 accent-[#004900]"
            />
            <span className="text-gray-700">Active immediately</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSaveConfig}
              disabled={configLoading}
              className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
            >
              {configLoading ? "Saving..." : "Save & Add Questions →"}
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Questions ── */}
      {tab === "questions" && (
        <div className="space-y-5">
          {/* Added questions list */}
          {questions.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Added Questions ({questions.length})
              </p>
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 bg-white rounded-lg px-3.5 py-2.5 border border-gray-100"
                >
                  <span className="text-xs font-mono text-gray-400 mt-0.5 shrink-0">
                    Q{i + 1}
                  </span>
                  <p className="text-xs text-gray-700 line-clamp-2">
                    {q.questionText}
                  </p>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">
                    {q.points}pt
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* New question form */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              New Question
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Question Text <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={newQ.questionText}
                onChange={(e) => setQ("questionText", e.target.value)}
                className={textareaCls}
                placeholder="Enter the question..."
              />
              {qErrors.questionText && (
                <p className="text-xs text-red-600 mt-1">
                  {qErrors.questionText}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Question Type
                </label>
                <select
                  value={newQ.questionType}
                  onChange={(e) => setQ("questionType", e.target.value)}
                  className={inputCls}
                  aria-label="select"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  value={newQ.points}
                  onChange={(e) => setQ("points", Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            {newQ.questionType === "multiple_choice" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  {newQ.options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 w-4 shrink-0">
                        {opt.id.toUpperCase()}
                      </span>
                      <input
                        value={opt.text}
                        onChange={(e) => updateOption(idx, e.target.value)}
                        className={inputCls}
                        placeholder={`Option ${opt.id.toUpperCase()}`}
                      />
                    </div>
                  ))}
                </div>
                {qErrors.options && (
                  <p className="text-xs text-red-600 mt-1">{qErrors.options}</p>
                )}
              </div>
            )}

            {newQ.questionType === "true_false" ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Correct Answer <span className="text-red-500">*</span>
                </label>
                <select
                  value={newQ.correctAnswer}
                  onChange={(e) => setQ("correctAnswer", e.target.value)}
                  className={inputCls}
                  aria-label="select"
                >
                  <option value="">Select…</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
                {qErrors.correctAnswer && (
                  <p className="text-xs text-red-600 mt-1">
                    {qErrors.correctAnswer}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Correct Answer <span className="text-red-500">*</span>
                </label>
                <input
                  value={newQ.correctAnswer}
                  onChange={(e) => setQ("correctAnswer", e.target.value)}
                  className={inputCls}
                  placeholder={
                    newQ.questionType === "multiple_choice"
                      ? "e.g. A or the option text"
                      : "Expected answer"
                  }
                />
                {qErrors.correctAnswer && (
                  <p className="text-xs text-red-600 mt-1">
                    {qErrors.correctAnswer}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Explanation (optional)
              </label>
              <input
                value={newQ.explanation}
                onChange={(e) => setQ("explanation", e.target.value)}
                className={inputCls}
                placeholder="Why this answer is correct"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleAddQuestion}
              disabled={questionLoading}
              className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
            >
              {questionLoading ? "Adding..." : "Add Question →"}
            </button>
            <button
              onClick={onDone}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[#004900] text-[#004900] hover:bg-green-50"
            >
              Done ({questions.length} question
              {questions.length !== 1 ? "s" : ""})
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
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
  | { type: "edit"; module: Module }
  | { type: "delete"; module: Module }
  | { type: "addUnit"; module: Module }
  | { type: "addAssessment"; module: Module };

export default function ManageModules() {
  const [modules, setModules] = useState<Module[]>([]);
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
    setLoading(true);
    setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      const res = await fetch(`${BASE}admin/modules`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load modules");
      setModules(
        Array.isArray(data) ? data : data.data ?? data.modules ?? []
      );
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}admin/modules/${modal.module.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Modules</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Modules belong to tracks and group related units
            </p>
          </div>
          <span className="text-sm text-gray-400">
            {modules.length} module{modules.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading modules…
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button
                onClick={fetchModules}
                className="text-sm text-[#004900] underline"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !fetchError && modules.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              No modules found.
            </div>
          )}

          {!loading && !fetchError && modules.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">
                      ID
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Module Name
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Track
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {modules.map((mod) => (
                    <tr
                      key={mod.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                        {mod.id}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {mod.title}
                        </div>
                        {mod.shortDescription && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                            {mod.shortDescription}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {mod.track?.title ?? `Track #${mod.trackId}`}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <Badge status={mod.status} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 flex-wrap">

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
                              <path d="M9 11l3 3L22 4" />
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                            Add Assessment
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: "edit", module: mod })}
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
                            onClick={() => setModal({ type: "delete", module: mod })}
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
        <Modal
          title={`Edit Module — ${modal.module.title}`}
          onClose={closeModal}
        >
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
        <Modal
          title={`Add Unit to "${modal.module.title}"`}
          onClose={closeModal}
        >
          <AddUnitForm
            moduleId={modal.module.id}
            onDone={() => {
              closeModal();
              showToast("Unit created successfully");
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
              showToast("Assessment saved successfully");
            }}
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
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 ${
            toast.type === "error" ? "bg-red-600" : "bg-[#004900]"
          } text-white`}
        >
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