import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor"

const BASE = import.meta.env.VITE_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Framework = {
  id: number;
  title: string;
  author?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  unitId: number;
};

export type FrameworkModule = { id: number; title: string; trackId?: number };
export type FrameworkUnit = { id: number; title: string; moduleId: number };

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]";
const textareaCls = inputCls + " resize-none";

// ── Cloudinary upload helper ───────────────────────────────────────────────────

export const uploadImageToCloudinary = async (
  file: File,
  folder: string = "frameworks"
): Promise<string> => {
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

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_MB = 10;

// ── Framework Form ────────────────────────────────────────────────────────────
// If `lockedUnit` is provided, the module/unit selects are hidden and the
// framework is created directly against that unit (used from ManageUnits.tsx).
// Otherwise the caller must supply `modules` + `units` so the user can pick
// a module, then a unit within that module.

export function FrameworkForm({
  framework,
  modules,
  units,
  lockedUnit,
  onDone,
  onCancel,
}: {
  framework?: Framework;
  modules: FrameworkModule[];
  units: FrameworkUnit[];
  lockedUnit?: { id: number; title: string };
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!framework;

  // Figure out which module the framework's existing unit belongs to (edit mode, non-locked)
  const existingUnit = framework ? units.find((u) => u.id === framework.unitId) : undefined;

  const [selectedModuleId, setSelectedModuleId] = useState<number | "">(
    lockedUnit ? "" : existingUnit?.moduleId ?? ""
  );
  const [selectedUnitId, setSelectedUnitId] = useState<number | "">(
    lockedUnit ? lockedUnit.id : framework?.unitId ?? ""
  );

  const [form, setForm] = useState({
    title: framework?.title ?? "",
    author: framework?.author ?? "",
    summary: framework?.summary ?? "",
    content: framework?.content ?? "",
  });

  const [existingImageUrl, setExistingImageUrl] = useState(framework?.imageUrl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const unitsForModule = units.filter((u) => u.moduleId === selectedModuleId);

  const handleModuleChange = (val: string) => {
    const id = val ? Number(val) : "";
    setSelectedModuleId(id);
    setSelectedUnitId(""); // reset unit whenever module changes
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, image: "Unsupported image format" }));
      setImageFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, image: `Image must be under ${MAX_IMAGE_SIZE_MB}MB` }));
      setImageFile(null);
      e.target.value = "";
      return;
    }
    setFormErrors((prev) => ({ ...prev, image: "" }));
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.content.trim()) e.content = "Content is required";
    if (!lockedUnit) {
      if (!selectedModuleId) e.module = "Select a module";
      if (!selectedUnitId) e.unit = "Select a unit";
    }
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

    let imageUrl = existingImageUrl || undefined;

    try {
      if (imageFile) {
        setUploadStage("Uploading image...");
        imageUrl = await uploadImageToCloudinary(imageFile, "frameworks");
      }

      setUploadStage(isEdit ? "Saving changes..." : "Creating framework...");
      const url = isEdit ? `${BASE}frameworks/${framework!.id}` : `${BASE}frameworks`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          author: form.author || undefined,
          summary: form.summary || undefined,
          content: form.content || undefined,
          imageUrl,
          unitId: Number(selectedUnitId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
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
      {lockedUnit ? (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Unit</label>
          <div className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600">
            {lockedUnit.title}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Module <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedModuleId}
              onChange={(e) => handleModuleChange(e.target.value)}
              className={inputCls}
              aria-label="select module"
            >
              <option value="">Select module</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            {formErrors.module && <p className="text-xs text-red-600 mt-1">{formErrors.module}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value ? Number(e.target.value) : "")}
              className={inputCls}
              disabled={!selectedModuleId}
              aria-label="select unit"
            >
              <option value="">{selectedModuleId ? "Select unit" : "Select a module first"}</option>
              {unitsForModule.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
            {formErrors.unit && <p className="text-xs text-red-600 mt-1">{formErrors.unit}</p>}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="Framework title"
        />
        {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Author</label>
        <input
          value={form.author}
          onChange={(e) => set("author", e.target.value)}
          className={inputCls}
          placeholder="Author name"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Summary</label>
        <textarea
          rows={2}
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          className={textareaCls}
          placeholder="Brief summary"
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Image</label>
        {existingImageUrl && !imageFile && (
          <div className="flex items-center gap-3 mb-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
            <img src={existingImageUrl} alt="Current" className="w-16 h-16 object-cover rounded-md" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">Current image</p>
            </div>
            <button
              type="button"
              onClick={() => setExistingImageUrl("")}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
        {imagePreview && (
          <div className="flex items-center gap-3 mb-2 bg-purple-50 border border-purple-100 rounded-lg p-2">
            <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
            <p className="text-xs text-gray-500">{imageFile?.name}</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className={inputCls}
          aria-label="Image file"
        />
        {formErrors.image && <p className="text-xs text-red-600 mt-1">{formErrors.image}</p>}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#004900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] disabled:opacity-60"
        >
          {loading ? uploadStage || "Saving..." : isEdit ? "Save Changes" : "Create Framework"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}