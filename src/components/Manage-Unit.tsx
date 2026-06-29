import { useState, useEffect, useCallback } from "react";
import { RichTextEditor } from "./RichTextEditor"
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
type Track = { id: number; title: string };

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
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
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: UnitStatus }) {
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
    /* if (!form.description.trim()) e.description = "Description is required"; */
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

    let videoUrl = existingVideoUrl || undefined;
    let pdfUrl = existingPdfUrl || undefined;

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
          content: form.content || undefined,
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
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="Unit title"
        />
        {formErrors.title && (
          <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>
        )}
      </div>

      {/* <div>
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
      </div> */}
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
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Content <span className="text-red-500">*</span>
        </label>
        <RichTextEditor
          value={form.content}
          onChange={(html) => set("content", html)}
          placeholder="Main learning content for this unit"
        />
        {formErrors.content && (
          <p className="text-xs text-red-600 mt-1">{formErrors.content}</p>
        )}
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
            Video file
          </label>
          {existingVideoUrl && !videoFile && (
            <div className="flex items-center justify-between mb-1.5 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <a
                href={existingVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-700 underline truncate max-w-[160px]"
              >
                Current video
              </a>
              <button
                type="button"
                onClick={() => setExistingVideoUrl("")}
                className="text-xs text-red-500 hover:text-red-700 ml-2"
              >
                Remove
              </button>
            </div>
          )}
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
          {formErrors.video && (
            <p className="text-xs text-red-600 mt-1">{formErrors.video}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            PDF file
          </label>
          {existingPdfUrl && !pdfFile && (
            <div className="flex items-center justify-between mb-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <a
                href={existingPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-red-700 underline truncate max-w-[160px]"
              >
                Current PDF
              </a>
              <button
                type="button"
                onClick={() => setExistingPdfUrl("")}
                className="text-xs text-red-500 hover:text-red-700 ml-2"
              >
                Remove
              </button>
            </div>
          )}
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
          {formErrors.pdf && (
            <p className="text-xs text-red-600 mt-1">{formErrors.pdf}</p>
          )}
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
            onChange={(e) => set("estimatedReadMinutes", Number(e.target.value))}
            className={inputCls}
            title="input"
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
          {loading ? uploadStage || "Saving..." : "Save Changes"}
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
  const [selectedModuleId, setSelectedModuleId] = useState<number | "all">("all");
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

  // Filter by selected module
  const filteredUnits =
    selectedModuleId === "all"
      ? units
      : units.filter(
          (u) => u.moduleId === selectedModuleId || u.module?.id === selectedModuleId
        );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Units</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Units are the individual lessons inside a module
            </p>
          </div>
          <span className="text-sm text-gray-400">
            {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Module filter pills */}
        {!loading && !fetchError && modules.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <button
              onClick={() => setSelectedModuleId("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedModuleId === "all"
                  ? "bg-[#004900] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#004900] hover:text-[#004900]"
              }`}
            >
              All modules
            </button>
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModuleId(m.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedModuleId === m.id
                    ? "bg-[#004900] text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-[#004900] hover:text-[#004900]"
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading units…
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button
                onClick={fetchUnits}
                className="text-sm text-[#004900] underline"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !fetchError && filteredUnits.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              {units.length === 0
                ? "No units found. Add units from the Manage Modules page."
                : "No units in this module."}
            </div>
          )}

          {!loading && !fetchError && filteredUnits.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">
                      ID
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Unit Name
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Module
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Read (mins)
                    </th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* ID */}
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                        {unit.id}
                      </td>

                      {/* Unit Name */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {unit.title}
                        </div>
                        {unit.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                            {unit.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {unit.videoUrl && (
                            <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              Video
                            </span>
                          )}
                          {unit.pdfUrl && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              PDF
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Module */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {unit.module?.title ?? `Module #${unit.moduleId}`}
                        </span>
                      </td>

                      {/* Status — inline patch dropdown */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Badge status={unit.status} />
                          {patchingId === unit.id ? (
                            <span className="text-xs text-gray-400">updating…</span>
                          ) : (
                            <select
                              value={unit.status}
                              onChange={(e) =>
                                handlePatchStatus(unit, e.target.value as UnitStatus)
                              }
                              aria-label="change status"
                              className="text-xs border border-gray-200 rounded-md px-1.5 py-1 text-gray-500 focus:outline-none focus:border-[#004900] cursor-pointer"
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

                      {/* Read time */}
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {unit.estimatedReadMinutes
                          ? `${unit.estimatedReadMinutes} min`
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: "edit", unit })}
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
                            onClick={() => setModal({ type: "delete", unit })}
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