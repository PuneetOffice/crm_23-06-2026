import React, { useState } from "react";
import apiClient from "../api/client";
import { isRequired, isEmail, isPhone, minLength } from "../utils/validation";


function SignupPanel({ onClose }) {
  // States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("User");
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  // Define Backend API Endpoint
  const apiUrl = `/Login/create`;

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default page reload
    // Frontend validation for empty or invalid fields using shared validators
    let validationErrors = {};
    if (!isRequired(name)) validationErrors.name = "Name is required";
    if (!isRequired(email)) validationErrors.email = "Email is required";
    else if (!isEmail(email)) validationErrors.email = "Enter a valid email address";
    if (!isRequired(phone)) validationErrors.phone = "Phone is required";
    else if (!isPhone(phone)) validationErrors.phone = "Enter a valid phone number";
    if (!isRequired(password)) validationErrors.password = "Password is required";
    else if (!minLength(password, 6)) validationErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) validationErrors.confirmPassword = "Passwords do not match";

    // Update error state and clear success message
    setErrors(validationErrors);
    setSuccessMessage("");

    // If any validation failed, stop submission here
    if (Object.keys(validationErrors).length > 0) return;

    // Send API Request to Backend
    try {
      const response = await apiClient.post(apiUrl, {
        Name: name,
        phone,
        email,
        password,
        role,
      });

      // If successful (status 200 or 201)
      if (response.status === 200 || response.status === 201) {
        setSuccessMessage("Created successfully!"); // Show success message
        setErrors({}); // Clear any existing errors

        // Reset form fields after successful creation
        setName("");
        setPhone("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setRole("User");

        // Close the panel after a 1.5 sec.
        setTimeout(() => onClose(), 1500);
      }
    } catch (error) {
      // Handle and display API errors - normalize to string so we never set an object
      const errMsg = typeof error === "string" ? error : error?.message || "Failed! Please try again.";
      setErrors({ general: errMsg });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Blurred background overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-all duration-300"
      ></div>
      {/* Slide-in panel */}
<div className="fixed top-0 right-0 w-full sm:w-[90%] md:w-[75%] lg:w-[30%] h-full bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Add New User
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="p-4 sm:p-6 space-y-5 flex flex-col"
          >
            {/* Form Fields */}
            <div className="flex-1 space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>

              {/* Role Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none"
                >
                  <option value="User">User</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Error Alert */}
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{errors.general}</p>
                </div>
              )}

              {/* Success Alert */}
              {successMessage && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              )}
            </div>

            {/* Footer - Buttons */}
            <div className="border-t border-gray-200 pt-4 flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Create User
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignupPanel;