import React, { useState } from "react";
import { UserPlus, Mail, User, Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

// Adjust this to wherever you keep your base API URL constant
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

interface InvitedAdmin {
  fullName: string;
  email: string;
  status: "success" | "error";
  message: string;
}

const AddAdmin: React.FC = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invitedList, setInvitedList] = useState<InvitedAdmin[]>([]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return "Full name is required.";
    if (!email.trim()) return "Email is required.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return "Enter a valid email address.";
    return null;
  };

  const handleInvite = async () => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setLoading(true);

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
        }),
      });

      if (response.status === 201) {
        setInvitedList((prev) => [
          {
            fullName: fullName.trim(),
            email: email.trim(),
            status: "success",
            message: "Invite sent — temp password emailed",
          },
          ...prev,
        ]);
        resetForm();
      } else if (response.status === 409) {
        setInvitedList((prev) => [
          {
            fullName: fullName.trim(),
            email: email.trim(),
            status: "error",
            message: "Email already in use",
          },
          ...prev,
        ]);
      } else {
        const data = await response.json().catch(() => null);
        setFormError(data?.message || `Something went wrong (${response.status}).`);
      }
    } catch (err) {
      setFormError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleInvite();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Admin</h1>
        <p className="text-gray-500 mt-1">Invite a new administrator to SLAN Admin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Invite form card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#0049001A" }}
              >
                <ShieldCheck size={18} style={{ color: "#004900" }} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Invite Administrator</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Mesioye Johnson"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-offset-0"
                    style={{ boxShadow: "none" }}
                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px #00490033")}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. johnsonmesh20@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm
                      focus:outline-none"
                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px #00490033")}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    disabled={loading}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-white font-medium
                  py-2.5 rounded-lg transition-opacity disabled:opacity-70"
                style={{ backgroundColor: "#004900" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending invite...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Send Invite
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center pt-1">
                A temporary password will be emailed to the new admin. They'll complete OTP
                verification on first sign-in.
              </p>
            </form>
          </div>
        </div>

        {/* Recently invited list */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Recent Invites</h2>
              <p className="text-sm text-gray-500 mt-0.5">This session only</p>
            </div>

            {invitedList.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                No invites sent yet. Invited admins will appear here.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invitedList.map((admin, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3.5 font-medium text-gray-900">{admin.fullName}</td>
                      <td className="px-6 py-3.5 text-gray-600">{admin.email}</td>
                      <td className="px-6 py-3.5">
                        {admin.status === "success" ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: "#0049001A", color: "#004900" }}
                          >
                            <CheckCircle2 size={12} />
                            {admin.message}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
                            <XCircle size={12} />
                            {admin.message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAdmin;