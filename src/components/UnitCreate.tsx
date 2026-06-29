import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor"

const BASE = import.meta.env.VITE_BASE_URL;

type UnitForm = {
  moduleId: string;
  title: string;
  description: string;
  content: string;
  summary: string;
  caseStudy: string;
  discussionPrompt: string;
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

const uploadToCloudinary = async (file: File, folder: string = "curriculum"): Promise<string> => {
  const API_KEY = import.meta.env.VITE_API_KEY;
  const API_SECRET = import.meta.env.VITE_API_SECRET_KEY;
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!API_KEY || !API_SECRET || !CLOUD_NAME) throw new Error("Cloudinary credentials missing");

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signatureString = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
  const signature = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signatureHex);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
};

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const MAX_VIDEO_SIZE_MB = 200;
const MAX_PDF_SIZE_MB = 25;

export default function UnitCreate({ onComplete }: { onComplete?: () => void }) {
  const [form, setForm] = useState<UnitForm>({
    moduleId: "",
    title: "",
    description: "",
    content: "",
    summary: "",
    caseStudy: "",
    discussionPrompt: "",
    estimatedReadMinutes: "0",
    passMarkPercent: "60",
    maxAttempts: "3",
    status: "draft",
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors<UnitForm> & { video?: string; pdf?: string }>({});
  const [loading, setLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string>("");
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const set = (key: keyof UnitForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setVideoFile(null);
      return;
    }
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, video: "Unsupported video format" }));
      setVideoFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, video: `Video must be under ${MAX_VIDEO_SIZE_MB}MB` }));
      setVideoFile(null);
      e.target.value = "";
      return;
    }
    setErrors((prev) => ({ ...prev, video: undefined }));
    setVideoFile(file);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setPdfFile(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setErrors((prev) => ({ ...prev, pdf: "File must be a PDF" }));
      setPdfFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, pdf: `PDF must be under ${MAX_PDF_SIZE_MB}MB` }));
      setPdfFile(null);
      e.target.value = "";
      return;
    }
    setErrors((prev) => ({ ...prev, pdf: undefined }));
    setPdfFile(file);
  };

  const validate = (): boolean => {
    const e: FormErrors<UnitForm> = {};
    if (!form.moduleId.trim() || isNaN(Number(form.moduleId))) e.moduleId = "Valid Module ID is required";
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.estimatedReadMinutes === "" || isNaN(Number(form.estimatedReadMinutes)))
      e.estimatedReadMinutes = "Must be a valid number";
    const pmp = Number(form.passMarkPercent);
    if (isNaN(pmp) || pmp < 0 || pmp > 100) e.passMarkPercent = "Must be 0–100";
    const ma = Number(form.maxAttempts);
    if (isNaN(ma) || ma < 1) e.maxAttempts = "Must be at least 1";
    setErrors((prev) => ({ ...prev, ...e }));
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
    let videoUrl: string | undefined;
    let pdfUrl: string | undefined;

    try {
      if (videoFile) {
        setUploadStage("Uploading video...");
        videoUrl = await uploadToCloudinary(videoFile, "videos");
      }
      if (pdfFile) {
        setUploadStage("Uploading PDF...");
        pdfUrl = await uploadToCloudinary(pdfFile, "pdfs");
      }

      setUploadStage("Saving unit...");
      const res = await fetch(`${BASE}admin/modules/${form.moduleId}/units`, {
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
          videoUrl,
          pdfUrl,
          estimatedReadMinutes: Number(form.estimatedReadMinutes),
          passMarkPercent: Number(form.passMarkPercent),
          maxAttempts: Number(form.maxAttempts),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create unit");

      setToast(`Unit "${form.title}" created successfully`);
      setTimeout(() => {
        setToast(null);
        if (onComplete) onComplete();
      }, 3000);

      // Reset form (keep moduleId so admin can add the next unit to the same module)
      setForm({
        moduleId: form.moduleId,
        title: "",
        description: "",
        content: "",
        summary: "",
        caseStudy: "",
        discussionPrompt: "",
        estimatedReadMinutes: "0",
        passMarkPercent: "60",
        maxAttempts: "3",
        status: "draft",
      });
      setVideoFile(null);
      setPdfFile(null);
      setErrors({});
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
      setUploadStage("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-6">
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
            </div>

            <Field label="Description" required error={errors.description}>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of this unit"
                className={textareaCls}
              />
            </Field>

            <Field label="Content">
              <RichTextEditor
                value={form.content}
                onChange={(html) => set("content", html)}
                placeholder="Main learning content for this unit"
                className={textareaCls}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Summary">
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  placeholder="Key takeaways (optional)"
                  className={textareaCls}
                />
              </Field>
              <Field label="Case Study">
                <textarea
                  rows={3}
                  value={form.caseStudy}
                  onChange={(e) => set("caseStudy", e.target.value)}
                  placeholder="Real-world case study (optional)"
                  className={textareaCls}
                />
              </Field>
            </div>

            <Field label="Discussion Prompt">
              <textarea
                rows={2}
                value={form.discussionPrompt}
                onChange={(e) => set("discussionPrompt", e.target.value)}
                placeholder="Reflection or discussion question (optional)"
                className={textareaCls}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Video file" error={errors.video}>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVideoChange}
                  className={inputCls}
                  aria-label="Video file"
                />
                {videoFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </p>
                )}
              </Field>
              <Field label="PDF file" error={errors.pdf}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className={inputCls}
                  aria-label="PDF file"
                />
                {pdfFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </p>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Estimated Read (mins)" error={errors.estimatedReadMinutes}>
                <input
                  type="number"
                  min="0"
                  value={form.estimatedReadMinutes}
                  onChange={(e) => set("estimatedReadMinutes", e.target.value)}
                  className={inputCls}
                  aria-label="Estimated read minutes"
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
                  aria-label="Pass mark percent"
                />
              </Field>
              <Field label="Max Attempts" error={errors.maxAttempts}>
                <input
                  type="number"
                  min="1"
                  value={form.maxAttempts}
                  onChange={(e) => set("maxAttempts", e.target.value)}
                  className={inputCls}
                  aria-label="Max attempts"
                />
              </Field>
            </div>

            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className={inputCls}
                aria-label="Status"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-[#004900] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
            >
              {loading ? uploadStage || "Creating unit..." : "Create Unit →"}
            </button>
          </form>
        </Section>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}