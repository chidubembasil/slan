import { useState, useEffect, useCallback, useRef } from "react";
import TrackCreate from "./TrackCreate";

const BASE = import.meta.env.VITE_BASE_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_API_SECRET_KEY;

type CourseStatus = "draft" | "published" | "archived";

type Course = {
  id: number;
  title: string;
  shortDescription: string;
  status: CourseStatus;
  thumbnail?: string;
  trackCount?: number;
};

// ── helpers ───────────────────────────────────────────────────────────────────

const statusBadge: Record<CourseStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: CourseStatus }) {
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
        <p className="text-sm text-gray-700 mb-6">{message}</p>
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

// ── shared input styles ───────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

// ── edit course form ──────────────────────────────────────────────────────────

function EditCourseForm({ course, onDone }: { course: Course; onDone: () => void }) {
  const [form, setForm] = useState({
    title: course.title,
    shortDescription: course.shortDescription,
    description: "",
    status: course.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setError("Not authenticated"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          shortDescription: form.shortDescription,
          description: form.description || undefined,
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
        <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} aria-label="input" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Short Description</label>
        <input value={form.shortDescription} onChange={e => set("shortDescription", e.target.value)} className={inputCls} aria-label="input" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} aria-label="input" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls} aria-label="select">
          {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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

// ── assessment modal ──────────────────────────────────────────────────────────

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

const emptyQuestion = (): SingleQuestion => ({
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
  orderIndex: 0,
  points: 1,
});

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
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question {index + 1}</span>
        {showRemove && (
          <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">Remove</button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Question Text <span className="text-red-500">*</span></label>
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
          <select value={q.questionType} onChange={e => set("questionType", e.target.value)} className={inputCls} title="select">
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Points</label>
          <input type="number" min={1} value={q.points} onChange={e => set("points", Number(e.target.value))} className={inputCls} title="input"/>
        </div>
      </div>

      {q.questionType === "multiple_choice" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Options</label>
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-gray-400 w-4">{opt.id.toUpperCase()}</span>
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Correct Answer</label>
          <select value={q.correctAnswer} onChange={e => set("correctAnswer", e.target.value)} className={inputCls} title="select">
            <option value="">Select…</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      )}

      {q.questionType === "multiple_choice" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Correct Answer</label>
          <select value={q.correctAnswer} onChange={e => set("correctAnswer", e.target.value)} className={inputCls} title="select">
            <option value="">Select option…</option>
            {q.options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.id.toUpperCase()} — {opt.text || "(empty)"}</option>
            ))}
          </select>
        </div>
      )}

      {q.questionType === "short_answer" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Correct Answer</label>
          <input value={q.correctAnswer} onChange={e => set("correctAnswer", e.target.value)} className={inputCls} placeholder="Expected answer" />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Explanation <span className="text-gray-400">(optional)</span></label>
        <input value={q.explanation} onChange={e => set("explanation", e.target.value)} className={inputCls} placeholder="Why this is the correct answer" />
      </div>
    </div>
  );
}

async function uploadToCloudinary(file: File, folder: string = "assessments"): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
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
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
    { method: "POST", body: formData }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Cloudinary upload failed");
  return data.secure_url as string;
}

type AssessmentStep = 1 | 2;

