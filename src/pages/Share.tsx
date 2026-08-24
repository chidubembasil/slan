import { useState } from "react";
import { UserPlus, X, Mail, User as UserIcon, ShieldCheck } from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthGuard"
const API_BASE_RAW = import.meta.env.VITE_BASE_URL as string;
const API = (API_BASE_RAW ?? "").replace(/\/+$/, "");

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
  useAuthGuard();

  const [invitedAdmins, setInvitedAdmins] = useState<InvitedAdmin[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InviteFormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function authHeaders() {
    const token = localStorage.getItem("adminAccessToken") || localStorage.getItem("token") || "";
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
    // ensure we are authenticated - matches Auth.tsx saveSession keys
    const rawToken = localStorage.getItem("adminAccessToken") || localStorage.getItem("token") || "";
    if (!rawToken) {
      setError("Not authenticated — please log in again.");
      return;
    }
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${API}/admin/admins`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          // Provide frontend URLs so backend can embed correct login URL in the email.
          // Backend may expect any of these keys; sending all is safe.
          appUrl: origin,
          frontendUrl: origin,
          loginUrl: `${origin}/`,
          platformUrl: origin,
          inviteUrl: `${origin}/`,
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
          message = d?.message || d?.error || d?.msg || message;
          if (res.status === 401) message = "Unauthorized — admin token missing or expired. Please log in again.";
          if (res.status === 403) message = "Forbidden — you don't have permission to invite admins.";
        } catch {}
        // include status for debugging
        throw new Error(`${message} (${res.status})`);
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#004900]/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#004900]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Admins</h2>
            <p className="text-sm text-gray-500">Invite and manage administrator accounts</p>
          </div>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[#004900] text-white hover:bg-[#003600] shadow-sm shadow-[#004900]/20 transition-all duration-200"
        >
          <UserPlus className="w-4 h-4" />
          Invite Admin
        </button>
      </div>

      <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200/80 text-left text-gray-500">
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Full Name</th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Email</th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Invited</th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invitedAdmins.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">No admins invited yet</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Invite Admin" to add the first one.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {invitedAdmins.map((admin, idx) => (
              <tr key={`${admin.email}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">{admin.fullName}</td>
                <td className="px-5 py-3.5 text-gray-600">{admin.email}</td>
                <td className="px-5 py-3.5 text-gray-500 text-sm">
                  {new Date(admin.invitedAt).toLocaleString()}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              title="cancel"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#004900]/10 flex items-center justify-center mb-3">
                <UserPlus className="w-5 h-5 text-[#004900]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Invite a new administrator</h3>
              <p className="text-sm text-gray-500 mt-1">
                Creates an admin account and emails a temporary password. The new admin signs in
                with email + temp password, then completes OTP verification.
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <span className="text-red-600 text-xs font-bold">!</span>
                </div>
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Mesiye Johnson"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
                    title="full name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="johnsonmesh20@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
                    title="email"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={submitting}
                className="px-4 py-2.5 text-sm rounded-xl bg-[#004900] text-white hover:bg-[#003600] disabled:opacity-50 shadow-sm shadow-[#004900]/20 transition-all font-medium"
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