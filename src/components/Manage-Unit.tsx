import { useState, useEffect, useCallback } from "react";
import RichTextEditor from "./RichTextEditor";
import {
  BookOpen,
  X,
  AlertTriangle,
  Check,
  AlertCircle,
  Clock,
  BadgeCheck,
  Trash2,
  Pencil,
  Video,
  FileText,
  Search,
  Filter,
  Loader2,
  GraduationCap,
} from "lucide-react";

const BASE = import.meta.env.VITE_BASE_URL;

type UnitStatus = "draft" | "published" | "archived";

type Unit = {
  id: number;
  title: string;
  description?: string;
  shortDescription?: string;
  content?: string;
  summary?: string;
  caseStudy?: string;
  discussionPrompt?: string;
  videoUrl?: string;
  pdfUrl?: string;
  estimatedReadMinutes?: number;
  status: UnitStatus;
  moduleId: number;
  module?: { id: number; title: string };
};

type Module = { id: number; title: string; trackId: number };
type Track = { id: number; title: string; courseId: number };
type Course = { id: number; title: string };

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 sm:px-3.5 py-2 sm:py-2.5 border border-gray-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all placeholder:text-gray-400";
const textareaCls = inputCls + " resize-none";
const statusOptions = ["draft", "published", "archived"] as const;

// ── Cloudinary upload helper ───────────────────────────────────────────────────

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

// ── Badge ─────────────────────────────────────────────────────────────────────

const statusBadge: Record<UnitStatus, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-gray-50 text-gray-600 border-gray-200",
};

