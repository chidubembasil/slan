import React, { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Search,
  Upload,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const API_BASE = "https://slan-backend-brrk.onrender.com/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Signatory {
  id: number;
  name: string;
  title: string;
  signatureImagePath: string;
  isActive: boolean;
  displayOrder: number;
}

interface CertificateRecord {
  id: number;
  userId: number;
  certType: string;
  referenceId: number;
  issuedAt?: string;
  [key: string]: unknown;
}

type CertType = "topic" | "course" | "track" | "field";

/* ------------------------------------------------------------------ */
/*  Small shared UI bits                                               */
/* ------------------------------------------------------------------ */

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 px-1 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? "border-[#2c5015] text-[#173208] font-semibold"
          : "border-transparent text-gray-400 hover:text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2c5015] focus:border-[#2c5015]";

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 bg-[#2c5015] hover:bg-[#234110] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
    >
      {children}
    </button>
  );
}

function Banner({
  kind,
  message,
  onClose,
}: {
  kind: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const styles =
    kind === "success"
      ? "bg-green-50 text-green-800 border-green-200"
      : "bg-red-50 text-red-700 border-red-200";
  return (
    <div
      className={`flex items-start justify-between gap-3 border rounded-md px-4 py-3 text-sm mb-5 ${styles}`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Manage Signatories                                                 */
/* ------------------------------------------------------------------ */

function useSignatories() {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignatories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/signatories`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load signatories");
      const data = await res.json();
      setSignatories(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatories();
  }, [fetchSignatories]);

  return { signatories, loading, refetch: fetchSignatories };
}

/* ---------------------------- Create Signatory ---------------------------- */

function CreateSignatoryTab({ onCreated }: { onCreated: () => void }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setTitle("");
    setIsActive(true);
    setDisplayOrder(1);
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("title", title);
      formData.append("isActive", String(isActive));
      formData.append("displayOrder", String(displayOrder));
      if (imageFile) formData.append("signatureImage", imageFile);

      const url = editingId
        ? `${API_BASE}/admin/signatories/${editingId}`
        : `${API_BASE}/admin/signatories`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Signatory could not be saved");

      setNotice({
        kind: "success",
        message: editingId ? "Signatory updated." : "Signatory created.",
      });
      resetForm();
      onCreated();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Create a Signatory
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Maximum 2 active signatories appear on certificates. Display order 1
        = left, 2 = right.
      </p>

      {notice && (
        <Banner
          kind={notice.kind}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="border border-gray-200 rounded-lg p-5 bg-gray-50 max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-x-6">
          <Field label="Name" required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Ngozi Adeyemi"
              required
            />
          </Field>
          <Field label="Title" required>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Executive Director, SLAN"
              required
            />
          </Field>
          <Field label="Display Order">
            <input
              type="number"
              min={1}
              max={2}
              className={inputClass}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
            />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 text-sm text-gray-700 pt-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[#2c5015] w-4 h-4"
              />
              Active
            </label>
          </Field>
        </div>

        <Field label="Signature Image (PNG/JPEG/SVG/WEBP — max 2MB)">
          <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-md px-4 py-4 cursor-pointer hover:border-[#2c5015] transition-colors bg-white">
            <Upload size={18} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {imageFile ? imageFile.name : "Click to upload signature image"}
            </span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Signature preview"
              className="h-14 mt-3 object-contain"
            />
          )}
        </Field>

        <div className="flex gap-3 mt-2">
          <PrimaryButton type="submit" disabled={saving}>
            <Plus size={16} />
            {saving ? "Saving..." : "Create Signatory"}
          </PrimaryButton>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------- Manage Signatories ---------------------------- */

function ManageSignatoriesTab({
  signatories,
  loading,
  onChanged,
}: {
  signatories: Signatory[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (s: Signatory) => {
    setEditingId(s.id);
    setName(s.name);
    setTitle(s.title);
    setIsActive(s.isActive);
    setDisplayOrder(s.displayOrder);
    setImageFile(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("title", title);
      formData.append("isActive", String(isActive));
      formData.append("displayOrder", String(displayOrder));
      if (imageFile) formData.append("signatureImage", imageFile);

      const res = await fetch(`${API_BASE}/admin/signatories/${editingId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Signatory could not be updated");

      setNotice({ kind: "success", message: "Signatory updated." });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this signatory? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/signatories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to delete signatory");
      setNotice({ kind: "success", message: "Signatory deleted." });
      onChanged();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to delete signatory",
      });
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Manage Signatories
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        GET /admin/signatories · PUT /admin/signatories/&#123;id&#125; · DELETE
        /admin/signatories/&#123;id&#125;
      </p>

      {notice && (
        <Banner
          kind={notice.kind}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {editingId && (
        <form
          onSubmit={handleUpdate}
          className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50 max-w-2xl"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Editing Signatory #{editingId}
          </h3>
          <div className="grid grid-cols-2 gap-x-6">
            <Field label="Name" required>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Title" required>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <Field label="Display Order">
              <input
                type="number"
                min={1}
                max={2}
                className={inputClass}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-sm text-gray-700 pt-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-[#2c5015] w-4 h-4"
                />
                Active
              </label>
            </Field>
          </div>
          <Field label="Replace Signature Image (optional)">
            <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-md px-4 py-4 cursor-pointer hover:border-[#2c5015] transition-colors bg-white">
              <Upload size={18} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                {imageFile ? imageFile.name : "Click to upload a new image"}
              </span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </Field>
          <div className="flex gap-3 mt-2">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving..." : "Update Signatory"}
            </PrimaryButton>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Signature</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Order</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  Loading signatories...
                </td>
              </tr>
            )}
            {!loading && signatories.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No signatories yet. Use the "Create Signatory" tab to add one.
                </td>
              </tr>
            )}
            {!loading &&
              signatories.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="h-8 w-16 bg-gray-50 rounded flex items-center justify-center overflow-hidden border border-gray-100">
                      {s.signatureImagePath ? (
                        <img
                          src={s.signatureImagePath}
                          alt={s.name}
                          className="h-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.title}</td>
                  <td className="px-4 py-3 text-gray-500">{s.displayOrder}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Issue Certificate                                                  */
/* ------------------------------------------------------------------ */

function IssueCertificateTab() {
  const [userId, setUserId] = useState("");
  const [certType, setCertType] = useState<CertType>("track");
  const [referenceId, setReferenceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const [issued, setIssued] = useState<CertificateRecord | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setIssued(null);
    try {
      const res = await fetch(`${API_BASE}/admin/certifications/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
        },
        body: JSON.stringify({
          userId: Number(userId),
          certType,
          referenceId: Number(referenceId),
        }),
      });
      if (!res.ok) throw new Error("Failed to issue certificate");
      const data = await res.json();
      setIssued(data);
      setNotice({ kind: "success", message: "Certificate issued successfully." });
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to issue certificate",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Manually Issue a Certificate
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        POST /admin/certifications/issue
      </p>

      {notice && (
        <Banner
          kind={notice.kind}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="border border-gray-200 rounded-lg p-5 bg-gray-50 max-w-lg"
      >
        <Field label="User ID" required>
          <input
            type="number"
            className={inputClass}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
        </Field>
        <Field label="Certificate Type" required>
          <select
            className={inputClass}
            value={certType}
            onChange={(e) => setCertType(e.target.value as CertType)}
          >
            <option value="topic">Topic</option>
            <option value="course">Course</option>
            <option value="track">Track</option>
            <option value="field">Field</option>
          </select>
        </Field>
        <Field label="Reference ID" required>
          <input
            type="number"
            className={inputClass}
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            required
          />
        </Field>
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Issuing..." : "Issue Certificate"}
        </PrimaryButton>
      </form>

      {issued && (
        <div className="mt-6 max-w-lg border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Issued Certificate
          </h3>
          <pre className="text-xs bg-gray-900 text-green-300 rounded-md p-4 overflow-x-auto">
            {JSON.stringify(issued, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lookup / Download Certificate                                      */
/* ------------------------------------------------------------------ */

function LookupCertificateTab() {
  const [certId, setCertId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const [record, setRecord] = useState<CertificateRecord | null>(null);

  const handleLookup = async () => {
    if (!certId) return;
    setLoading(true);
    setNotice(null);
    setRecord(null);
    try {
      const res = await fetch(`${API_BASE}/admin/certifications/${certId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
      });
      if (!res.ok) throw new Error("Certificate not found");
      const data = await res.json();
      setRecord(data);
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Certificate not found",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/admin/certifications/${certId}/download`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } }
      );
      if (!res.ok) throw new Error("Failed to download certificate");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${certId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to download certificate",
      });
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Look Up a Certificate
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        GET /admin/certifications/&#123;id&#125; · GET /admin/certifications/&#123;id&#125;/download
      </p>

      {notice && (
        <Banner
          kind={notice.kind}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      <div className="flex gap-3 max-w-lg mb-6">
        <input
          className={inputClass}
          placeholder="Certificate ID"
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
        />
        <PrimaryButton onClick={handleLookup} disabled={loading}>
          <Search size={15} />
          {loading ? "Searching..." : "Search"}
        </PrimaryButton>
      </div>

      {record && (
        <div className="max-w-lg border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Certificate #{record.id}
            </h3>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-sm text-[#2c5015] hover:underline font-medium"
            >
              <Download size={15} />
              Download PDF
            </button>
          </div>
          <pre className="text-xs bg-gray-900 text-green-300 rounded-md p-4 overflow-x-auto">
            {JSON.stringify(record, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type TabKey = "signatories" | "issue" | "lookup";

function SignatoriesTab() {
  const { signatories, loading, refetch } = useSignatories();
  const [subTab, setSubTab] = useState<"manage" | "create">("manage");

  return (
    <div>
      <div className="flex gap-6 border-b border-gray-200 mb-6">
        <TabButton
          label="Manage Signatories"
          active={subTab === "manage"}
          onClick={() => setSubTab("manage")}
        />

        <TabButton
          label="Create Signatory"
          active={subTab === "create"}
          onClick={() => setSubTab("create")}
        />
      </div>

      {subTab === "manage" && (
        <ManageSignatoriesTab
          signatories={signatories}
          loading={loading}
          onChanged={refetch}
        />
      )}

      {subTab === "create" && (
        <CreateSignatoryTab
          onCreated={() => {
            refetch();
            setSubTab("manage");
          }}
        />
      )}
    </div>
  );
}
export default function CertificatesPage() {
  const [tab, setTab] = useState<TabKey>("signatories");

  return (
    <div className="min-h-screen bg-gray-50 px-10 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Certificate Page</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Issue and view certificates, and manage the signatories that appear
        on them.
      </p>

      <div className="flex gap-8 border-b border-gray-200 mb-8">
        <TabButton
          label="Manage Signatories"
          active={tab === "signatories"}
          onClick={() => setTab("signatories")}
        />
        <TabButton
          label="Issue Certificate"
          active={tab === "issue"}
          onClick={() => setTab("issue")}
        />
        <TabButton
          label="Lookup / Download"
          active={tab === "lookup"}
          onClick={() => setTab("lookup")}
        />
      </div>

      <div className="bg-white rounded-lg">
        {tab === "signatories" && <SignatoriesTab />}
        {tab === "issue" && <IssueCertificateTab />}
        {tab === "lookup" && <LookupCertificateTab />}
      </div>
    </div>
  );
}