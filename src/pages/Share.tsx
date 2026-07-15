import { useState } from "react";
import { UserPlus, X, Mail, User as UserIcon, ShieldCheck } from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL;

interface InvitedAdmin {
  fullName: string;
  email: string;
  invitedAt: string;
}

interface InviteFormState {
  fullName: string;
  email: string;
}

function emptyForm(): InviteFormState {
  return { fullName: "", email: "" };
}

export default function AdminUsers() {
  // There's no documented GET /admin/admins endpoint yet, so this keeps a
  // local running list of admins invited during this session as a lightweight
  // confirmation trail. Swap this for real fetched data once a list endpoint
  // exists.
  const [invitedAdmins, setInvitedAdmins] = useState<InvitedAdmin[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InviteFormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem("adminAccessToken") || "";

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  function openModal() {
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setForm(emptyForm());
    setError(null);
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return "Full name is required";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) return "Enter a valid email address";
    return null;
  }

  async function handleInvite() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}admin/admins`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
        }),
      });

      if (res.status === 409) {
        setError("Email already in use");
        return;
      }

      if (!res.ok) {
        let message = "Failed to invite administrator";
        try {
          const d = await res.json();
          message = d?.message || d?.error || message;
        } catch {}
        throw new Error(message);
      }

      setInvitedAdmins((prev) => [
        {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          invitedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setModalOpen(false);
      setForm(emptyForm());
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Admins</h2>
          <p className="text-sm text-gray-500">Invite and manage administrator accounts</p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#004900] text-white hover:bg-[#003600]"
        >
          <UserPlus className="w-4 h-4" />
          Invite Admin
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Invited</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invitedAdmins.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No admins invited yet. Click "Invite Admin" to add one.
                </td>
              </tr>
            )}
            {invitedAdmins.map((admin, idx) => (
              <tr key={`${admin.email}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{admin.fullName}</td>
                <td className="px-4 py-3 text-gray-700">{admin.email}</td>
                <td className="px-4 py-3 text-gray-700">
                  {new Date(admin.invitedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-[#004900]">
                    <ShieldCheck className="w-3 h-3" />
                    Invited
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="cancel"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold mb-1">Invite a new administrator</h3>
            <p className="text-sm text-gray-500 mb-5">
              Creates an admin account and emails a temporary password. The new admin signs in
              with email + temp password, then completes OTP verification.
            </p>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Full Name</label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Mesiye Johnson"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/30 focus:border-[#004900]"
                    title="full name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="johnsonmesh20@gmail.com"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/30 focus:border-[#004900]"
                    title="email"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg bg-[#004900] text-white hover:bg-[#003600] disabled:opacity-50"
              >
                {submitting ? "Sending invite..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}