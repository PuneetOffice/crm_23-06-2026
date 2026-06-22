import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiShield,
  FiEdit3,
  FiCheck,
  FiX,
  FiLock,
  FiEye,
  FiEyeOff,
  FiCalendar,
  FiActivity,
  FiSave,
  FiArrowLeft,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";

/* ─── Helpers ─────────────────────────────────────── */
const ROLE_META = {
  admin:   { label: "Admin",   bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200",   dot: "bg-rose-400"   },
  manager: { label: "Manager", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-400" },
  user:    { label: "User",    bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot: "bg-emerald-400" },
};

function getRoleMeta(role) {
  return ROLE_META[(role || "").toLowerCase()] || ROLE_META.user;
}

function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email ? email[0].toUpperCase() : "U";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "bg-red-500"    };
  if (score <= 2) return { score, label: "Fair",   color: "bg-orange-400" };
  if (score <= 3) return { score, label: "Good",   color: "bg-yellow-400" };
  if (score <= 4) return { score, label: "Strong", color: "bg-emerald-500"};
  return                 { score, label: "Very Strong", color: "bg-green-500"  };
}

/* ─── Sub-components ──────────────────────────────── */

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const styles =
    type === "success"
      ? "bg-emerald-600 text-white"
      : "bg-red-600 text-white";
  const Icon = type === "success" ? FiCheckCircle : FiAlertCircle;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
        text-sm font-medium ${styles} animate-slide-up`}
      style={{ animation: "slideUp 0.3s ease" }}
    >
      <Icon size={18} />
      {message}
    </div>
  );
}

function FieldRow({ icon: Icon, label, value, editing, inputProps }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon size={15} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {editing ? (
          <input
            {...inputProps}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
              transition-all placeholder-gray-400"
          />
        ) : (
          <p className="text-sm text-gray-800 font-medium truncate">{value || <span className="text-gray-400 italic">Not set</span>}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────── */

export default function Profile() {
  const navigate = useNavigate();

  /* profile data */
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState("");

  /* info edit */
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving]       = useState(false);
  const [infoError, setInfoError] = useState("");

  /* password */
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwError, setPwError]       = useState("");

  /* toast */
  const [toast, setToast] = useState(null);

  /* animated avatar ring */
  const [avatarPulse, setAvatarPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAvatarPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  /* ── Fetch profile ── */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.get("/Login/me");
        setProfile(res.data);
        setEditForm({
          name:  res.data.name  || "",
          email: res.data.email || "",
          phone: res.data.phone || "",
        });
      } catch (err) {
        setFetchError("Failed to load profile. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Handlers ── */
  const handleEditToggle = () => {
    if (!editing) {
      setEditForm({ name: profile.name || "", email: profile.email || "", phone: profile.phone || "" });
      setInfoError("");
    }
    setEditing((v) => !v);
  };

  const handleSaveInfo = async () => {
    if (!editForm.name.trim())  { setInfoError("Name is required."); return; }
    if (!editForm.email.trim()) { setInfoError("Email is required."); return; }
    setSaving(true);
    setInfoError("");
    try {
      const res = await apiClient.put("/Login/me", {
        name:  editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      });
      setProfile(res.data.user);
      setEditing(false);
      setToast({ message: "Profile updated successfully.", type: "success" });
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update profile.";
      setInfoError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.newPassword)                              { setPwError("New password is required."); return; }
    if (pwForm.newPassword.length < 6)                    { setPwError("Password must be at least 6 characters."); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword)    { setPwError("Passwords do not match."); return; }
    setPwSaving(true);
    setPwError("");
    try {
      await apiClient.put("/Login/change-password", { newPassword: pwForm.newPassword });
      setPwForm({ newPassword: "", confirmPassword: "" });
      setToast({ message: "Password changed successfully.", type: "success" });
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to change password.";
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  };

  /* ── Derived ── */
  const roleMeta   = getRoleMeta(profile?.role);
  const initials   = getInitials(profile?.name, profile?.email);
  const strength   = passwordStrength(pwForm.newPassword);

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-gray-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiAlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <>
      <style>{`
        @keyframes slideUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn   { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes ringPulse { 0%,100% { box-shadow:0 0 0 0 rgba(99,102,241,.35); } 60% { box-shadow:0 0 0 14px rgba(99,102,241,0); } }
        .animate-slide-up  { animation: slideUp  .3s ease both; }
        .animate-fade-in   { animation: fadeIn   .4s ease both; }
        .animate-scale-in  { animation: scaleIn  .35s ease both; }
        .ring-pulse        { animation: ringPulse 2s ease-in-out 3; }
      `}</style>

      <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-blue-50/30 animate-fade-in">

        {/* ── Back bar ── */}
        <div className="px-6 pt-5 pb-0">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors group"
          >
            <FiArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        </div>

        {/* ── Hero Banner ── */}
        <div className="mx-6 mt-4 rounded-2xl overflow-hidden border border-blue-100 bg-gradient-to-r from-sky-50 to-blue-50 shadow-sm">
          <div className="px-8 py-8 flex flex-col sm:flex-row items-center sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className={`w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center
                  text-blue-600 text-2xl font-medium border-2 border-blue-200 shadow-sm select-none
                  ${avatarPulse ? "ring-pulse" : ""}`}
              >
                {initials}
              </div>
              <span className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white
                ${profile?.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
            </div>

            {/* Name & meta */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl text-slate-800">
                {profile?.name || "Unknown User"}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">{profile?.email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border}`}>
                  <FiShield size={10} />
                  {roleMeta.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border
                  ${profile?.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile?.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                  {profile?.isActive ? "Active" : "Inactive"}
                </span>
                {profile?.createdAt && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white border border-blue-100 text-slate-500">
                    <FiCalendar size={10} />
                    Member since {formatDateShort(profile.createdAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Edit toggle */}
            <div className="sm:self-center">
              <button
                onClick={handleEditToggle}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all duration-200 active:scale-95
                  ${editing
                    ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    : "bg-white text-slate-700 border-blue-200 hover:bg-blue-50 hover:border-blue-300"}`}
              >
                {editing ? <><FiX size={14}/> Cancel</> : <><FiEdit3 size={14}/> Edit Profile</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Stat chips ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mx-6 mt-4">
          {[
            { icon: FiShield,   label: "Role",         value: roleMeta.label },
            { icon: FiActivity, label: "Status",       value: profile?.isActive ? "Active" : "Inactive" },
            { icon: FiCalendar, label: "Joined",       value: formatDateShort(profile?.createdAt) },
            { icon: FiCalendar, label: "Last Updated", value: formatDateShort(profile?.updatedAt) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 animate-scale-in
                hover:shadow-md hover:border-indigo-100 transition-all duration-200">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className="text-indigo-400" />
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Main Content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mx-6 mt-5 pb-12">

          {/* ── Personal Information Card ── */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FiUser size={15} className="text-indigo-600" />
                </div>
                <h2 className="text-gray-700">Personal Information</h2>
              </div>
              {editing && (
                <button
                  onClick={handleSaveInfo}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700
                    text-white text-sm rounded-lg transition-all active:scale-95 disabled:opacity-60"
                >
                  {saving
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>&nbsp;Saving…</>
                    : <><FiSave size={13}/> Save Changes</>}
                </button>
              )}
            </div>

            {infoError && (
              <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <FiAlertCircle size={15} />
                {infoError}
              </div>
            )}

            <div className="px-6 py-2">
              <FieldRow
                icon={FiUser}
                label="Full Name"
                value={profile?.name}
                editing={editing}
                inputProps={{
                  value: editForm.name,
                  onChange: (e) => setEditForm((f) => ({ ...f, name: e.target.value })),
                  placeholder: "Enter your full name",
                }}
              />
              <FieldRow
                icon={FiMail}
                label="Email Address"
                value={profile?.email}
                editing={editing}
                inputProps={{
                  type: "email",
                  value: editForm.email,
                  onChange: (e) => setEditForm((f) => ({ ...f, email: e.target.value })),
                  placeholder: "Enter your email",
                }}
              />
              <FieldRow
                icon={FiPhone}
                label="Phone Number"
                value={profile?.phone}
                editing={editing}
                inputProps={{
                  type: "tel",
                  value: editForm.phone,
                  onChange: (e) => setEditForm((f) => ({ ...f, phone: e.target.value })),
                  placeholder: "Enter your phone number",
                }}
              />
              <FieldRow
                icon={FiShield}
                label="Role"
                value={roleMeta.label}
                editing={false}
              />
            </div>

            {/* Role badge footer */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                ${roleMeta.bg} ${roleMeta.text} border ${roleMeta.border}`}>
                <span className={`w-2 h-2 rounded-full ${roleMeta.dot}`} />
                {roleMeta.label} Account
                {profile?.role?.toLowerCase() === "admin" && " · Full Access"}
                {profile?.role?.toLowerCase() === "manager" && " · Team Access"}
                {profile?.role?.toLowerCase() === "user" && " · Standard Access"}
              </div>
            </div>
          </div>

          {/* ── Security Card ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-scale-in">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 bg-blue-50/40">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <FiLock size={15} className="text-blue-600" />
              </div>
              <h2 className="text-gray-700">Security</h2>
            </div>

            <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Choose a strong password with at least 6 characters.
              </p>

              {pwError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <FiAlertCircle size={15} />
                  {pwError}
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Enter new password"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all"
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                  </button>
                </div>

                {/* Strength meter */}
                {pwForm.newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300
                            ${i <= strength.score ? strength.color : "bg-gray-200"}`} />
                      ))}
                    </div>
                    <p className={`text-xs
                      ${strength.score <= 1 ? "text-red-500" : strength.score <= 2 ? "text-orange-500" :
                        strength.score <= 3 ? "text-yellow-600" : "text-emerald-600"}`}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                    className={`w-full border rounded-lg px-4 py-2.5 pr-10 text-sm
                      focus:outline-none focus:ring-2 transition-all
                      ${pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword
                        ? "border-red-300 focus:ring-red-300"
                        : pwForm.confirmPassword && pwForm.newPassword === pwForm.confirmPassword
                        ? "border-emerald-300 focus:ring-emerald-300"
                        : "border-gray-200 focus:ring-blue-300 focus:border-transparent"}`}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                  </button>
                  {pwForm.confirmPassword && pwForm.newPassword === pwForm.confirmPassword && (
                    <FiCheck size={15} className="absolute right-9 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pwSaving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700
                  text-white rounded-lg transition-all duration-200
                  active:scale-[.98] disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {pwSaving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating…</>
                ) : (
                  <><FiLock size={14}/> Update Password</>
                )}
              </button>

              {/* Security tips */}
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 space-y-1.5">
                <p className="text-xs text-blue-600 mb-1">Password tips</p>
                {[
                  "Use at least 8 characters",
                  "Mix uppercase and lowercase letters",
                  "Include numbers and symbols (!@#$...)",
                  "Avoid using your name or email",
                ].map((tip) => (
                  <div key={tip} className="flex items-center gap-1.5 text-xs text-blue-500">
                    <FiCheck size={11} className="flex-shrink-0" /> {tip}
                  </div>
                ))}
              </div>
            </form>
          </div>

          {/* ── Account Details Card (full width) ── */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-scale-in">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <FiActivity size={15} className="text-blue-600" />
              </div>
              <h2 className="text-gray-700">Account Details</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
              {[
                { label: "User ID",      value: `#${profile?.loginId}` },
                { label: "Account Status", value: profile?.isActive ? "Active" : "Inactive",
                  extra: profile?.isActive
                    ? "text-emerald-600 font-semibold"
                    : "text-red-500 font-semibold" },
                { label: "Created",      value: formatDate(profile?.createdAt) },
                { label: "Last Modified", value: formatDate(profile?.updatedAt) },
              ].map(({ label, value, extra }) => (
                <div key={label} className="px-6 py-5">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5">{label}</p>
                  <p className={`text-sm font-semibold text-gray-800 ${extra || ""}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </>
  );
}
