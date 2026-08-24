import { useState } from "react";
import RichTextEditor from "./RichTextEditor";
import {
  BookOpen,
  FileText,
  Video,
  Clock,
  Trophy,
  Repeat,
  BadgeCheck,
  AlertCircle,
  Check,
  X,
  Loader2,
  GraduationCap,
  Layers,
} from "lucide-react";

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

function Field({ label, error, required, children, icon }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
        {icon}
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 flex items-center gap-1 mt-1"><AlertCircle size={12} />{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 sm:px-3.5 py-2.5 sm:py-3 border border-gray-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all placeholder:text-gray-400 shadow-sm";
const textareaCls = "w-full px-3 sm:px-3.5 py-2.5 sm:py-3 border border-gray-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] resize-none transition-all placeholder:text-gray-400 shadow-sm";

function Section({ number, title, subtitle, children }: {
  number: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#004900] via-[#005a00] to-[#006400] px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 flex items-center gap-3 sm:gap-4">
        <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0 border border-white/10">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-white font-bold text-base sm:text-lg lg:text-xl tracking-tight">{title}</h2>
          <p className="text-white/70 text-xs sm:text-sm mt-0.5">{subtitle}</p>
        </div>
        <div className="hidden sm:flex ml-auto w-10 h-10 rounded-xl bg-white/10 items-center justify-center">
          <GraduationCap size={20} className="text-white/80" />
        </div>
      </div>
      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 bg-gradient-to-r from-[#004900] to-[#006400] text-white px-4 sm:px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 z-50">
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
        <Check size={16} className="text-white" />
      </div>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors shrink-0">
        <X size={14} />
      </button>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 -m-4 md:-m-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#004900] to-[#006400] flex items-center justify-center shadow-sm shrink-0">
              <Layers size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Create New Unit</h1>
              <p className="text-xs sm:text-sm text-gray-500">Add a learning unit to an existing module</p>
            </div>
          </div>
          <div className="hidden sm:flex ml-auto items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <BookOpen size={14} className="text-[#004900]" />
            Unit • Module • Track • Course
          </div>
        </div>

        <Section number="3" title="Create Unit" subtitle="Belongs to a module — the smallest unit of learning content">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <Field label="Module ID" required error={errors.moduleId} icon={<Layers size={14} className="text-[#004900]" />}>
              <input
                type="number"
                min="1"
                value={form.moduleId}
                onChange={(e) => set("moduleId", e.target.value)}
                placeholder="Enter the ID of the parent module"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
              <div className="lg:col-span-3">
                <Field label="Title" required error={errors.title} icon={<BookOpen size={14} className="text-[#004900]" />}>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="e.g. What is Instructional Leadership?"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Status" required icon={<BadgeCheck size={14} className="text-[#004900]" />}>
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
              </div>
            </div>

            <Field label="Description" required error={errors.description} icon={<FileText size={14} className="text-gray-400" />}>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of this unit"
                className={textareaCls}
              />
            </Field>

            <Field label="Content" icon={<FileText size={14} className="text-[#004900]" />}>
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => set("content", html)}
                  placeholder="Main learning content for this unit"
                />
              </div>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <Field label="Summary" icon={<FileText size={14} className="text-gray-400" />}>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  placeholder="Key takeaways (optional)"
                  className={textareaCls}
                />
              </Field>
              <Field label="Case Study" icon={<BookOpen size={14} className="text-gray-400" />}>
                <textarea
                  rows={3}
                  value={form.caseStudy}
                  onChange={(e) => set("caseStudy", e.target.value)}
                  placeholder="Real-world case study (optional)"
                  className={textareaCls}
                />
              </Field>
            </div>

            <Field label="Discussion Prompt" icon={<BookOpen size={14} className="text-gray-400" />}>
              <textarea
                rows={2}
                value={form.discussionPrompt}
                onChange={(e) => set("discussionPrompt", e.target.value)}
                placeholder="Reflection or discussion question (optional)"
                className={textareaCls}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <Field label="Video file" error={errors.video} icon={<Video size={14} className="text-purple-600" />}>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVideoChange}
                  className={`${inputCls} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:text-xs file:font-semibold hover:file:bg-purple-100 file:transition-colors`}
                  aria-label="Video file"
                />
                {videoFile && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                    <Video size={12} className="text-purple-600 shrink-0" />
                    <span className="truncate">{videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                  </p>
                )}
              </Field>
              <Field label="PDF file" error={errors.pdf} icon={<FileText size={14} className="text-red-500" />}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className={`${inputCls} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:text-xs file:font-semibold hover:file:bg-red-100 file:transition-colors`}
                  aria-label="PDF file"
                />
                {pdfFile && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <FileText size={12} className="text-red-600 shrink-0" />
                    <span className="truncate">{pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                  </p>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              <Field label="Estimated Read (mins)" error={errors.estimatedReadMinutes} icon={<Clock size={14} className="text-gray-500" />}>
                <input
                  type="number"
                  min="0"
                  value={form.estimatedReadMinutes}
                  onChange={(e) => set("estimatedReadMinutes", e.target.value)}
                  className={inputCls}
                  aria-label="Estimated read minutes"
                />
              </Field>
              <Field label="Pass Mark (%)" error={errors.passMarkPercent} icon={<Trophy size={14} className="text-amber-600" />}>
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
              <Field label="Max Attempts" error={errors.maxAttempts} icon={<Repeat size={14} className="text-blue-600" />}>
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

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#004900] to-[#006400] text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl text-sm font-semibold hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 shadow-sm transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {uploadStage || "Creating unit..."}
                  </>
                ) : (
                  <>
                    Create Unit
                    <span className="hidden sm:inline">→</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 self-center text-center sm:text-left px-2">
                Unit will be created under Module #{form.moduleId || "—"}
              </p>
            </div>
          </form>
        </Section>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
