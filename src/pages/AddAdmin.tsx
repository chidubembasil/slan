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
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add Admin</h1>
        <p className="text-gray-500 mt-1">Invite a new administrator to SLAN Admin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Invite form card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200/60 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#004900]/10 flex items-center justify-center">
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
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all duration-200 hover:border-gray-300"
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
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all duration-200 hover:border-gray-300"
                    disabled={loading}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 animate-slide-down">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-white font-medium
                  py-2.5 rounded-xl transition-all duration-300 bg-gradient-to-r from-[#004900] to-[#005c00] hover:from-[#005c00] hover:to-[#004900] hover:shadow-lg hover:shadow-[#004900]/25 active:scale-[0.98] disabled:opacity-70"
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
          <div className="bg-white border border-gray-200/60 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
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
                    <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invitedList.map((admin, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors duration-200">
                      <td className="px-6 py-3.5 font-medium text-gray-900">{admin.fullName}</td>
                      <td className="px-6 py-3.5 text-gray-600">{admin.email}</td>
                      <td className="px-6 py-3.5">
                        {admin.status === "success" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#004900]/10 text-[#004900]">
                            <CheckCircle2 size={12} />
                            {admin.message}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
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