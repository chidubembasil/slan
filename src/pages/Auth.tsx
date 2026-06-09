// AdminLogin.tsx
import { useState, useRef, useEffect } from "react";

const BASE = import.meta.env.VITE_BASE_URL;

export default function AdminLogin() {
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [loading, setLoading] = useState(false);

  // SEPARATE EMAILS
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [trustWorkstation, setTrustWorkstation] = useState(false);

  // OTP
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [credErrors, setCredErrors] = useState<Record<string, string>>({});
  const [otpError, setOtpError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  // STEP 1 SUBMIT
  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredErrors({});

    if (mode === "password") {
      if (!loginEmail.trim()) return setCredErrors({ email: "Email is required" });
      if (!password) return setCredErrors({ password: "Password is required" });

      setLoading(true);
      try {
        const res = await fetch(`${BASE}/admin/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: loginEmail,
            password,
            trustWorkstation
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Login failed");

        // Tokens returned immediately - NO OTP STEP
        localStorage.setItem("adminAccessToken", data.accessToken);
        localStorage.setItem("adminRefreshToken", data.refreshToken);
        localStorage.setItem("adminUser", JSON.stringify(data.admin));
        window.location.href = "/";
      } catch (err: any) {
        setCredErrors({ submit: err.message });
      } finally {
        setLoading(false);
      }
    } else {
      // OTP MODE
      if (!otpEmail.trim()) return setCredErrors({ email: "Email is required" });

      setLoading(true);
      try {
        const res = await fetch(`${BASE}/admin/auth/otp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: otpEmail,
            trustWorkstation
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed");

        setStep("otp");
        setOtp(Array(6).fill(""));
        setResendTimer(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } catch (err: any) {
        setCredErrors({ submit: err.message });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d)) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code || otp.join("");
    if (otpCode.length!== 6) return setOtpError("Enter 6 digits");

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: otpEmail, otp: otpCode, trustWorkstation }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid code");

      localStorage.setItem("adminAccessToken", data.accessToken);
      localStorage.setItem("adminRefreshToken", data.refreshToken);
      localStorage.setItem("adminUser", JSON.stringify(data.admin));
      window.location.href = "/";
    } catch (err: any) {
      setOtpError(err.message);
      setOtp(Array(6).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/auth/otp/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend");
      setResendTimer(60);
      setOtp(Array(6).fill(""));
      setOtpError("");
    } catch (err: any) {
      setOtpError(err.message || "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#004900] p-12 text-white flex flex-col justify-between">
          <div>
            <p className="font-bold mb-20">SLAN ADMIN</p>
            <h1 className="text-5xl font-bold leading-tight">Secure Administrator<br/>Access</h1>
            <p className="text-white/70 mt-4">Institutional gateway for state TSCs and Academy facilitators.</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/20 flex flex-row gap-2 items-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Enterprise Grade Security Enabled
          </div>
        </div>

        <div className="p-12 flex flex-col justify-center">
          {step === "credentials"? (
            <>
              <h2 className="text-2xl font-semibold mb-1">Authorize Access</h2>
              <p className="text-sm text-gray-600 mb-6">Enter your credentials to continue.</p>

              <div className="flex border-b mb-6">
                <button
                  onClick={() => setMode("password")}
                  className={`flex-1 pb-2 text-sm font-medium border-b-2 ${
                    mode === "password"? "border-[#004900] text-[#004900]" : "border-transparent text-gray-500"
                  }`}
                >
                  Password Login
                </button>
                <button
                  onClick={() => setMode("otp")}
                  className={`flex-1 pb-2 text-sm font-medium border-b-2 ${
                    mode === "otp"? "border-[#004900] text-[#004900]" : "border-transparent text-gray-500"
                  }`}
                >
                  OTP-Only Access
                </button>
              </div>

              <form onSubmit={handleAuthorize} className="space-y-4">
                {mode === "password"? (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="admin@slan.ng"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20"
                      />
                      {credErrors.email && <p className="text-xs text-red-600 mt-1">{credErrors.email}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">System Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20"
                      />
                      {credErrors.password && <p className="text-xs text-red-600 mt-1">{credErrors.password}</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1.5">
                        OTP Email Address
                      </label>
                      <input
                        type="email"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="admin@slan.ng"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20"
                      />
                      {credErrors.email && <p className="text-xs text-red-600 mt-1">{credErrors.email}</p>}
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-800">We'll send a 6-digit code to this email.</p>
                    </div>
                  </>
                )}

                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={trustWorkstation} onChange={(e) => setTrustWorkstation(e.target.checked)} />
                  Trust this workstation for 8 hours
                </label>

                {credErrors.submit && <p className="text-xs text-red-600">{credErrors.submit}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#004900] text-white py-2.5 rounded-lg font-medium disabled:opacity-60"
                >
                  {loading? "Processing..." : mode === "password"? "Authorize Access →" : "Send Access OTP →"}
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => setStep("credentials")} className="text-xs mb-4 hover:underline w-fit">← Back</button>
              <h2 className="text-2xl font-semibold">Enter Verification Code</h2>
              <p className="text-sm text-gray-600 mb-6">Code sent to <b>{otpEmail}</b></p>

              <div className="flex gap-3 justify-center mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    aria-label="input"
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" &&!digit && i > 0) {
                        otpRefs.current[i - 1]?.focus();
                      }
                    }}
                    className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:border-[#004900] focus:outline-none"
                  />
                ))}
              </div>

              {otpError && <p className="text-xs text-red-600 text-center mb-3">{otpError}</p>}

              <button
                onClick={() => handleVerifyOtp()}
                disabled={otp.join("").length!== 6 || loading}
                className="w-full bg-[#004900] text-white py-3 rounded-lg font-medium disabled:opacity-50"
              >
                {loading? "Verifying..." : "Verify & Continue"}
              </button>

              <p className="text-xs text-center mt-4 text-gray-500">
                Didn't receive code?{" "}
                <button onClick={handleResend} disabled={resendTimer > 0} className="text-[#004900] font-medium disabled:text-gray-400">
                  {resendTimer > 0? `Resend in ${resendTimer}s` : "Resend code"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}