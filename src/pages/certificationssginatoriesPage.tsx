import React, { useEffect, useState, useCallback, useRef } from "react";

/**
 * CertificationsSignatoriesPage
 * ------------------------------------------------------------------
 * Drop this into your admin app the same way "Assessment Page" is wired
 * up (same route-level component pattern, same sidebar layout wrapper).
 * This file only renders the CONTENT PANE — plug it into whatever
 * layout component already renders the green sidebar.
 *
 * Endpoints used (from your Swagger docs):
 *   POST   /admin/certifications/issue
 *   GET    /admin/certifications/{id}
 *   GET    /admin/certifications/{id}/download
 *   POST   /admin/signatories               (multipart/form-data)
 *   GET    /admin/signatories
 *   GET    /admin/signatories/{id}
 *   PUT    /admin/signatories/{id}           (multipart/form-data)
 *   DELETE /admin/signatories/{id}
 *
 * One endpoint does NOT exist in your docs yet — searching users to grab
 * a userId. I stubbed it as a DECOY route below (`/admin/users/search`).
 * Swap DECOY_USER_SEARCH_ENDPOINT for the real one whenever it's ready;
 * everything else in this file will keep working unchanged.
 * ------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_KEY;


// 🔶 DECOY / PLACEHOLDER — not a real confirmed endpoint yet.
// Expected shape once real: GET /admin/users/search?query=xxx -> User[]
// const DECOY_USER_SEARCH_ENDPOINT = "/admin/users";

function authHeaders(extra: Record<string, string> = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return (undefined as unknown) as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CertType = "course" | "track" | "module" | "unit";

interface UserLite {
  id: number;
  name: string;
  email: string;
}

interface Certificate {
  id: number;
  userId: number;
  certType: CertType;
  referenceId: number;
  issuedAt?: string;
  userName?: string;
}

interface Signatory {
  id: number;
  name: string;
  title: string;
  isActive: boolean;
  displayOrder: number;
  signatureImageUrl?: string;
}

// ---------------------------------------------------------------------------
// Small shared UI bits
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-md px-4 py-3 text-sm shadow-lg text-white ${
        type === "success" ? "bg-green-700" : "bg-red-600"
      }`}
    >
      {message}
    </div>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// User search / select (feeds userId into the Issue Certificate form)
// ---------------------------------------------------------------------------

function UserSearchSelect({
  value,
  onChange,
}: {
  value: UserLite | null;
  onChange: (user: UserLite | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // 🔶 DECOY ROUTE — replace with the real "search/list users" endpoint
      // once confirmed. Shape assumed: { users: UserLite[] } or UserLite[].
      const data = await apiFetch<UserLite[] | { users: UserLite[] }>(
        `${API_BASE}/admin/users?query=${encodeURIComponent(q)}`
      );
      const list = Array.isArray(data) ? data : data.users || [];
      setResults(list);
    } catch (err) {
      // Silently fail in the dropdown — surfaced via empty state, not a toast,
      // since this is a placeholder endpoint that may not exist yet.
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(v: string) {
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 350);
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        User <span className="text-red-500">*</span>
      </label>

      {value ? (
        <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
          <div>
            <p className="text-sm font-medium text-gray-900">{value.name}</p>
            <p className="text-xs text-gray-500">
              {value.email} · ID {value.id}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="text-xs text-red-600 hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {open && query.trim() && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                  <Spinner /> Searching...
                </div>
              )}
              {!loading && results.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">
                  No users found.
                </div>
              )}
              {!loading &&
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-green-50"
                  >
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certifications tab
// ---------------------------------------------------------------------------

const CERT_TYPES: { value: CertType; label: string }[] = [
  { value: "course", label: "Course" },
  { value: "track", label: "Track" },
  { value: "module", label: "Module" },
  { value: "unit", label: "Unit" },
];

function CertificationsTab({
  showToast,
}: {
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [selectedUser, setSelectedUser] = useState<UserLite | null>(null);
  const [certType, setCertType] = useState<CertType>("course");
  const [referenceId, setReferenceId] = useState("");
  const [issuing, setIssuing] = useState(false);

  const [lookupId, setLookupId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpCert, setLookedUpCert] = useState<Certificate | null>(null);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      showToast("Select a user before issuing a certificate.", "error");
      return;
    }
    if (!referenceId) {
      showToast("Enter the reference ID for the selected cert type.", "error");
      return;
    }

    setIssuing(true);
    try {
      await apiFetch<Certificate>("/admin/certifications/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          certType,
          referenceId: Number(referenceId),
        }),
      });
      showToast(`Certificate issued to ${selectedUser.name}.`, "success");
      setSelectedUser(null);
      setReferenceId("");
      setCertType("course");
    } catch (err: any) {
      showToast(err.message || "Failed to issue certificate.", "error");
    } finally {
      setIssuing(false);
    }
  }

  async function handleLookup() {
    if (!lookupId) return;
    setLookupLoading(true);
    setLookedUpCert(null);
    try {
      const cert = await apiFetch<Certificate>(
        `/admin/certifications/${lookupId}`
      );
      setLookedUpCert(cert);
    } catch (err: any) {
      showToast(err.message || "Certificate not found.", "error");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleDownload() {
    if (!lookedUpCert) return;
    try {
      const res = await fetch(
        `${API_BASE}/admin/certifications/${lookedUpCert.id}/download`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${lookedUpCert.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.message || "Could not download certificate.", "error");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SectionCard
        title="Issue a certificate"
        subtitle="Find the user, pick what they're being certified for, and confirm."
      >
        <form onSubmit={handleIssue} className="space-y-4">
          <UserSearchSelect value={selectedUser} onChange={setSelectedUser} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certificate type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CERT_TYPES.map((ct) => (
                <button
                  type="button"
                  key={ct.value}
                  onClick={() => setCertType(ct.value)}
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    certType === ct.value
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-700 border-gray-300 hover:border-green-600"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference ID <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder={`ID of the ${certType} being certified`}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <p className="text-xs text-gray-400 mt-1">
              e.g. if certType is "course", this is the course's ID.
            </p>
          </div>

          <button
            type="submit"
            disabled={issuing}
            className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-md transition"
          >
            {issuing && <Spinner />}
            {issuing ? "Issuing..." : "Issue certificate"}
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Find a certificate"
        subtitle="Look up an already-issued certificate by its ID."
      >
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Certificate ID"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            onClick={handleLookup}
            disabled={lookupLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {lookupLoading ? <Spinner /> : "Search"}
          </button>
        </div>

        {lookedUpCert ? (
          <div className="border border-gray-200 rounded-md p-4 space-y-1 text-sm">
            <p>
              <span className="text-gray-500">Certificate ID:</span>{" "}
              <span className="font-medium">{lookedUpCert.id}</span>
            </p>
            <p>
              <span className="text-gray-500">User ID:</span>{" "}
              <span className="font-medium">{lookedUpCert.userId}</span>
            </p>
            <p>
              <span className="text-gray-500">Type:</span>{" "}
              <span className="font-medium capitalize">
                {lookedUpCert.certType}
              </span>
            </p>
            <p>
              <span className="text-gray-500">Reference ID:</span>{" "}
              <span className="font-medium">{lookedUpCert.referenceId}</span>
            </p>
            {lookedUpCert.issuedAt && (
              <p>
                <span className="text-gray-500">Issued:</span>{" "}
                <span className="font-medium">
                  {new Date(lookedUpCert.issuedAt).toLocaleDateString()}
                </span>
              </p>
            )}
            <button
              onClick={handleDownload}
              className="mt-3 w-full text-sm font-medium py-2 rounded-md border border-green-700 text-green-700 hover:bg-green-50"
            >
              Download as PDF
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Enter a certificate ID above to see its details here.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signatories tab
// ---------------------------------------------------------------------------

interface SignatoryFormState {
  id: number | null;
  name: string;
  title: string;
  isActive: boolean;
  displayOrder: number;
  signatureImage: File | null;
}

const EMPTY_SIGNATORY_FORM: SignatoryFormState = {
  id: null,
  name: "",
  title: "",
  isActive: true,
  displayOrder: 1,
  signatureImage: null,
};

function SignatoryModal({
  initial,
  onClose,
  onSaved,
  showToast,
}: {
  initial: SignatoryFormState;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [form, setForm] = useState<SignatoryFormState>(initial);
  const [saving, setSaving] = useState(false);
  const isEdit = form.id !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.title.trim()) {
      showToast("Name and title are required.", "error");
      return;
    }

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("title", form.title);
    fd.append("isActive", String(form.isActive));
    fd.append("displayOrder", String(form.displayOrder));
    if (form.signatureImage) fd.append("signatureImage", form.signatureImage);

    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/admin/signatories/${form.id}`, {
          method: "PUT",
          body: fd,
        });
        showToast("Signatory updated.", "success");
      } else {
        await apiFetch("/admin/signatories", {
          method: "POST",
          body: fd,
        });
        showToast("Signatory created.", "success");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to save signatory.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit signatory" : "Add signatory"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="e.g. Basil Adeyemi"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="e.g. Founder & CEO"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display order
              </label>
              <select
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: Number(e.target.value) })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value={1}>1 — Left</option>
                <option value={2}>2 — Right</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Max 2 active signatories appear on certificates.
              </p>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                />
                Active
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature image
            </label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={(e) =>
                setForm({
                  ...form,
                  signatureImage: e.target.files?.[0] || null,
                })
              }
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-green-50 file:text-green-700 file:text-sm hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-400 mt-1">
              PNG/JPEG/SVG/WEBP — max 2 MB
              {isEdit ? ". Leave empty to keep the current image." : ""}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-60"
            >
              {saving && <Spinner />}
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SignatoriesTab({
  showToast,
}: {
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<SignatoryFormState>(
    EMPTY_SIGNATORY_FORM
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadSignatories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Signatory[] | { signatories: Signatory[] }>(
        "/admin/signatories"
      );
      const list = Array.isArray(data) ? data : data.signatories || [];
      setSignatories(list);
    } catch (err: any) {
      showToast(err.message || "Failed to load signatories.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSignatories();
  }, [loadSignatories]);

  function openCreate() {
    setModalInitial(EMPTY_SIGNATORY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: Signatory) {
    setModalInitial({
      id: s.id,
      name: s.name,
      title: s.title,
      isActive: s.isActive,
      displayOrder: s.displayOrder,
      signatureImage: null,
    });
    setModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this signatory? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/admin/signatories/${id}`, { method: "DELETE" });
      showToast("Signatory deleted.", "success");
      setSignatories((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      showToast(err.message || "Failed to delete signatory.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Signatories</h3>
          <p className="text-sm text-gray-500">
            Manage the names and signature images shown on certificates.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium rounded-md bg-green-700 text-white hover:bg-green-800"
        >
          + Add signatory
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              <th className="px-4 py-3 font-medium">Signature</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            )}

            {!loading && signatories.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No signatories yet. Add one to get started.
                </td>
              </tr>
            )}

            {!loading &&
              signatories.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {s.signatureImageUrl ? (
                      <img
                        src={s.signatureImageUrl}
                        alt={s.name}
                        className="h-8 object-contain"
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.displayOrder === 1 ? "1 — Left" : "2 — Right"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-gray-500 hover:text-green-700"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === s.id ? <Spinner /> : "🗑️"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SignatoryModal
          initial={modalInitial}
          onClose={() => setModalOpen(false)}
          onSaved={loadSignatories}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell — tab view
// ---------------------------------------------------------------------------

type TabKey = "certifications" | "signatories";

export default function CertificationsSignatoriesPage() {
  const [tab, setTab] = useState<TabKey>("certifications");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
    },
    []
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "certifications", label: "Certifications" },
    { key: "signatories", label: "Signatories" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Certifications</h1>
      <p className="text-sm text-gray-500 mt-1">
        Issue and view certificates, and manage the signatories that appear on
        them.
      </p>

      <div className="border-b border-gray-200 mt-6 mb-6">
        <nav className="flex gap-8">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? "border-green-700 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "certifications" && (
        <CertificationsTab showToast={showToast} />
      )}
      {tab === "signatories" && <SignatoriesTab showToast={showToast} />}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}