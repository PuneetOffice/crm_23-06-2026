// Forgot password page component
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Logo.png";
import hero from "../assets/img.jpeg.webp";
import apiClient from "../api/client";
import { Eye, EyeOff } from "lucide-react";

function Forgot() {
  // Step: 1 = enter email, 2 = enter OTP, 3 = reset password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // API endpoints
  const generateOtpUrl = `/ForgotPassword/generate-otp`;
  const validateOtpUrl = `/ForgotPassword/validate-otp`;
  const resetPasswordUrl = `/ForgotPassword/update-password`;

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }
    try {
      const res = await apiClient.post(generateOtpUrl, { email });
      const msg =
        typeof res.data === "object" && res.data !== null
          ? res.data.message
          : res.data;
      setMessage(msg || "OTP sent to your email");
      setStep(2);
    } catch (err) {
      const errData = err.response?.data;
      const errMsg =
        typeof errData === "string"
          ? errData
          : errData?.message || "Failed to send OTP";
      setErrors({ general: errMsg });
    }
  };

  // Step 2: Validate OTP
  const handleValidateOtp = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    if (!otp.trim()) {
      setErrors({ otp: "OTP is required" });
      return;
    }
    try {
      const res = await apiClient.post(validateOtpUrl, { email, otp });
      const msg =
        typeof res.data === "object" && res.data !== null
          ? res.data.message
          : res.data;
      setMessage(msg || "OTP verified");
      setStep(3);
    } catch (err) {
      const errData = err.response?.data;
      const errMsg =
        typeof errData === "string"
          ? errData
          : errData?.message || "Invalid OTP";
      setErrors({ general: errMsg });
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    if (!newPassword) {
      setErrors({ newPassword: "New password is required" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    try {
      const res = await apiClient.post(resetPasswordUrl, { email, newPassword });
      const msg =
        typeof res.data === "object" && res.data !== null
          ? res.data.message
          : res.data;
      setMessage(msg || "Password reset successful");
      setTimeout(() => navigate("/Login"), 1500);
    } catch (err) {
      const errData = err.response?.data;
      const errMsg =
        typeof errData === "string"
          ? errData
          : errData?.message || "Failed to reset password";
      setErrors({ general: errMsg });
    }
  };

  // Reusable error display
  const ErrorMsg = ({ text }) =>
    text ? <p className="text-[#e05c5c] text-xs mt-1">{text}</p> : null;

  // Reusable success display
  const SuccessMsg = ({ text }) =>
    text ? (
      <div className="p-3 bg-green-50 border border-green-200 rounded-xl mt-2">
        <p className="text-sm text-green-700">{text}</p>
      </div>
    ) : null;

  // Reusable general error display
  const GeneralError = ({ text }) =>
    text ? (
      <div className="p-3 bg-red-100 border border-red-300 rounded-xl mt-2">
        <p className="text-sm text-red-700">{text}</p>
      </div>
    ) : null;

  return (
    <div
      className="min-h-[125vh] flex items-center justify-center bg-gradient-to-br from-[#1f1c2c] to-[#928dab] p-4 md:p-8"
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      {/* Logo - centered on mobile, top-left on desktop */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 md:left-8 md:translate-x-0 z-20">
        <img src={logo} alt="Logo" className="w-32 h-10 md:w-36 md:h-12 object-contain" />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl mx-auto mt-16 md:mt-0">
        <div className="flex flex-col md:flex-row w-full min-h-[600px] bg-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl border border-white/20">

          {/* Left Side - Image (hidden on mobile) */}
          <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#f9f6f6]/80 to-[#928dab]/80 z-0" />
            <img
              src={hero}
              alt="Forgot visual"
              className="w-full h-full object-cover z-10"
            />
            
          </div>

          {/* Right Side - Forgot Form */}
          <div className="flex-1 md:w-1/2 flex items-center justify-center p-8 md:p-12 lg:p-16 bg-[#ceccd6] backdrop-blur-sm">
            <div className="w-full max-w-[420px] space-y-8">

              {/* Header */}
              <div className="space-y-1 text-center md:text-left">
                <h2 className="text-3xl font-semibold text-[#8a7594]">Forgot Password</h2>
                <p className="text-gray-500">Reset your account password</p>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <React.Fragment key={s}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                        step === s
                          ? "bg-[#573c66] text-[#e6cdf2] shadow-md"
                          : step > s
                          ? "bg-[#8a7594] text-white"
                          : "bg-white/60 text-[#8a7594]"
                      }`}
                    >
                      {s}
                    </div>
                    {s < 3 && (
                      <div
                        className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                          step > s ? "bg-[#8a7594]" : "bg-white/40"
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Step 1 - Email */}
              {step === 1 && (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-[#6d516d]"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl border ${
                        errors.email
                          ? "border-red-400 bg-red-50/50"
                          : "border-[#0f1724]/10 bg-white/80"
                      } text-[#0f1724] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#928dab] text-[0.95rem] shadow-sm transition-all duration-200`}
                    />
                    <ErrorMsg text={errors.email} />
                  </div>

                  <GeneralError text={errors.general} />
                  <SuccessMsg text={message} />

                  <div className="flex justify-end">
                    <a
                      href="/"
                      className="text-sm text-[#613a6b] hover:text-[#8a5a9a] transition-colors font-medium"
                    >
                      Back to Login
                    </a>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-[#573c66] text-[#e6cdf2] font-medium shadow-lg hover:bg-[#6d4d7a] active:scale-[0.98] transition-all duration-200"
                  >
                    Send OTP
                  </button>
                </form>
              )}

              {/* Step 2 - OTP */}
              {step === 2 && (
                <form onSubmit={handleValidateOtp} className="space-y-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="otp"
                      className="block text-xs font-medium text-[#6d516d]"
                    >
                      OTP
                    </label>
                    <input
                      id="otp"
                      type="text"
                      placeholder="Enter OTP sent to your email"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl border ${
                        errors.otp
                          ? "border-red-400 bg-red-50/50"
                          : "border-[#0f1724]/10 bg-white/80"
                      } text-[#0f1724] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#928dab] text-[0.95rem] shadow-sm transition-all duration-200`}
                    />
                    <ErrorMsg text={errors.otp} />
                  </div>

                  <GeneralError text={errors.general} />
                  <SuccessMsg text={message} />

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={() => { setStep(1); setErrors({}); setMessage(""); }}
                      className="text-sm text-[#613a6b] hover:text-[#8a5a9a] transition-colors font-medium"
                    >
                      ← Back
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-[#573c66] text-[#e6cdf2] font-medium shadow-lg hover:bg-[#6d4d7a] active:scale-[0.98] transition-all duration-200"
                  >
                    Verify OTP
                  </button>
                </form>
              )}

              {/* Step 3 - Reset Password */}
              {step === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="newPassword"
                      className="block text-xs font-medium text-[#6d516d]"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full h-12 px-4 pr-12 rounded-xl border ${
                          errors.newPassword
                            ? "border-red-400 bg-red-50/50"
                            : "border-[#0f1724]/10 bg-white/80"
                        } text-[#0f1724] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#928dab] text-[0.95rem] shadow-sm transition-all duration-200`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <ErrorMsg text={errors.newPassword} />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="confirmPassword"
                      className="block text-xs font-medium text-[#6d516d]"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full h-12 px-4 pr-12 rounded-xl border ${
                          errors.confirmPassword
                            ? "border-red-400 bg-red-50/50"
                            : "border-[#0f1724]/10 bg-white/80"
                        } text-[#0f1724] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#928dab] text-[0.95rem] shadow-sm transition-all duration-200`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <ErrorMsg text={errors.confirmPassword} />
                  </div>

                  <GeneralError text={errors.general} />
                  <SuccessMsg text={message} />

                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-[#573c66] text-[#e6cdf2] font-medium shadow-lg hover:bg-[#6d4d7a] active:scale-[0.98] transition-all duration-200"
                  >
                    Reset Password
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>);
} 
 

export default Forgot;