import { useState, useRef, useEffect } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);

  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpError, setOtpError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem("adminAccessToken");
    const expiry = localStorage.getItem("adminTokenExpiry");
    if (token && expiry && Date.now() < Number(expiry)) {
      window.location.href = "/dashboard";
    }
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const saveSession = (data: any) => {
    const token = data.data?.accessToken || data.data?.token || data.accessToken || data.token;
    const refresh = data.data?.refreshToken || data.refreshToken;
    const user = data.data?.admin || data.data?.user || data.admin || data.user;

    localStorage.setItem("adminAccessToken", token);
    localStorage.setItem("adminRefreshToken", refresh);
    localStorage.setItem("adminUser", JSON.stringify(user));
    const hours = trustDevice? 8 : 1;
    localStorage.setItem("adminTokenExpiry", String(Date.now() + hours * 3600 * 1000));
  };

  // STEP 1: send OTP
  const handleCredentialsNext = async () => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length) return setErrors(newErrors);

    setOtpSending(true);
    setErrors({});
    try {
      const res = await fetch(`${BASE}admin/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setStep("otp");
      setResendTimer(60);
      setOtp(Array(6).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setErrors({ email: err.message });
    } finally {
      setOtpSending(false);
    }
  };

  // STEP 2: verify OTP + login
  const handleSubmit = async (otpOverride?: string) => {
    const currentOtp = otpOverride?? otp.join("");
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    if (currentOtp.length!== 6) newErrors.otp = "Enter the 6-digit OTP";
    if (Object.keys(newErrors).length) return setErrors(newErrors);

    setLoading(true);
    setErrors({});
    try {
      const res = await fetch(`${BASE}admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          otp: currentOtp,
          trustWorkstation: trustDevice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      saveSession(data);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");
    setErrors((prev) => ({...prev, otp: "" }));
    if (value && index < 5) otpRefs.current[index + 1]?.focus();

    if (newOtp.every((d) => d) && email && password) {
      setTimeout(() => handleSubmit(newOtp.join("")), 80);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 ||!email) return;
    setOtpSending(true);
    setOtp(Array(6).fill(""));
    setOtpError("");
    try {
      const res = await fetch(`${BASE}admin/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend");
      setResendTimer(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Left panel */}
        <div className="bg-[#004900] p-10 lg:p-12 text-white flex flex-col justify-between">
          <div>
            <p className="font-bold text-sm tracking-widest uppercase mb-10 lg:mb-20 opacity-80">SLAN ADMIN</p>
            <h1 className="text-3xl lg:text-5xl font-bold leading-tight">Secure<br/>Administrator<br/>Access</h1>
            <p className="text-white/70 mt-3 text-sm lg:text-base">Institutional gateway for state TSCs and Academy facilitators.</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-semibold mb-1">Authorize Access</h2>
          <p className="text-sm text-gray-500 mb-7">
            {step === 'credentials'? 'Enter your credentials to continue.' : 'Enter the 6-digit code sent to your email.'}
          </p>

          <div className="space-y-4">
            {step === 'credentials'? (
              <>
                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">Email Address</label>
                  <div className="relative">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] pr-10" />
                    {otpSending && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin h-4 w-4 text-[#004900]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                      </span>
                    )}
                  </div>
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]" />
                  {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="rounded" />
                  Trust this workstation for 8 hours
                </label>

                {errors.submit && <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"><p className="text-xs text-red-700">{errors.submit}</p></div>}

                <button type="button" onClick={handleCredentialsNext} disabled={otpSending} className="w-full bg-[#004900] text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60 hover:bg-[#005c00] transition-colors mt-2">
                  {otpSending? "Sending OTP…" : "Login →"}
                </button>
              </>
            ) : (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-gray-500">OTP sent to</p>
                    <p className="text-sm font-medium text-gray-900">{email}</p>
                  </div>
                  <button type="button" onClick={() => setStep('credentials')} className="text-xs text-[#004900] font-medium">Change</button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-700">OTP Code</label>
                    <button type="button" onClick={handleResend} disabled={resendTimer > 0 || otpSending} className="text-xs text-[#004900] font-medium disabled:text-gray-400 disabled:cursor-not-allowed">
                      {otpSending? "Sending…" : resendTimer > 0? `Resend in ${resendTimer}s` : "Resend OTP"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {otp.map((digit, i) => (
                      <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1} value={digit} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" &&!digit && i > 0) otpRefs.current[i - 1]?.focus(); }} onPaste={(e) => { e.preventDefault(); const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (!pasted) return; const newOtp = [...otp]; pasted.split("").forEach((ch, idx) => { if (idx < 6) newOtp[idx] = ch; }); setOtp(newOtp); }} className={`flex-1 min-w-0 h-12 text-center text-xl font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${digit? "border-[#004900] focus:ring-[#004900]/20" : "border-gray-300 focus:border-[#004900] focus:ring-[#004900]/20"}`} aria-label="input"/>
                    ))}
                  </div>
                  {(errors.otp || otpError) && <p className="text-xs text-red-600 mt-1">{errors.otp || otpError}</p>}
                </div>

                {errors.submit && <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"><p className="text-xs text-red-700">{errors.submit}</p></div>}

                <button type="button" onClick={() => handleSubmit()} disabled={loading || otp.join("").length!== 6} className="w-full bg-[#004900] text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60 hover:bg-[#005c00] transition-colors mt-2">
                  {loading? "Authorizing…" : "Submit →"}
                </button>
                <button type="button" onClick={() => setStep('credentials')} className="w-full text-xs text-gray-500 mt-1 hover:text-gray-700">Back to login</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
