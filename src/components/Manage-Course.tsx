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
  published: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  archived: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

function Badge({ status }: { status: CourseStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold capitalize shadow-sm ${statusBadge[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto`}>
        <div className="bg-gradient-to-r from-[#004900] to-[#006400] px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <h2 className="text-white font-semibold text-sm sm:text-base pr-4 leading-tight">{title}</h2>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors text-sm leading-none">✕</button>
        </div>
        <div className="p-4 sm:p-6 lg:p-7">{children}</div>
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto sm:mx-0 mb-3 sm:mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
        </div>
        <p className="text-sm text-gray-700 mb-6 leading-relaxed text-center sm:text-left">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium order-2 sm:order-1">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 font-medium shadow-md shadow-red-200 order-1 sm:order-2">
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── shared input styles ───────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm placeholder:text-gray-400";
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
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} aria-label="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Short Description</label>
          <input value={form.shortDescription} onChange={e => set("shortDescription", e.target.value)} className={inputCls} aria-label="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
          <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} aria-label="input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls} aria-label="select">
              {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button onClick={handleSave} disabled={loading}
          className="bg-gradient-to-r from-[#004900] to-[#006400] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 shadow-md shadow-[#004900]/20 transition-all w-full sm:w-auto">
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
function buildOptionsAndAnswer(q: SingleQuestion) {
  if (q.questionType !== "multiple_choice") {
    return { options: undefined as string[] | undefined, correctAnswer: q.correctAnswer };
  }
  const filledOptions = q.options.filter(o => o.text.trim());
  const correctIndex = filledOptions.findIndex(o => o.id === q.correctAnswer);
  return {
    options: filledOptions.map(o => o.text),
    correctAnswer: correctIndex >= 0 ? correctIndex : 0,
  };
}

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
    <div className="border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#004900] uppercase tracking-wide bg-[#004900]/5 px-2.5 py-1 rounded-full">Question {index + 1}</span>
        {showRemove && (
          <button onClick={onRemove} className="text-xs font-medium text-red-500 hover:text-red-700 px-2.5 py-1 rounded-full hover:bg-red-50 transition-colors">Remove</button>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Question Text <span className="text-red-500">*</span></label>
        <textarea
          rows={2}
          value={q.questionText}
          onChange={e => set("questionText", e.target.value)}
          className={textareaCls}
          placeholder="Enter question..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Type</label>
          <select value={q.questionType} onChange={e => set("questionType", e.target.value)} className={inputCls} title="select">
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Points</label>
          <input type="number" min={1} value={q.points} onChange={e => set("points", Number(e.target.value))} className={inputCls} title="input"/>
        </div>
      </div>

      {q.questionType === "multiple_choice" && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Options</label>
          <div className="grid grid-cols-1 gap-2">
            {q.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-gray-400 w-5 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">{opt.id.toUpperCase()}</span>
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
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Correct Answer</label>
          <select value={q.correctAnswer} onChange={e => set("correctAnswer", e.target.value)} className={inputCls} title="select">
            <option value="">Select…</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      )}

      {q.questionType === "multiple_choice" && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Correct Answer</label>
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
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Correct Answer</label>
          <input value={q.correctAnswer} onChange={e => set("correctAnswer", e.target.value)} className={inputCls} placeholder="Expected answer" />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Explanation <span className="text-gray-400 font-normal">(optional)</span></label>
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
        const { options, correctAnswer } = buildOptionsAndAnswer(q);
        const res = await fetch(`${BASE}admin/assessment-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            parentId,
            parentType,
            questionText: q.questionText,
            questionType: q.questionType,
            options,
            correctAnswer,
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
    questions: questions.map(q => {
      const { options, correctAnswer } = buildOptionsAndAnswer(q);
      return {
        questionText: q.questionText,
        questionType: q.questionType,
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
      <div className="flex flex-col sm:flex-row gap-0 mb-6 border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => step === 2 && setStep(1)}
          className={`flex-1 py-2.5 sm:py-3 px-4 text-sm font-semibold transition-colors ${step === 1 ? "bg-gradient-to-r from-[#004900] to-[#006400] text-white shadow-sm" : "bg-white text-gray-400 cursor-pointer hover:bg-gray-50"}`}
        >
          1 · Assessment Details
        </button>
        <button
          disabled={step === 1 && !assessmentId}
          className={`flex-1 py-2.5 sm:py-3 px-4 text-sm font-semibold transition-colors ${step === 2 ? "bg-gradient-to-r from-[#004900] to-[#006400] text-white shadow-sm" : "bg-white text-gray-400"} disabled:cursor-not-allowed`}
        >
          2 · Questions
        </button>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
              <input
                value={config.title}
                onChange={e => setC("title", e.target.value)}
                placeholder="e.g. Course Final Assessment"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                value={config.description}
                onChange={e => setC("description", e.target.value)}
                placeholder="What this assessment covers"
                className={textareaCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Time Limit (mins)</label>
              <input
                type="number" min={0}
                value={config.timeLimitMinutes}
                onChange={e => setC("timeLimitMinutes", Number(e.target.value))}
                className={inputCls}
                title="input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 w-fit">
            <input
              type="checkbox"
              checked={config.isActive}
              onChange={e => setC("isActive", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#004900]"
            />
            <span className="text-sm font-medium text-gray-700">Active immediately</span>
          </label>

          {configError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{configError}</p>}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={configLoading}
              className="bg-gradient-to-r from-[#004900] to-[#006400] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-[#004900]/20 transition-all w-full sm:w-auto"
            >
              {configLoading ? "Saving…" : "Save & Add Questions →"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium w-full sm:w-auto">
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
            <p className="text-xs font-semibold text-gray-700 mb-2">How do you want to add questions?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {(["single", "bulk", "file"] as QuestionMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    if (m !== "file") setQuestions([emptyQuestion()]);
                    setFileRef(null);
                  }}
                  className={`py-3 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    mode === m
                      ? "border-[#004900] bg-[#004900]/5 text-[#004900] shadow-sm"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
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
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:border-[#004900]/40 hover:text-[#004900] hover:bg-[#004900]/5 transition-colors"
                >
                  + Add Another Question
                </button>
              )}
            </div>
          )}

          {/* File upload mode */}
          {mode === "file" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 sm:p-8 text-center hover:border-[#004900]/30 transition-colors bg-gray-50/30">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-3">
                  <svg className="text-gray-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <polyline points="9 14 12 11 15 14" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium break-all px-2">
                  {fileRef ? fileRef.name : "Drop a CSV or Excel file here, or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mb-4">Max 5 MB · .csv, .xlsx</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#004900] to-[#006400] text-white hover:from-[#003700] hover:to-[#004900] shadow-md shadow-[#004900]/20 transition-all"
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

              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5">
                <p className="text-xs font-bold text-blue-700 mb-1.5">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["question_text", "question_type", "correct_answer"].map(col => (
                    <code key={col} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">{col}</code>
                  ))}
                </div>
                <p className="text-xs font-bold text-blue-700 mt-3 mb-1.5">Optional columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["option_a", "option_b", "option_c", "option_d", "explanation", "points"].map(col => (
                    <code key={col} className="bg-white text-blue-700 border border-blue-100 px-2 py-1 rounded-full text-xs font-medium">{col}</code>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-3 leading-relaxed">
                  <strong>question_type</strong> values: multiple_choice, true_false, short_answer<br />
                  <strong>correct_answer</strong>: a / b / c / d for MCQ; true / false for true_false
                </p>
              </div>
            </div>
          )}

          {qError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{qError}</p>}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleSubmitQuestions}
              disabled={qLoading}
              className="bg-gradient-to-r from-[#004900] to-[#006400] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 shadow-md shadow-[#004900]/20 transition-all order-1 sm:order-1 w-full sm:w-auto"
            >
              {qLoading ? "Submitting…" : mode === "file" ? "Upload & Save" : "Save Questions"}
            </button>
            <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium order-2 sm:order-2 w-full sm:w-auto">
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
  const [selectedCourseId, setSelectedCourseId] = useState<number | "all">("all");
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

  const filteredCourses = selectedCourseId === "all"
    ? courses
    : courses.filter((c) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="hidden sm:flex w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#004900] to-[#006400] items-center justify-center shadow-md shadow-[#004900]/20 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Manage Courses</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Top-level containers for the SLAN curriculum</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {!loading && !fetchError && courses.length > 0 && (
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="w-full sm:w-auto sm:min-w-[180px] px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm"
                  aria-label="Filter by course"
                >
                  <option value="all">All courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
              <span className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3 text-gray-400 text-sm px-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
              Loading courses...
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3 px-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <p className="text-sm text-red-600 text-center">{fetchError}</p>
              <button onClick={fetchCourses} className="text-sm font-medium text-[#004900] hover:underline">Retry</button>
            </div>
          )}

          {!loading && !fetchError && filteredCourses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3 px-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600">{courses.length === 0 ? "No courses found" : "No course matches this selection"}</p>
                <p className="text-xs text-gray-400 mt-1">{courses.length === 0 ? "Create your first course to get started." : "Try changing the filter."}</p>
              </div>
            </div>
          )}

          {!loading && !fetchError && filteredCourses.length > 0 && (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="text-left px-4 lg:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">ID</th>
                      <th className="text-left px-4 lg:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Course Name</th>
                      <th className="text-left px-4 lg:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 lg:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Tracks</th>
                      <th className="text-right px-4 lg:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCourses.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-4 lg:px-6 py-4 text-gray-400 font-mono text-xs">{course.id}</td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="font-semibold text-gray-900 group-hover:text-[#004900] transition-colors line-clamp-1">{course.title}</div>
                          {course.shortDescription && (
                            <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-sm">
                              {course.shortDescription}
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <Badge status={course.status} />
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-600">
                            {course.trackCount ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5 lg:gap-2 flex-wrap">
                            {/* Add Track */}
                            <button
                              onClick={() => setModal({ type: "addTrack", course })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#004900] to-[#006400] text-white hover:from-[#003700] hover:to-[#004900] shadow-sm shadow-[#004900]/20 transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              Add Track
                            </button>
                            {/* View */}
                            <button
                              onClick={() => setModal({ type: "view", course })}
                              className="inline-flex items-center gap-1 lg:gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span className="hidden lg:inline">View</span>
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => setModal({ type: "edit", course })}
                              className="inline-flex items-center gap-1 lg:gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span className="hidden lg:inline">Edit</span>
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setModal({ type: "delete", course })}
                              className="inline-flex items-center gap-1 lg:gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                              <span className="hidden lg:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredCourses.map((course) => (
                  <div key={course.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">#{course.id}</span>
                          <Badge status={course.status} />
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight break-words">{course.title}</h3>
                        {course.shortDescription && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.shortDescription}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">Tracks: <span className="font-semibold text-gray-600">{course.trackCount ?? "—"}</span></p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setModal({ type: "addTrack", course })} className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#004900] to-[#006400] text-white shadow-sm">+ Add Track</button>
                      <button onClick={() => setModal({ type: "view", course })} className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 bg-white">View</button>
                      <button onClick={() => setModal({ type: "edit", course })} className="px-3 py-2 rounded-xl text-xs font-semibold border border-blue-200 text-blue-600 bg-blue-50/50">Edit</button>
                      <button onClick={() => setModal({ type: "delete", course })} className="col-span-2 px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-600 bg-red-50/50">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">ID</p>
                <p className="font-mono font-semibold text-gray-800 text-sm">{modal.course.id}</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Status</p>
                <Badge status={modal.course.status} />
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title</p>
              <p className="font-semibold text-gray-900 break-words">{modal.course.title}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Short Description</p>
              <p className="text-gray-700 leading-relaxed break-words">{modal.course.shortDescription || "—"}</p>
            </div>
            {modal.course.thumbnail && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Thumbnail</p>
                <img src={modal.course.thumbnail} alt="thumbnail"
                  className="w-full rounded-2xl object-cover border border-gray-100 shadow-sm max-h-64" />
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
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-[#004900] to-[#006400] text-white px-4 sm:px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50 max-w-[calc(100vw-2rem)]">
          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-xs sm:text-sm font-medium leading-tight">{toast}</span>
        </div>
      )}
    </div>
  );
}
