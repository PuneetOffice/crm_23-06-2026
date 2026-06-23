import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Logo_2.png"; // Company logo image
import hero from "../assets/img.jpeg.webp"; // Right-side image
import apiClient from "../api/client"; // central axios client
import AuthContext from "../auth/AuthContext";
import tokenUtils from "../auth/tokenUtils";
import { Eye, EyeOff } from "lucide-react";

function Login() {
  // Email and password fields (controlled inputs)
  const [EmailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Error and success message states
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  // Loading state for spinner
  const [loading, setLoading] = useState(false);
  // Used for page redirection after login
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  // Preload Dashboard chunk as soon as Login page mounts so navigation is instant
  useEffect(() => {
    import("./dashboard");
  }, []);
  // API endpoint is provided by central client baseURL
  const apiUrl = `/Login/check`;

  // Handle Login Submit
  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    const validationErrors = {};
    if (!EmailOrPhone.trim())
      validationErrors.EmailOrPhone = "Email or Phone is required";
    if (!password) validationErrors.password = "Password is required";
    setErrors(validationErrors);
    setMessage("");
    if (Object.keys(validationErrors).length > 0) return;
    setLoading(true);
    try {
      // Send POST request to backend API with emailOrPhone and password
      const response = await apiClient.post(apiUrl, {
        emailOrPhone: EmailOrPhone,
        password,
      });
      // Expecting backend to return { token: "...", role: "admin|manager|user" }
      const respData = response?.data || {};
      const token = respData.token || respData.Token || null;
      // store legacy name/email if provided
      const user = respData.user || respData.User || {};
      const email =
        user.email || user.Email ||
        respData.email || respData.Email ||
        EmailOrPhone;
      let name =
        user.name || user.Name ||
        respData.name || respData.Name ||
        "";

      // If no name from response, try to extract from email or use full EmailOrPhone
      if (!name) {
        name = email?.split("@")[0] || EmailOrPhone?.split("@")[0] || "User";
      }

      if (email) {
        try {
          sessionStorage.setItem("userEmail", email);
          localStorage.setItem("userEmail", email);
        } catch (e) {}
      }
      if (name) {
        try {
          sessionStorage.setItem("userName", name);
          localStorage.setItem("userName", name);
        } catch (e) {}
      }

      if (token) {
        // let AuthContext handle storing token and decoded role
        try {
          auth?.login(token);
        } catch (e) {}
      }

      // Determine role from token or response and redirect accordingly
      let role = respData.role || respData.Role || null;
      if (!role && token) {
        const decoded = tokenUtils.decodeToken(token);
        role = decoded?.role || decoded?.Role || null;
      }

      const successMsg =
        typeof respData === "string" ? respData : respData?.message || "Login successful";
      setMessage(successMsg);
      setErrors({});

      // Redirect by role to role-specific dashboard routes (fall back to /Dashboard)
      if (role === "admin") navigate("/admin");
      else if (role === "manager") navigate("/manager");
      else if (role === "user") navigate("/user");
      else navigate("/Dashboard");
    } catch (error) {
      // Extract backend error message properly
      // Priority 1: Response data from backend (most reliable)
      let errMsg = "";

      const respData = error?.response?.data;
      if (respData) {
        if (typeof respData === "string") {
          errMsg = respData;
        } else if (respData?.message) {
          errMsg = respData.message;
        } else if (respData?.Message) {
          errMsg = respData.Message;
        } else if (respData?.error) {
          errMsg = respData.error;
        }
      }

      // Priority 2: Status code message (fallback only)
      if (!errMsg) {
        const status = error?.response?.status;
        if (status === 404) errMsg = "User not found.";
        else if (status === 400) errMsg = "Invalid credentials.";
        else if (status === 401) errMsg = "Unauthorized. Invalid credentials.";
        else if (status === 500) errMsg = "Server error. Please try again later.";
      }

      // Priority 3: Network error
      if (!errMsg && error?.message === "Network Error") {
        errMsg = "Network error. Please check your connection.";
      }

      // Priority 4: Final fallback (never show raw error)
      if (!errMsg) errMsg = "Incorrect username and password";

      // Clean up message: remove any HTML tags, scripts, or sensitive info
      errMsg = errMsg
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/\r\n/g, " ") // Windows newlines
        .replace(/\n/g, " ") // Unix newlines
        .trim()
        .substring(0, 200); // Limit length

      setErrors({ general: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[125vh] flex items-center justify-center bg-gradient-to-br from-[#1f1c2c] to-[#928dab] p-4 md:p-8"
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      {/* Logo - centered on mobile, top-left on desktop */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 md:left-8 md:translate-x-0 z-20">
        <img
          src={logo}
          alt="Logo"
          className="w-32 h-10 md:w-36 md:h-12 object-contain"
        />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl mx-auto mt-16 md:mt-0">
        <div className="flex flex-col md:flex-row w-full min-h-[600px] bg-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl border border-white/20">
          {/* Left Side - Image (hidden on mobile) */}
          <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#f9f6f6]/80 to-[#928dab]/80 z-0" />
            <img
              src={hero}
              alt="Login visual"
              className="w-full h-full object-cover z-10"
            />
          </div>

          {/* Right Side - Login Form */}
          <div className="flex-1 md:w-1/2 flex items-center justify-center p-8 md:p-12 lg:p-16 bg-[#ceccd6] backdrop-blur-sm">
            <div className="w-full max-w-[420px] space-y-8">
              {/* Header */}
              <div className="space-y-1 text-center md:text-left">
                <h2 className="text-3xl font-semibold text-[#8a7594]">Welcome!</h2>
                <p className="text-gray-500">Login to your account</p>
              </div>

              {/* Form */}
              <form onSubmit={handleVerifyLogin} className="space-y-5">
                {/* Email/Phone Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-[#6d516d]"
                  >
                    Email or Phone
                  </label>
                  <input
                    id="email"
                    type="text"
                    placeholder="Enter your email or phone"
                    value={EmailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    className={`w-full h-12 px-4 rounded-xl border ${
                      errors.EmailOrPhone
                        ? "border-red-400 bg-red-50/50"
                        : "border-[#0f1724]/10 bg-white/80"
                    } text-[#0f1724] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#928dab] text-[0.95rem] shadow-sm transition-all duration-200`}
                  />
                  {errors.EmailOrPhone && (
                    <p className="text-[#e05c5c] text-xs mt-1">{errors.EmailOrPhone}</p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-[#6d516d]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full h-12 px-4 pr-12 rounded-xl border ${
                        errors.password
                          ? "border-red-400 bg-red-50/50"
                          : "border-[#0f1724]/10 bg-white/80"
                      } text-[#0f1724] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#928dab] text-[0.95rem] shadow-sm transition-all duration-200`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[#e05c5c] text-xs mt-1">{errors.password}</p>
                  )}
                </div>

                {/* Forgot Password */}
                <div className="flex justify-end">
                  <a
                    href="/forgot"
                    className="text-sm text-[#613a6b] hover:text-[#8a5a9a] transition-colors font-medium"
                  >
                    Forgot password?
                  </a>
                </div>

                {/* General Error */}
                {errors.general && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-xl">
                    <p className="text-sm text-red-700">{errors.general}</p>
                  </div>
                )}

                {/* Success Message */}
                {message && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm text-green-700">{message}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-[#573c66] text-[#e6cdf2] font-medium shadow-lg hover:bg-[#6d4d7a] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-[#e6cdf2]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
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
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