function AddAssessmentModal({
  course,
  onClose,
  onSuccess,
}: {
  course: Course;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [step, setStep] = useState<AssessmentStep>(1);

  // Step 1 — assessment config
  const [config, setConfig] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 30,
    isActive: false,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  // Step 2 — questions
  const [mode, setMode] = useState<QuestionMode>("single");
  const [questions, setQuestions] = useState<SingleQuestion[]>([emptyQuestion()]);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState("");

  const setC = (k: keyof typeof config, v: any) => setConfig(f => ({ ...f, [k]: v }));

  // ── Step 1: Save assessment config ─────────────────────────────────────────
  const handleSaveConfig = async () => {
    if (!config.title.trim()) { setConfigError("Title is required"); return; }
    if (!config.description.trim()) { setConfigError("Description is required"); return; }
    setConfigError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setConfigError("Not authenticated"); return; }
    setConfigLoading(true);
    try {
      const res = await fetch(`${BASE}admin/courses/${course.id}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      if (!res.ok) throw new Error(data.message || "Failed to create assessment");
      // Store the assessment/parentId for step 2
      const id = data?.data?.id ?? data?.id ?? data?.assessment?.id ?? null;
      setAssessmentId(id);
      setStep(2);
    } catch (err: any) {
      setConfigError(err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  // ── Step 2: Submit questions ────────────────────────────────────────────────
  const handleSubmitQuestions = async () => {
    setQError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) { setQError("Not authenticated"); return; }

    const parentId = assessmentId;
    const parentType = "course_assessment";

    setQLoading(true);
    try {
      if (mode === "single") {
        // Single question
        const q = questions[0];
        const res = await fetch(`${BASE}admin/assessment-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            parentId,
            parentType,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.questionType === "multiple_choice" ? q.options.filter(o => o.text.trim()) : undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || undefined,
            orderIndex: q.orderIndex,
            points: q.points,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to add question");

      } else if (mode === "bulk") {
        // Bulk JSON
        const res = await fetch(`${BASE}admin/assessment-items/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            parentId,
            parentType,
            questions: questions.map(q => ({
              questionText: q.questionText,
              questionType: q.questionType,
              options: q.questionType === "multiple_choice" ? q.options.filter(o => o.text.trim()) : undefined,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || undefined,
              orderIndex: q.orderIndex,
              points: q.points,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Bulk upload failed");

      } else if (mode === "file") {
        // File upload: upload to Cloudinary first, then send URL to backend
        if (!fileRef) { setQError("Please select a CSV or Excel file"); setQLoading(false); return; }

        // 1. Upload file to Cloudinary
        const cloudinaryUrl = await uploadToCloudinary(fileRef);

        // 2. Send the Cloudinary URL to the backend
        const res = await fetch(`${BASE}admin/assessment-items/bulk-upload`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            Authorization: `Bearer ${token}` 
          },
          credentials: "include",
          body: JSON.stringify({
            parentId,
            parentType,
            fileUrl: cloudinaryUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "File upload failed");
      }

      onSuccess("Assessment and questions saved successfully!");
      onClose();
    } catch (err: any) {
      setQError(err.message);
    } finally {
      setQLoading(false);
    }
  };

  const addQuestion = () => setQuestions(qs => [...qs, { ...emptyQuestion(), orderIndex: qs.length }]);
  const removeQuestion = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, q: SingleQuestion) => setQuestions(qs => qs.map((old, idx) => idx === i ? q : old));

  return (
    <Modal title={`Add Assessment to "${course.title}"`} onClose={onClose} wide>
      {/* Step tabs */}
      <div className="flex gap-0 mb-6 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => step === 2 && setStep(1)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${step === 1 ? "bg-[#004900] text-white" : "bg-white text-gray-400 cursor-pointer hover:bg-gray-50"}`}
        >
          1 · Assessment Details
        </button>
        <button
          disabled={step === 1 && !assessmentId}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${step === 2 ? "bg-[#004900] text-white" : "bg-white text-gray-400"} disabled:cursor-not-allowed`}
        >
          2 · Questions
        </button>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
            <input
              value={config.title}
              onChange={e => setC("title", e.target.value)}
              placeholder="e.g. Course Final Assessment"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={config.description}
              onChange={e => setC("description", e.target.value)}
              placeholder="What this assessment covers"
              className={textareaCls}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Pass Mark %</label>
              <input
                type="number" min={0} max={100}
                value={config.passMarkPercent}
                onChange={e => setC("passMarkPercent", Number(e.target.value))}
                className={inputCls}
                title="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Max Attempts</label>
              <input
                type="number" min={1}
                value={config.maxAttempts}
                onChange={e => setC("maxAttempts", Number(e.target.value))}
                className={inputCls}
                title="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Time Limit (mins)</label>
              <input
                type="number" min={0}
                value={config.timeLimitMinutes}
                onChange={e => setC("timeLimitMinutes", Number(e.target.value))}
                className={inputCls}
                title="input"
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
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Mode selector */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">How do you want to add questions?</p>
            <div className="grid grid-cols-3 gap-2">
              {(["single", "bulk", "file"] as QuestionMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    if (m !== "file") setQuestions([emptyQuestion()]);
                    setFileRef(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                    mode === m
                      ? "border-[#004900] bg-[#004900]/5 text-[#004900]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {m === "single" && "Single Choice"}
                  {m === "bulk" && "Multiple Choices"}
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
                <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["question_text", "question_type", "correct_answer"].map(col => (
                    <code key={col} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{col}</code>
                  ))}
                </div>
                <p className="text-xs font-semibold text-blue-700 mt-2.5 mb-1.5">Optional columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["option_a", "option_b", "option_c", "option_d", "explanation", "points"].map(col => (
                    <code key={col} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{col}</code>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  <strong>question_type</strong> values: multiple_choice, true_false, short_answer<br />
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
              {qLoading ? "Submitting…" : mode === "file" ? "Upload & Save" : "Save Questions"}
            </button>
            <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
              ← Back
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "addTrack"; course: Course }
  | { type: "addAssessment"; course: Course }
  | { type: "edit"; course: Course }
  | { type: "view"; course: Course }
  | { type: "delete"; course: Course };

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      const res = await fetch(`${BASE}admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load courses");
      setCourses(Array.isArray(data) ? data : data.data ?? data.courses ?? []);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}admin/courses/${modal.course.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      setModal({ type: "none" });
      showToast(`Course "${modal.course.title}" deleted`);
      fetchCourses();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Courses</h1>
            <p className="text-sm text-gray-500 mt-0.5">Top-level containers for the SLAN curriculum</p>
          </div>
          <span className="text-sm text-gray-400">{courses.length} course{courses.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading courses…
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button onClick={fetchCourses} className="text-sm text-[#004900] underline">Retry</button>
            </div>
          )}

          {!loading && !fetchError && courses.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              No courses found.
            </div>
          )}

          {!loading && !fetchError && courses.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">ID</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course Name</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tracks</th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{course.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{course.title}</div>
                        {course.shortDescription && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                            {course.shortDescription}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={course.status} />
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {course.trackCount ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 flex-wrap">

                          {/* Add Track */}
                          <button
                            onClick={() => setModal({ type: "addTrack", course })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#004900] text-white hover:bg-[#003700] transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Track
                          </button>

                          {/* Add Assessment */}
                          <button
                            onClick={() => setModal({ type: "addAssessment", course })}
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

                          {/* View */}
                          <button
                            onClick={() => setModal({ type: "view", course })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: "edit", course })}
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
                            onClick={() => setModal({ type: "delete", course })}
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

      {/* ── Add Track Modal ── */}
      {modal.type === "addTrack" && (
        <Modal
          title={`Add Track to "${modal.course.title}"`}
          onClose={() => setModal({ type: "none" })}
        >
          <TrackCreate
            courseId={modal.course.id}
            onComplete={() => {
              setModal({ type: "none" });
              showToast("Track added successfully");
              fetchCourses();
            }}
            onCancel={() => setModal({ type: "none" })}
          />
        </Modal>
      )}

      {/* ── Add Assessment Modal ── */}
      {modal.type === "addAssessment" && (
        <AddAssessmentModal
          course={modal.course}
          onClose={() => setModal({ type: "none" })}
          onSuccess={(msg) => {
            setModal({ type: "none" });
            showToast(msg);
            fetchCourses();
          }}
        />
      )}

      {/* ── Edit Modal ── */}
      {modal.type === "edit" && (
        <Modal
          title={`Edit Course — ${modal.course.title}`}
          onClose={() => setModal({ type: "none" })}
        >
          <EditCourseForm
            course={modal.course}
            onDone={() => {
              setModal({ type: "none" });
              showToast("Course updated");
              fetchCourses();
            }}
          />
        </Modal>
      )}

      {/* ── View Modal ── */}
      {modal.type === "view" && (
        <Modal
          title="Course Details"
          onClose={() => setModal({ type: "none" })}
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">ID</p>
                <p className="font-mono font-medium text-gray-800">{modal.course.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <Badge status={modal.course.status} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Title</p>
              <p className="font-medium text-gray-800">{modal.course.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Short Description</p>
              <p className="text-gray-700">{modal.course.shortDescription || "—"}</p>
            </div>
            {modal.course.thumbnail && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Thumbnail</p>
                <img src={modal.course.thumbnail} alt="thumbnail"
                  className="w-full max-w-xs rounded-xl object-cover border border-gray-100" />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.course.title}"? This will cascade and remove all its tracks, modules, and units.`}
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