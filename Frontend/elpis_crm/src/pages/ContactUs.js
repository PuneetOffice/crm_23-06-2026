import React, { useState } from "react";
import logo from "../assets/Logo_2.png"; // Company logo image
import apiClient from "../api/client"; // central axios client
import { Mail, Phone, MapPin, CheckCircle2, Send } from "lucide-react";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  jobTitle: "",
  subject: "",
  message: "",
};

function ContactUs() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // success result from backend
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validate = () => {
    const v = {};
    if (!form.firstName.trim()) v.firstName = "First name is required";
    if (!form.company.trim()) v.company = "Company is required";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      v.email = "Enter a valid email";
    return v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    setResult(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || null,
        company: form.company.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        subject: form.subject.trim() || null,
        message: form.message.trim() || null,
      };

      const response = await apiClient.post("/ContactUs", payload);
      setResult(response?.data || { message: "Thanks! We'll be in touch." });
      setForm(EMPTY_FORM);
    } catch (error) {
      const respData = error?.response?.data || error;
      let msg =
        (typeof respData === "string" && respData) ||
        respData?.message ||
        respData?.Message ||
        "Something went wrong. Please try again.";
      msg = String(msg).replace(/<[^>]*>/g, "").trim().substring(0, 200);
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const field = (name, label, { type = "text", required, placeholder, full } = {}) => (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <label className="block text-[13px] font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={form[name]}
        onChange={handleChange}
        className={`w-full h-11 px-4 rounded-lg border bg-slate-50/60 text-slate-800 placeholder:text-slate-400 text-[0.95rem] outline-none transition-all duration-200 focus:bg-white focus:ring-2 ${
          errors[name]
            ? "border-rose-300 focus:ring-rose-200"
            : "border-slate-200 focus:border-violet-400 focus:ring-violet-100"
        }`}
      />
      {errors[name] && <p className="text-rose-500 text-xs">{errors[name]}</p>}
    </div>
  );

  return (
    <div
      className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10"
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl shadow-slate-300/40 overflow-hidden grid grid-cols-1 lg:grid-cols-5">
        {/* Left info panel */}
        <aside className="lg:col-span-2 relative bg-gradient-to-br from-[#3b2a4d] via-[#573c66] to-[#8a5a9a] text-white p-8 sm:p-10 flex flex-col">
          <img
            src={logo}
            alt="Logo"
            className="w-32 h-10 object-contain brightness-0 invert mb-10"
          />
          <h1 className="text-3xl font-semibold leading-tight">Let's talk</h1>
          <p className="mt-3 text-white/70 text-[0.95rem] leading-relaxed">
            Share a few details about what you're looking for and our team will
            get back to you shortly.
          </p>

          <div className="mt-10 space-y-5 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </span>
              <span className="text-white/85">info@elpisitsolutions.com</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </span>
              <span className="text-white/85">+91 98765 43210</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </span>
              <span className="text-white/85">Bangalore, India</span>
            </div>
          </div>

          <div className="mt-auto pt-10 text-xs text-white/50">
            © {`${new Date().getFullYear()}`} Elpis IT Solutions
          </div>
        </aside>

        {/* Right form panel */}
        <main className="lg:col-span-3 p-8 sm:p-10">
          {result ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
              <h2 className="mt-4 text-2xl font-semibold text-slate-800">
                Thank you!
              </h2>
              <p className="mt-2 text-slate-500 max-w-sm">
                {result.message || "Your enquiry has been received."}
              </p>
              {result.dealName && (
                <p className="mt-2 text-sm text-slate-400">
                  Reference: <span className="font-medium">{result.dealName}</span>
                </p>
              )}
              <button
                onClick={() => setResult(null)}
                className="mt-8 h-11 px-6 rounded-lg bg-[#573c66] text-white font-medium shadow-sm hover:bg-[#6d4d7a] active:scale-[0.98] transition-all duration-200"
              >
                Submit another enquiry
              </button>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-slate-800">
                  Contact Us
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Fields marked <span className="text-rose-500">*</span> are required.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field("firstName", "First Name", { required: true, placeholder: "John" })}
                {field("lastName", "Last Name", { placeholder: "Doe" })}
                {field("company", "Company", { required: true, placeholder: "Acme Corp" })}
                {field("jobTitle", "Job Title", { placeholder: "Procurement Manager" })}
                {field("email", "Email", { type: "email", placeholder: "john@acme.com" })}
                {field("phone", "Phone", { type: "tel", placeholder: "+91 98765 43210" })}
                {field("subject", "Subject", { full: true, placeholder: "Need CRM licenses" })}

                {/* Message */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-[13px] font-medium text-slate-600">
                    Message
                  </label>
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Tell us more about what you need..."
                    value={form.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder:text-slate-400 text-[0.95rem] outline-none transition-all duration-200 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-y"
                  />
                </div>

                {/* Server error */}
                {serverError && (
                  <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <p className="text-sm text-rose-700">{serverError}</p>
                  </div>
                )}

                {/* Submit */}
                <div className="sm:col-span-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-lg bg-[#573c66] text-white font-medium shadow-sm hover:bg-[#6d4d7a] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 text-white"
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
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Enquiry</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default ContactUs;
