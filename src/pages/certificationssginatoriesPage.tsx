import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthGuard } from "../hooks/useAuthGuard";
import {
  Award,
  Plus,
  Pencil,
  Trash2,
  Download,
  Search,
  Upload,
  X,
  ShieldCheck,
  Sparkles,
  Eye,
  Loader2,
  AlertCircle,
  Check,
  Crown,
  FileText,
  Users,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Fingerprint,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env.VITE_BASE_URL as string;
const API = (API_BASE ?? "").replace(/\/+$/, "");
const API_ORIGIN = API.replace(/\/api\/?$/, "");

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem("adminAccessToken") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const resolveImageUrl = (p: string) => {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return `${API_ORIGIN}${p}`;
  return `${API_ORIGIN}/${p}`;
};

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
  certType: string;
  certificateNumber: string;
  issuedAt: string;
  user?: { id: number; fullName: string; email?: string };
  track?: { id: number; title: string } | null;
  course?: { id: number; title: string } | null;
  [key: string]: unknown;
}

type CertType = "topic" | "course" | "track" | "field";
type TabKey = "certificates" | "signatories";
type CertSubTab = "issue" | "lookup";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Shared UI                                                          */
/* ------------------------------------------------------------------ */

function Banner({
  kind,
  message,
  onClose,
}: {
  kind: "success" | "error" | "info";
  message: string;
  onClose: () => void;
}) {
  const styles =
    kind === "success"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : kind === "error"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-blue-50 text-blue-700 border-blue-200";
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : Sparkles;
  return (
    <div
      className={`flex items-start gap-3 border rounded-2xl px-4 py-3 text-sm mb-5 animate-slide-down ${styles}`}
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 p-1 -mr-1 shrink-0">
        <X size={15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Certificate Preview                                                */
/* ------------------------------------------------------------------ */

function CertificatePreview({
  record,
  signatories,
}: {
  record: CertificateRecord;
  signatories: Signatory[];
}) {
  const activeSigs = signatories
    .filter((s) => s.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 2);

  const title =
    (record.track as { title?: string } | null)?.title ||
    (record.course as { title?: string } | null)?.title ||
    (record as Record<string, unknown>).title ||
    "Certificate of Completion";

  return (
    <div className="relative bg-white rounded-2xl overflow-hidden border border-amber-200/50 shadow-xl">
      {/* ornate border */}
      <div className="absolute inset-3 border-2 border-amber-900/10 rounded-xl pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="w-full h-full" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 14px, #92400e 14px, #92400e 15px)`
        }} />
      </div>

      {/* header accent */}
      <div className="h-1.5 bg-gradient-to-r from-[#004900] via-amber-500 to-[#004900]" />

      <div className="relative p-8 md:p-10 text-center">
        {/* top badge */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#004900] to-[#005c00] flex items-center justify-center shadow-lg">
            <Award size={26} className="text-amber-300" />
          </div>
        </div>

        <p className="text-[11px] tracking-[0.3em] text-amber-700 font-semibold uppercase">SLAN • Science Learning Advancement Network</p>
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight mt-2" style={{ fontFamily: "Georgia, serif" }}>
          Certificate of Achievement
        </h2>
        <div className="w-20 h-px bg-amber-400 mx-auto mt-4 mb-6" />

        <p className="text-sm text-gray-500">This certifies that</p>
        <p className="text-2xl font-semibold text-[#004900] mt-2" style={{ fontFamily: "Georgia, serif" }}>
          {record.user?.fullName ?? "Recipient Name"}
        </p>
        <div className="w-48 h-px bg-gray-200 mx-auto mt-3 mb-4" />

        <p className="text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
          has successfully completed the <span className="font-semibold text-slate-800">{String(title)}</span>{" "}
          and demonstrated outstanding commitment to learning.
        </p>

        <div className="grid grid-cols-3 gap-4 mt-8 text-xs">
          <div className="text-left">
            <p className="text-gray-400 uppercase tracking-wide text-[10px]">Certificate No.</p>
            <p className="font-mono font-semibold text-slate-800 mt-1">{record.certificateNumber}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 uppercase tracking-wide text-[10px]">Type</p>
            <span className="inline-flex mt-1 px-2.5 py-1 rounded-full bg-[#004900] text-white text-xs font-medium capitalize">
              {record.certType}
            </span>
          </div>
          <div className="text-right">
            <p className="text-gray-400 uppercase tracking-wide text-[10px]">Issued</p>
            <p className="font-medium text-slate-800 mt-1">{formatDate(record.issuedAt)}</p>
          </div>
        </div>

        {/* signatures */}
        <div className="flex justify-between items-end mt-10 pt-8 border-t border-gray-100 gap-8">
          {activeSigs.length === 0 ? (
            <p className="text-xs text-gray-400 mx-auto">No active signatories configured</p>
          ) : (
            activeSigs.map((s) => (
              <div key={s.id} className="flex-1 text-center">
                <div className="h-12 flex items-center justify-center mb-2">
                  {s.signatureImagePath ? (
                    <img src={resolveImageUrl(s.signatureImagePath)} alt={s.name} className="h-10 object-contain" />
                  ) : (
                    <span className="text-gray-300 text-xs">— signature —</span>
                  )}
                </div>
                <div className="w-32 h-px bg-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-900 mt-2">{s.name}</p>
                <p className="text-[11px] text-gray-500">{s.title}</p>
              </div>
            ))
          )}
          {activeSigs.length === 1 && <div className="flex-1" />}
        </div>

        {/* seal */}
        <div className="absolute right-6 bottom-16 hidden md:flex w-20 h-20 rounded-full border-2 border-amber-600/20 items-center justify-center opacity-60 rotate-12">
          <div className="w-16 h-16 rounded-full border border-dashed border-amber-700/30 flex items-center justify-center">
            <ShieldCheck size={20} className="text-amber-700/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signatory Modal                                                    */
/* ------------------------------------------------------------------ */

function SignatoryModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial: Signatory | null;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setTitle(initial?.title ?? "");
      setIsActive(initial?.isActive ?? true);
      setDisplayOrder(initial?.displayOrder ?? 1);
      setFile(null);
      setPreview(initial?.signatureImagePath ? resolveImageUrl(initial.signatureImagePath) : null);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setPreview(initial?.signatureImagePath ? resolveImageUrl(initial.signatureImagePath) : null);
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError("File too large — maximum 2 MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(f.type) && !f.name.match(/\.(png|jpe?g|svg|webp)$/i)) {
      setError("Unsupported format — use PNG, JPEG, SVG or WEBP.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      setError("Name and title are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("title", title.trim());
      fd.append("isActive", String(isActive));
      fd.append("displayOrder", String(displayOrder));
      if (file) fd.append("signatureImage", file);

      const url = isEdit ? `${API}/admin/signatories/${initial!.id}` : `${API}/admin/signatories`;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders() },
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to ${isEdit ? "update" : "create"} signatory (${res.status})`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scale-in border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004900]/10 flex items-center justify-center">
              <Crown size={16} className="text-[#004900]" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{isEdit ? "Edit Signatory" : "Create Signatory"}</h3>
              <p className="text-xs text-gray-500">Maximum 2 active appear on certificates · Order 1 = left, 2 = right</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && <div className="flex gap-2 items-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"><AlertCircle size={16} />{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Ngozi Adeyemi" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white" required />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Title *</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Executive Director, SLAN" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white" required />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Display Order</span>
              <select value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20">
                <option value={1}>1 — Left</option>
                <option value={2}>2 — Right</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Status</span>
              <label className="mt-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#004900] w-4 h-4" />
                <span className="text-sm font-medium text-slate-700">{isActive ? "Active" : "Inactive"}</span>
                <span className={`ml-auto w-2 h-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
              </label>
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-700">Signature Image</span>
            <p className="text-xs text-gray-500 mb-1.5">PNG / JPEG / SVG / WEBP — max 2 MB</p>
            <div
              onClick={() => inputRef.current?.click()}
              className="group border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#004900]/40 hover:bg-[#004900]/5 transition-colors bg-gray-50/50"
            >
              {preview ? (
                <img src={preview} alt="preview" className="h-14 object-contain" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Upload size={18} className="text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-500">Click to upload signature</span>
                </>
              )}
              {file && <span className="text-xs font-medium text-[#004900]">{file.name}</span>}
              <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            </div>
            {preview && (
              <button type="button" onClick={() => handleFile(null)} className="text-xs text-gray-500 hover:text-red-600 mt-2">
                Remove image
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-[#004900] hover:bg-[#003d00] disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-sm transition-all">
              {saving ? <Loader2 size={16} className="animate-spin" /> : isEdit ? <Check size={16} /> : <Plus size={16} />}
              {saving ? "Saving..." : isEdit ? "Update Signatory" : "Create Signatory"}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CertificatesPage() {
  useAuthGuard();

  const [tab, setTab] = useState<TabKey>("certificates");
  const [certSubTab, setCertSubTab] = useState<CertSubTab>("issue");

  /* signatories */
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [sigLoading, setSigLoading] = useState(true);
  const [sigNotice, setSigNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Signatory | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSignatories = useCallback(async () => {
    setSigLoading(true);
    try {
      const res = await fetch(`${API}/admin/signatories`, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error(`Failed to load signatories (${res.status})`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown }).data) ? (data as { data: Signatory[] }).data : [];
      setSignatories(arr as Signatory[]);
    } catch (e) {
      console.error(e);
      setSigNotice({ kind: "error", message: e instanceof Error ? e.message : "Failed to load signatories" });
    } finally {
      setSigLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatories();
  }, [fetchSignatories]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/admin/signatories/${deleteId}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setSigNotice({ kind: "success", message: "Signatory deleted and image removed." });
      fetchSignatories();
    } catch (e) {
      setSigNotice({ kind: "error", message: e instanceof Error ? e.message : "Delete failed" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  /* certificates */
  const [userId, setUserId] = useState("");
  const [certType, setCertType] = useState<CertType>("track");
  const [referenceId, setReferenceId] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueNotice, setIssueNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [issued, setIssued] = useState<CertificateRecord | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [record, setRecord] = useState<CertificateRecord | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !referenceId) {
      setIssueNotice({ kind: "error", message: "User ID and Reference ID are required." });
      return;
    }
    setIssuing(true);
    setIssueNotice(null);
    setIssued(null);
    try {
      const res = await fetch(`${API}/admin/certifications/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ userId: Number(userId), certType, referenceId: Number(referenceId) }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Issue failed (${res.status})`);
      }
      const data = (await res.json()) as CertificateRecord;
      setIssued(data);
      setIssueNotice({ kind: "success", message: `Certificate ${data.certificateNumber} issued successfully.` });
    } catch (err) {
      setIssueNotice({ kind: "error", message: err instanceof Error ? err.message : "Failed to issue certificate" });
    } finally {
      setIssuing(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupId.trim()) {
      setLookupNotice({ kind: "error", message: "Enter a certificate ID." });
      return;
    }
    setLookupLoading(true);
    setLookupNotice(null);
    setRecord(null);
    try {
      const res = await fetch(`${API}/admin/certifications/${lookupId.trim()}`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Certificate not found (${res.status})`);
      }
      const data = (await res.json()) as CertificateRecord;
      setRecord(data);
    } catch (err) {
      setLookupNotice({ kind: "error", message: err instanceof Error ? err.message : "Lookup failed" });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleDownload = async (id: number | string) => {
    setDownloading(true);
    try {
      const res = await fetch(`${API}/admin/certifications/${id}/download`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLookupNotice({ kind: "error", message: err instanceof Error ? err.message : "Download failed" });
      setIssueNotice({ kind: "error", message: err instanceof Error ? err.message : "Download failed" });
    } finally {
      setDownloading(false);
    }
  };

  const activeCount = signatories.filter((s) => s.isActive).length;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-[1280px] mx-auto p-4 md:p-6">
        {/* header */}
        <div className="rounded-2xl bg-gradient-to-br from-[#004900] via-[#003d00] to-[#0a5c00] text-white p-6 md:p-8 mb-6 relative overflow-hidden shadow-xl animate-slide-up">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-16 -right-16 w-72 h-72 bg-white rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-amber-400 rounded-full blur-3xl opacity-20" />
          </div>
          <div className="absolute top-6 right-6 w-24 h-24 border border-white/10 rounded-full hidden md:block" />
          <div className="absolute top-10 right-10 w-16 h-16 border border-white/5 rounded-full hidden md:block" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/10">
                <Award size={22} className="text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                  Certificates & Signatories <Sparkles size={18} className="text-amber-300 hidden md:inline" />
                </h1>
                <p className="text-sm text-white/70 mt-1 max-w-xl">
                  Issue certificates for tracks, courses and topics — and manage the signatories whose signatures appear on them. Max 2 active signatories are rendered on each PDF.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                <div className="text-xl font-bold">{sigLoading ? "—" : activeCount}</div>
                <div className="text-[11px] uppercase tracking-wide text-white/60">Active</div>
              </div>
              <div className="bg-white text-[#004900] rounded-2xl px-4 py-3 text-center min-w-[110px] shadow">
                <div className="text-xl font-bold">{sigLoading ? "—" : signatories.length}</div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Signatories</div>
              </div>
            </div>
          </div>
        </div>

        {/* top tab switch */}
        <div className="flex p-1 bg-white rounded-2xl border border-gray-200 w-fit shadow-sm mb-6 gap-1">
          <button
            onClick={() => setTab("certificates")}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "certificates" ? "bg-[#004900] text-white shadow" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <FileText size={16} /> Certificates
          </button>
          <button
            onClick={() => setTab("signatories")}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "signatories" ? "bg-[#004900] text-white shadow" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <Users size={16} /> Signatories
          </button>
        </div>

        {/* content */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-slide-up">
          {tab === "certificates" ? (
            <div>
              {/* sub tabs */}
              <div className="flex gap-6 px-6 border-b border-gray-100 overflow-x-auto">
                <button onClick={() => setCertSubTab("issue")} className={`py-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${certSubTab === "issue" ? "border-[#004900] text-[#004900]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  Issue Certificate
                </button>
                <button onClick={() => setCertSubTab("lookup")} className={`py-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${certSubTab === "lookup" ? "border-[#004900] text-[#004900]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  Lookup & Download
                </button>
                <span className="ml-auto hidden md:flex items-center gap-1.5 text-xs text-gray-400 py-4"><Fingerprint size={12} /> POST /admin/certifications/issue · GET /admin/certifications/{"{id}"}</span>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* left: forms */}
                <div className="lg:col-span-2 space-y-6">
                  {certSubTab === "issue" ? (
                    <>
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Sparkles size={16} className="text-amber-500" /> Manually Issue a Certificate</h3>
                        <p className="text-xs text-gray-500 mt-1">Creates a certificate record and makes it available for download as PDF.</p>
                      </div>

                      {issueNotice && <Banner kind={issueNotice.kind as "success" | "error"} message={issueNotice.message} onClose={() => setIssueNotice(null)} />}

                      <form onSubmit={handleIssue} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-700">User ID <span className="text-red-500">*</span></span>
                          <input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. 42" className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]" required />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-700">Certificate Type <span className="text-red-500">*</span></span>
                          <div className="mt-1.5 grid grid-cols-4 gap-2">
                            {(["track", "course", "topic", "field"] as CertType[]).map((t) => (
                              <button key={t} type="button" onClick={() => setCertType(t)} className={`capitalize px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${certType === t ? "bg-[#004900] text-white border-[#004900] shadow" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-700">Reference ID <span className="text-red-500">*</span></span>
                          <input type="number" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="Track / Course ID" className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]" required />
                          <span className="text-xs text-gray-500 mt-1 block">The track, course, topic or field ID to certify.</span>
                        </label>
                        <button type="submit" disabled={issuing} className="w-full inline-flex items-center justify-center gap-2 bg-[#004900] hover:bg-[#003d00] disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow">
                          {issuing ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />} {issuing ? "Issuing..." : "Issue Certificate"}
                        </button>
                      </form>

                      {issued && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 animate-slide-up">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-emerald-900 flex items-center gap-2"><CheckCircle2 size={16} /> Issued</h4>
                            <button onClick={() => handleDownload(issued.id)} disabled={downloading} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004900] hover:underline disabled:opacity-50">
                              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Download PDF
                            </button>
                          </div>
                          <div className="bg-white rounded-xl border border-emerald-100 p-3 text-xs font-mono overflow-auto">
                            <div className="flex gap-2 text-gray-500"><span>Certificate No.</span><span className="font-semibold text-slate-900">{issued.certificateNumber}</span></div>
                            <div className="flex gap-2 text-gray-500 mt-1"><span>ID</span><span className="text-slate-900">{issued.id}</span> · <span>{issued.certType}</span></div>
                            {issued.user && <div className="text-slate-700 mt-2">{issued.user.fullName} {issued.user.email ? `· ${issued.user.email}` : ""}</div>}
                            {formatDate(issued.issuedAt) !== "—" && <div className="text-gray-500 mt-1">{formatDate(issued.issuedAt)}</div>}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Search size={16} className="text-[#004900]" /> Look Up a Certificate</h3>
                        <p className="text-xs text-gray-500 mt-1">Fetch by ID and download the PDF. Uses <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">GET /admin/certifications/{"{id}"}</span></p>
                      </div>
                      {lookupNotice && <Banner kind={lookupNotice.kind as "success" | "error"} message={lookupNotice.message} onClose={() => setLookupNotice(null)} />}

                      <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5">
                        <label className="text-xs font-semibold text-slate-700">Certificate ID</label>
                        <div className="flex gap-2 mt-1.5">
                          <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLookup()} placeholder="e.g. 101" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]" />
                          </div>
                          <button onClick={handleLookup} disabled={lookupLoading} className="inline-flex items-center gap-2 bg-[#004900] hover:bg-[#003d00] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                            {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
                          </button>
                        </div>
                      </div>

                      {record && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-900">Certificate #{record.id}</h4>
                            <button onClick={() => handleDownload(record.id)} disabled={downloading} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#004900] text-white px-3 py-1.5 rounded-full hover:bg-[#003d00] disabled:opacity-50">
                              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Download PDF
                            </button>
                          </div>
                          <div className="bg-slate-900 rounded-xl p-3 overflow-auto">
                            <pre className="text-xs text-emerald-300 whitespace-pre-wrap break-words">{JSON.stringify(record, null, 2)}</pre>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3"><div className="text-gray-500">Certificate No.</div><div className="font-mono font-semibold text-slate-900">{record.certificateNumber}</div></div>
                            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3"><div className="text-gray-500">Issued</div><div className="font-medium text-slate-900">{formatDate(record.issuedAt)}</div></div>
                          </div>
                        </div>
                      )}

                      {!record && !lookupLoading && (
                        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/30 p-8 text-center">
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mx-auto"><Eye size={16} className="text-gray-400" /></div>
                          <p className="text-xs text-gray-500 mt-3">Enter an ID to preview the certificate record</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* right: preview */}
                <div className="lg:col-span-3">
                  <div className="sticky top-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Layers size={16} className="text-gray-400" /> Live Preview</h3>
                      <span className="text-xs text-gray-500 hidden md:inline">Signatures auto-populate from active signatories</span>
                    </div>

                    {/* show issued or looked up record, fallback to sample */}
                    {(() => {
                      const r = issued ?? record;
                      if (r) return <CertificatePreview record={r} signatories={signatories} />;
                      // sample
                      const sample: CertificateRecord = {
                        id: 0,
                        certType: certType,
                        certificateNumber: "SLAN-M9KZ4F-AB3C",
                        issuedAt: new Date().toISOString(),
                        user: { id: Number(userId) || 1, fullName: "Amina Bello" },
                        track: certType === "track" ? { id: Number(referenceId) || 1, title: "Advanced Product Design" } : null,
                        course: certType === "course" ? { id: Number(referenceId) || 1, title: "Introduction to Data Science" } : null,
                      };
                      return (
                        <div className="opacity-90">
                          <CertificatePreview record={sample} signatories={signatories} />
                          <p className="text-xs text-center text-gray-400 mt-3">Sample preview — issue or lookup to see real data</p>
                        </div>
                      );
                    })()}

                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed text-amber-900">
                        <span className="font-semibold">How it works:</span> Certificates are generated on the server with the current active signatories (max 2). To change signatures, update signatories and re-issue or re-download — the PDF will reflect the latest active pair.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SIGNATORIES */
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Crown size={16} className="text-amber-500" /> Certificate Signatories</h3>
                  <p className="text-xs text-gray-500 mt-1">Create up to 2 active signatories · Display order 1 = left, 2 = right · PNG/JPEG/SVG/WEBP max 2 MB</p>
                </div>
                <button onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-2 bg-[#004900] hover:bg-[#003d00] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow">
                  <Plus size={16} /> Add Signatory
                </button>
              </div>

              {sigNotice && <Banner kind={sigNotice.kind} message={sigNotice.message} onClose={() => setSigNotice(null)} />}

              {/* stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-2xl font-bold text-emerald-700">{activeCount}</div>
                  <div className="text-xs text-emerald-700 font-medium">Active</div>
                  <div className="text-xs text-emerald-600/70 mt-1">Shown on certificates</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-2xl font-bold text-slate-800">{signatories.length - activeCount}</div>
                  <div className="text-xs text-slate-600 font-medium">Inactive</div>
                  <div className="text-xs text-gray-500 mt-1">Hidden from PDFs</div>
                </div>
                <div className={`rounded-2xl border p-4 ${activeCount > 2 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
                  <div className={`text-2xl font-bold ${activeCount > 2 ? "text-red-600" : "text-slate-800"}`}>{activeCount > 2 ? "⚠️ " + activeCount : activeCount + " / 2"}</div>
                  <div className={`text-xs font-medium ${activeCount > 2 ? "text-red-700" : "text-slate-600"}`}>{activeCount > 2 ? "Too many active" : "Limit"}</div>
                  <div className="text-xs text-gray-500 mt-1">Only 2 render on PDF</div>
                </div>
              </div>

              {sigLoading ? (
                <div className="rounded-2xl border border-gray-200 p-12 text-center">
                  <Loader2 size={20} className="animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-3">Loading signatories...</p>
                </div>
              ) : signatories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto"><ImageIcon size={18} className="text-gray-400" /></div>
                  <p className="text-sm font-semibold text-slate-700 mt-3">No signatories yet</p>
                  <p className="text-xs text-gray-500 mt-1">Add your first signatory to start signing certificates.</p>
                  <button onClick={() => { setEditing(null); setModalOpen(true); }} className="mt-4 inline-flex items-center gap-2 bg-[#004900] text-white text-sm font-semibold px-4 py-2 rounded-xl"><Plus size={14} /> Create Signatory</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {signatories
                    .slice()
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((s) => (
                      <div key={s.id} className="group relative rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-lg hover:border-gray-300 transition-all">
                        <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${s.isActive ? "bg-emerald-500 shadow shadow-emerald-500/30" : "bg-gray-300"}`} title={s.isActive ? "Active" : "Inactive"} />
                        <div className="h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-3">
                          {s.signatureImagePath ? (
                            <img src={resolveImageUrl(s.signatureImagePath)} alt={s.name} className="h-10 object-contain p-1" />
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1"><ImageIcon size={12} /> No image</span>
                          )}
                        </div>
                        <h4 className="font-semibold text-slate-900 text-sm leading-tight pr-4">{s.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.title}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {s.isActive ? <Check size={12} /> : <X size={12} />} {s.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-50 border border-gray-200 text-gray-600">
                            <FileText size={12} /> Order {s.displayOrder} · {s.displayOrder === 1 ? "Left" : "Right"}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-4">
                          <button onClick={() => { setEditing(s); setModalOpen(true); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => setDeleteId(s.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* table view alternative for larger screens */}
              {signatories.length > 0 && (
                <div className="mt-8 rounded-2xl border border-gray-200 overflow-hidden hidden lg:block">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">All Signatories — Table View</span>
                    <span className="text-xs text-gray-500">{signatories.length} total</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-white text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Signature</th>
                        <th className="text-left px-5 py-3 font-semibold">Name</th>
                        <th className="text-left px-5 py-3 font-semibold">Title</th>
                        <th className="text-left px-5 py-3 font-semibold">Order</th>
                        <th className="text-left px-5 py-3 font-semibold">Status</th>
                        <th className="text-right px-5 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {signatories.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/60">
                          <td className="px-5 py-3">
                            <div className="h-8 w-20 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden">
                              {s.signatureImagePath ? <img src={resolveImageUrl(s.signatureImagePath)} alt={s.name} className="h-7 object-contain" /> : <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                          <td className="px-5 py-3 text-gray-600 max-w-[240px] truncate">{s.title}</td>
                          <td className="px-5 py-3"><span className="px-2 py-1 rounded-full bg-gray-100 text-xs font-medium">{s.displayOrder}</span></td>
                          <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{s.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => { setEditing(s); setModalOpen(true); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-slate-700"><Pencil size={14} /></button>
                              <button onClick={() => setDeleteId(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">API: <span className="font-mono">{API || "VITE_BASE_URL not set"}</span> · Admin token via <span className="font-mono">Authorization: Bearer {"{adminAccessToken}"}</span></p>
      </div>

      {/* modals */}
      <SignatoryModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} onSaved={() => { fetchSignatories(); setSigNotice({ kind: "success", message: editing ? "Signatory updated." : "Signatory created." }); }} />

      {/* delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in border border-gray-200">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-3"><Trash2 size={18} className="text-red-600" /></div>
            <h3 className="font-semibold text-slate-900">Delete signatory?</h3>
            <p className="text-sm text-gray-500 mt-1">This will permanently delete the signatory and remove its signature image. It will no longer appear on new certificates.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {deleting ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