function Badge({ status }: { status: UnitStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold capitalize border shadow-sm ${statusBadge[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 hidden sm:inline-block" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[#004900] to-[#006400] px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between shrink-0">
          <h2 className="text-white font-semibold text-sm sm:text-base truncate pr-3">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <p className="text-sm text-gray-700 leading-relaxed pt-1">{message}</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Unit Form ────────────────────────────────────────────────────────────

function EditUnitForm({
  unit,
  onDone,
}: {
  unit: Unit;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: unit.title,
    description: unit.description ?? "",
    content: unit.content ?? "",
    summary: unit.summary ?? "",
    caseStudy: unit.caseStudy ?? "",
    discussionPrompt: unit.discussionPrompt ?? "",
    estimatedReadMinutes: unit.estimatedReadMinutes ?? 0,
    status: unit.status,
  });

  // Existing media URLs (already on the unit) vs newly selected replacement files
  const [existingVideoUrl, setExistingVideoUrl] = useState(unit.videoUrl ?? "");
  const [existingPdfUrl, setExistingPdfUrl] = useState(unit.pdfUrl ?? "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof typeof form, string>> & { video?: string; pdf?: string }
  >({});

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setVideoFile(null);
      return;
    }
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, video: "Unsupported video format" }));
      setVideoFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, video: `Video must be under ${MAX_VIDEO_SIZE_MB}MB` }));
      setVideoFile(null);
      e.target.value = "";
      return;
    }
    setFormErrors((prev) => ({ ...prev, video: undefined }));
    setVideoFile(file);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setPdfFile(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setFormErrors((prev) => ({ ...prev, pdf: "File must be a PDF" }));
      setPdfFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, pdf: `PDF must be under ${MAX_PDF_SIZE_MB}MB` }));
      setPdfFile(null);
      e.target.value = "";
      return;
    }
    setFormErrors((prev) => ({ ...prev, pdf: undefined }));
    setPdfFile(file);
  };

  const validate = () => {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.content.trim()) e.content = "Content is required";
    setFormErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setError("");
    const token = localStorage.getItem("adminAccessToken");
    if (!token) {
      setError("Not authenticated");
      return;
    }
    setLoading(true);

    let videoUrl = existingVideoUrl || null;
    let pdfUrl = existingPdfUrl || null;

    try {
      if (videoFile) {
        setUploadStage("Uploading video...");
        videoUrl = await uploadToCloudinary(videoFile, "videos");
      }
      if (pdfFile) {
        setUploadStage("Uploading PDF...");
        pdfUrl = await uploadToCloudinary(pdfFile, "pdfs");
      }

      setUploadStage("Saving changes...");
      const res = await fetch(`${BASE}admin/units/${unit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          content: form.content,
          summary: form.summary || undefined,
          caseStudy: form.caseStudy || undefined,
          discussionPrompt: form.discussionPrompt || undefined,
          videoUrl,
          pdfUrl,
          estimatedReadMinutes: form.estimatedReadMinutes,
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
      setUploadStage("");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="Unit title"
        />
        {formErrors.title && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> {formErrors.title}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
          Description
        </label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={textareaCls}
          placeholder="Full description of this unit"
        />
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
          Content <span className="text-red-500">*</span>
        </label>
        <RichTextEditor
          value={form.content}
          onChange={(html: string) => set("content", html)}
          placeholder="Main learning content for this unit"
        />
        {formErrors.content && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> {formErrors.content}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
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
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
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
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Video size={14} className="text-purple-600" /> Video file
          </label>
          {existingVideoUrl && !videoFile && (
            <div className="flex items-center justify-between mb-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
              <a
                href={existingVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-purple-700 underline truncate max-w-[140px] sm:max-w-[160px]"
              >
                Current video
              </a>
              <button
                type="button"
                onClick={() => setExistingVideoUrl("")}
                className="text-xs font-medium text-red-600 hover:text-red-700 bg-white border border-red-100 px-2.5 py-1 rounded-lg shrink-0 ml-2"
              >
                Remove
              </button>
            </div>
          )}
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            onChange={handleVideoChange}
            className={`${inputCls} file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:text-xs file:font-medium hover:file:bg-purple-100`}
            aria-label="Video file"
          />
          {videoFile && (
            <p className="text-xs text-gray-500 mt-1.5 truncate">
              Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
            </p>
          )}
          {formErrors.video && (
            <p className="text-xs text-red-600 mt-1.5">{formErrors.video}</p>
          )}
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <FileText size={14} className="text-red-500" /> PDF file
          </label>
          {existingPdfUrl && !pdfFile && (
            <div className="flex items-center justify-between mb-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <a
                href={existingPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-red-700 underline truncate max-w-[140px] sm:max-w-[160px]"
              >
                Current PDF
              </a>
              <button
                type="button"
                onClick={() => setExistingPdfUrl("")}
                className="text-xs font-medium text-red-600 hover:text-red-700 bg-white border border-red-100 px-2.5 py-1 rounded-lg shrink-0 ml-2"
              >
                Remove
              </button>
            </div>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfChange}
            className={`${inputCls} file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:text-xs file:font-medium hover:file:bg-red-100`}
            aria-label="PDF file"
          />
          {pdfFile && (
            <p className="text-xs text-gray-500 mt-1.5 truncate">
              Selected: {pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(1)} MB)
            </p>
          )}
          {formErrors.pdf && (
            <p className="text-xs text-red-600 mt-1.5">{formErrors.pdf}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" /> Est. Read (mins)
          </label>
          <input
            type="number"
            min={0}
            value={form.estimatedReadMinutes}
            onChange={(e) => set("estimatedReadMinutes", Number(e.target.value))}
            className={inputCls}
            title="input"
          />
        </div>
        <div className="hidden lg:block" />
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <BadgeCheck size={14} className="text-gray-400" /> Status
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
      </div>

      <div className="lg:hidden">
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className={`${inputCls} lg:hidden`}
          aria-label="select"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs sm:text-sm text-red-700">{error}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full sm:w-auto bg-gradient-to-r from-[#004900] to-[#006400] text-white px-6 sm:px-7 py-2.5 sm:py-3 rounded-xl text-sm font-semibold hover:from-[#003700] hover:to-[#004900] disabled:opacity-60 shadow-sm transition-all inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {uploadStage || "Saving..."}
            </>
          ) : (
            <>
              <Check size={16} /> Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "edit"; unit: Unit }
  | { type: "delete"; unit: Unit };

export default function ManageUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Cascading filter selections
  const [selectedCourseId, setSelectedCourseId] = useState<number | "all">("all");
  const [selectedTrackId, setSelectedTrackId] = useState<number | "all">("all");
  const [selectedModuleId, setSelectedModuleId] = useState<number | "all">("all");
  const [selectedUnitId, setSelectedUnitId] = useState<number | "all">("all");

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [patchingId, setPatchingId] = useState<number | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      // 0. Fetch all courses
      const coursesRes = await fetch(`${BASE}admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const coursesData = await coursesRes.json();
      if (!coursesRes.ok)
        throw new Error(coursesData.message || "Failed to load courses");

      const allCourses: Course[] = Array.isArray(coursesData)
        ? coursesData
        : coursesData.data ?? coursesData.courses ?? [];
      setCourses(allCourses);

      // 1. Fetch all tracks
      const tracksRes = await fetch(`${BASE}admin/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const tracksData = await tracksRes.json();
      if (!tracksRes.ok)
        throw new Error(tracksData.message || "Failed to load tracks");

      const allTracks: Track[] = Array.isArray(tracksData)
        ? tracksData
        : tracksData.data ?? tracksData.tracks ?? [];

      setTracks(allTracks);

      if (allTracks.length === 0) {
        setModules([]);
        setUnits([]);
        return;
      }

      // 2. Fetch modules for each track in parallel
      const moduleResults = await Promise.all(
        allTracks.map((track) =>
          fetch(`${BASE}admin/tracks/${track.id}/modules`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          })
            .then((r) => r.json())
            .then((d) => {
              const mods: Module[] = Array.isArray(d)
                ? d
                : d.data ?? d.modules ?? [];
              return mods.map((m) => ({ ...m, trackId: track.id }));
            })
            .catch(() => [] as Module[])
        )
      );

      const allModules = moduleResults.flat();
      setModules(allModules);

      if (allModules.length === 0) {
        setUnits([]);
        return;
      }

      // 3. Fetch units for each module in parallel
      const unitResults = await Promise.all(
        allModules.map((mod) =>
          fetch(`${BASE}admin/modules/${mod.id}/units`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          })
            .then((r) => r.json())
            .then((d) => {
              const unitList: Unit[] = Array.isArray(d)
                ? d
                : d.data ?? d.units ?? [];
              return unitList.map((u) => ({
                ...u,
                module: u.module ?? { id: mod.id, title: mod.title },
                moduleId: u.moduleId ?? mod.id,
              }));
            })
            .catch(() => [] as Unit[])
        )
      );

      setUnits(unitResults.flat());
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}admin/units/${modal.unit.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      setModal({ type: "none" });
      showToast(`Unit "${modal.unit.title}" deleted`);
      fetchUnits();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handlePatchStatus = async (unit: Unit, newStatus: UnitStatus) => {
    const token = localStorage.getItem("adminAccessToken");
    setPatchingId(unit.id);
    try {
      const res = await fetch(`${BASE}admin/units/${unit.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Status update failed");
      }
      setUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, status: newStatus } : u))
      );
      showToast(`Status updated to ${newStatus}`);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setPatchingId(null);
    }
  };

  const closeModal = () => setModal({ type: "none" });

  // ── Cascading filter helpers ────────────────────────────────────────────────

  const handleCourseSelect = (value: string) => {
    setSelectedCourseId(value === "all" ? "all" : Number(value));
    setSelectedTrackId("all");
    setSelectedModuleId("all");
    setSelectedUnitId("all");
  };

  const handleTrackSelect = (value: string) => {
    setSelectedTrackId(value === "all" ? "all" : Number(value));
    setSelectedModuleId("all");
    setSelectedUnitId("all");
  };

  const handleModuleSelect = (value: string) => {
    setSelectedModuleId(value === "all" ? "all" : Number(value));
    setSelectedUnitId("all");
  };

  const handleUnitSelect = (value: string) => {
    setSelectedUnitId(value === "all" ? "all" : Number(value));
  };

  // Tracks available for the Track select, narrowed by the selected course
  const availableTracks =
    selectedCourseId === "all"
      ? tracks
      : tracks.filter((t) => t.courseId === selectedCourseId);

  // Modules available for the Module select, narrowed by selected track / course
  const availableModules = modules.filter((m) => {
    if (selectedTrackId !== "all") return m.trackId === selectedTrackId;
    if (selectedCourseId !== "all")
      return availableTracks.some((t) => t.id === m.trackId);
    return true;
  });

  // Units available for the Unit select, narrowed by selected module / track / course
  const availableUnits = units.filter((u) => {
    const modId = u.moduleId ?? u.module?.id;
    if (selectedModuleId !== "all") return modId === selectedModuleId;
    if (selectedTrackId !== "all" || selectedCourseId !== "all")
      return availableModules.some((m) => m.id === modId);
    return true;
  });

  // Final table output — narrowed further by the specific unit selection, if any
  const filteredUnits =
    selectedUnitId === "all"
      ? availableUnits
      : availableUnits.filter((u) => u.id === selectedUnitId);

  // Helper to resolve the track a given unit belongs to (via its module)
  const getTrackForUnit = (unit: Unit): Track | undefined => {
    const modId = unit.moduleId ?? unit.module?.id;
    const mod = modules.find((m) => m.id === modId);
    if (!mod) return undefined;
    return tracks.find((t) => t.id === mod.trackId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50 -m-3 sm:-m-4 md:-m-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 w-full overflow-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#004900] to-[#006400] flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight truncate">Manage Units</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                Units are the individual lessons inside a module
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-center shrink-0">
            <span className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 shadow-sm whitespace-nowrap">
              <BookOpen size={14} className="text-[#004900] hidden sm:block" />
              {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Cascading filters: Course → Track → Module → Unit */}
        {!loading && !fetchError && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
              <Filter size={16} className="text-[#004900]" />
              <p className="text-xs sm:text-sm font-semibold text-gray-700">Filters</p>
              <span className="text-xs text-gray-400 hidden sm:inline">— narrowing from course to unit</span>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => handleCourseSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm"
                  aria-label="Filter by course"
                >
                  <option value="all">All courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">Track</label>
                <select
                  value={selectedTrackId}
                  onChange={(e) => handleTrackSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm"
                  aria-label="Filter by track"
                >
                  <option value="all">All tracks</option>
                  {availableTracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">Module</label>
                <select
                  value={selectedModuleId}
                  onChange={(e) => handleModuleSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm"
                  aria-label="Filter by module"
                >
                  <option value="all">All modules</option>
                  {availableModules.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">Unit</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => handleUnitSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm"
                  aria-label="Filter by unit"
                >
                  <option value="all">All units</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>{u.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3 text-gray-400 text-sm px-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center animate-pulse">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <p className="text-sm font-medium">Loading units...</p>
              <p className="text-xs text-gray-400">Fetching courses, tracks and modules</p>
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3 px-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <p className="text-sm font-medium text-red-600 text-center">{fetchError}</p>
              <button
                onClick={fetchUnits}
                className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-r from-[#004900] to-[#006400] px-5 py-2.5 rounded-xl shadow-sm"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !fetchError && filteredUnits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3 px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <Search size={20} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600">
                  {units.length === 0 ? "No units found" : "No units match the selected filters"}
                </p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                  {units.length === 0 ? "Add units from the Manage Modules page." : "Try changing the filter or clear selections."}
                </p>
              </div>
            </div>
          )}

          {!loading && !fetchError && filteredUnits.length > 0 && (
            <>
              {/* Desktop table - hidden on mobile/tablet, horizontal scroll contained */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                      <th className="text-left px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">
                        ID
                      </th>
                      <th className="text-left px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Unit Name
                      </th>
                      <th className="text-left px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Track
                      </th>
                      <th className="text-left px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Module
                      </th>
                      <th className="text-left px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Read
                      </th>
                      <th className="text-right px-5 xl:px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUnits.map((unit) => (
                      <tr
                        key={unit.id}
                        className="hover:bg-gray-50/70 transition-colors group"
                      >
                        <td className="px-5 xl:px-6 py-4 text-gray-400 font-mono text-xs">
                          #{unit.id}
                        </td>
                        <td className="px-5 xl:px-6 py-4">
                          <div className="font-semibold text-gray-900 text-sm">
                            {unit.title}
                          </div>
                          {unit.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-[260px] xl:max-w-xs">
                              {unit.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {unit.videoUrl && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-full">
                                <Video size={10} />
                                Video
                              </span>
                            )}
                            {unit.pdfUrl && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">
                                <FileText size={10} />
                                PDF
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 xl:px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                            {getTrackForUnit(unit)?.title ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 xl:px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {unit.module?.title ?? `Module #${unit.moduleId}`}
                          </span>
                        </td>
                        <td className="px-5 xl:px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Badge status={unit.status} />
                            {patchingId === unit.id ? (
                              <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                                <Loader2 size={12} className="animate-spin" /> updating…
                              </span>
                            ) : (
                              <select
                                value={unit.status}
                                onChange={(e) =>
                                  handlePatchStatus(unit, e.target.value as UnitStatus)
                                }
                                aria-label="change status"
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:border-[#004900] focus:ring-1 focus:ring-[#004900]/20 cursor-pointer bg-white"
                              >
                                {statusOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-5 xl:px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
                            <Clock size={12} className="text-gray-400" />
                            {unit.estimatedReadMinutes
                              ? `${unit.estimatedReadMinutes} min`
                              : "—"}
                          </span>
                        </td>
                        <td className="px-5 xl:px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setModal({ type: "edit", unit })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                            <button
                              onClick={() => setModal({ type: "delete", unit })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tablet horizontal scroll table */}
              <div className="hidden sm:block lg:hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Track / Module</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-gray-900 text-sm">{unit.title}</div>
                          <div className="text-xs text-gray-400 font-mono">#{unit.id} • {unit.estimatedReadMinutes ? `${unit.estimatedReadMinutes} min` : "—"}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">{getTrackForUnit(unit)?.title ?? "—"}</span>
                            <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{unit.module?.title ?? `Module #${unit.moduleId}`}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge status={unit.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setModal({ type: "edit", unit })} className="p-2 rounded-xl border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setModal({ type: "delete", unit })} className="p-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="sm:hidden p-3 space-y-3">
                {filteredUnits.map((unit) => (
                  <div key={unit.id} className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-gray-400">#{unit.id}</p>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight mt-1">{unit.title}</h3>
                        {unit.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{unit.description}</p>
                        )}
                      </div>
                      <Badge status={unit.status} />
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        {getTrackForUnit(unit)?.title ?? "—"}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {unit.module?.title ?? `Module #${unit.moduleId}`}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                        <Clock size={12} /> {unit.estimatedReadMinutes ? `${unit.estimatedReadMinutes} min` : "—"}
                      </span>
                    </div>

                    {(unit.videoUrl || unit.pdfUrl) && (
                      <div className="flex gap-2 mb-3">
                        {unit.videoUrl && <span className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-100 text-purple-700 px-2 py-1 rounded-full"><Video size={10} />Video</span>}
                        {unit.pdfUrl && <span className="inline-flex items-center gap-1 text-xs bg-red-50 border border-red-100 text-red-700 px-2 py-1 rounded-full"><FileText size={10} />PDF</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <select
                        value={unit.status}
                        onChange={(e) => handlePatchStatus(unit, e.target.value as UnitStatus)}
                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-[#004900]"
                        aria-label="change status"
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setModal({ type: "edit", unit })}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setModal({ type: "delete", unit })}
                        className="inline-flex items-center justify-center p-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {modal.type === "edit" && (
        <Modal
          title={`Edit Unit — ${modal.unit.title}`}
          onClose={closeModal}
        >
          <EditUnitForm
            unit={modal.unit}
            onDone={() => {
              closeModal();
              showToast("Unit updated successfully");
              fetchUnits();
            }}
          />
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.unit.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={closeModal}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 px-4 sm:px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 z-50 ${
            toast.type === "error" ? "bg-red-600" : "bg-gradient-to-r from-[#004900] to-[#006400]"
          } text-white`}
        >
          {toast.type === "success" ? (
            <Check size={18} className="shrink-0" />
          ) : (
            <AlertCircle size={18} className="shrink-0" />
          )}
          <span className="text-sm font-medium flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-white/70 hover:text-white shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
