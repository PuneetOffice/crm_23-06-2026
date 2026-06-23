import React, { useState, useEffect } from "react";
import apiClient from "../api/client";
import SignupPanel from "./SignupPanel";
import EditUserModal from "../components/modals/EditUserModal";
import PasswordModal from "../components/modals/PasswordModal";
import DeleteConfirmModal from "../components/modals/DeleteConfirmModal";
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiSearch,
  FiCheck,
  FiX,
  FiLock,
} from "react-icons/fi";

function Users() {
  // All Users
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal & Form State
  const [showSignupPanel, setShowSignupPanel] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit Form State
  const [editData, setEditData] = useState({
    loginId: null,
    name: "",
    email: "",
    phone: "",
    role: "User",
    isActive: true,
  });

  // Password Modal State
  const [passwordData, setPasswordData] = useState({
    loginId: null,
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteId, setDeleteId] = useState(null);

  // Error & Success
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch all users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search term
  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await apiClient.get("/Login/all");
      setUsers(response.data);
      setErrors({});
    } catch (error) {
      setErrors({ general: "Failed to load users" });
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenForm = (user = null) => {
    if (user) {
      // Open edit modal with user data
      setEditData({
        loginId: user.loginId,
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "User",
        isActive: user.isActive ?? true,
      });
      setShowEditModal(true);
    } else {
      // Open signup panel for new user
      setShowSignupPanel(true);
    }
    setErrors({});
  };

  const handleCloseForm = () => {
    setShowSignupPanel(false);
    setShowEditModal(false);
    setEditData({
      loginId: null,
      name: "",
      email: "",
      phone: "",
      role: "User",
      isActive: true,
    });
    setErrors({});
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditData({
      ...editData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!editData.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }
    if (!editData.email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!editData.phone.trim()) {
      setErrors({ phone: "Phone is required" });
      return;
    }

    try {
      const payload = {
        name: editData.name,
        email: editData.email,
        phone: editData.phone,
        role: editData.role,
        isActive: editData.isActive,
        password: "", // Send empty password to satisfy validation
      };

      // Ensure loginId is converted to integer
      const loginId = parseInt(editData.loginId, 10);
      
      console.log("Sending payload:", payload);
      console.log("LoginId:", loginId);
      
      await apiClient.put(`/Login/${loginId}`, payload);
      setSuccessMessage("User updated successfully!");
      setErrors({});

      setTimeout(() => {
        fetchUsers();
        handleCloseForm();
        setSuccessMessage("");
      }, 1500);
    } catch (error) {
      console.error("Edit error:", error);
      console.error("Error response data:", error?.response?.data);
      setErrors({ general: error?.response?.data?.message || JSON.stringify(error?.response?.data) || "Failed to update user" });
    }
  };

  const handleActivate = async (userId) => {
    try {
      await apiClient.put(`/Login/${userId}/activate`);
      setSuccessMessage("User activated successfully!");
      setTimeout(() => {
        fetchUsers();
        setSuccessMessage("");
      }, 1500);
    } catch (error) {
      setErrors({ general: "Failed to activate user" });
    }
  };

  const handleDeactivate = async (userId) => {
    try {
      await apiClient.put(`/Login/${userId}/deactivate`);
      setSuccessMessage("User deactivated successfully!");
      setTimeout(() => {
        fetchUsers();
        setSuccessMessage("");
      }, 1500);
    } catch (error) {
      setErrors({ general: "Failed to deactivate user" });
    }
  };

  const handleDelete = async (userId) => {
    try {
      await apiClient.delete(`/Login/${userId}`);
      setSuccessMessage("User deleted successfully!");
      setTimeout(() => {
        fetchUsers();
        setShowDeleteConfirm(false);
        setDeleteId(null);
        setSuccessMessage("");
      }, 1500);
    } catch (error) {
      setErrors({ general: "Failed to delete user" });
    }
  };

  const handleOpenPasswordModal = (userId) => {
    setPasswordData({
      loginId: userId,
      newPassword: "",
      confirmPassword: "",
    });
    setErrors({});
    setShowPasswordModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!passwordData.newPassword.trim()) {
      setErrors({ password: "New password is required" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setErrors({ password: "Password must be at least 6 characters" });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrors({ password: "Passwords do not match" });
      return;
    }

    try {
      // Use the change-password endpoint which gets email from JWT token
      await apiClient.put(`/Login/change-password`, {
        NewPassword: passwordData.newPassword,
      });

      setSuccessMessage("Password changed successfully!");
      setErrors({});
      setTimeout(() => {
        fetchUsers();
        setShowPasswordModal(false);
        setPasswordData({ loginId: null, newPassword: "", confirmPassword: "" });
        setSuccessMessage("");
      }, 1500);
    } catch (error) {
      setErrors({ general: error?.response?.data?.message || "Failed to change password" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <FiPlus size={18} />
          Add User
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-3">
          <FiCheck size={20} />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errors.general && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <FiX size={20} />
          <span className="text-sm font-medium">{errors.general}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 relative">
        <FiSearch className="absolute left-3 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0 flex-1">
        {loadingUsers ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Email
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Phone
                  </th>
                  <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.loginId}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-600">
                      {user.phone}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-sm">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm">
                      {user.isActive ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenForm(user)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>

                        <button
                          onClick={() => handleOpenPasswordModal(user.loginId)}
                          className="p-2 text-orange-600 hover:bg-orange-100 rounded transition"
                          title="Change Password"
                        >
                          <FiLock size={16} />
                        </button>

                        {user.isActive ? (
                          <button
                            onClick={() => handleDeactivate(user.loginId)}
                            className="p-2 text-yellow-600 hover:bg-yellow-100 rounded transition"
                            title="Deactivate"
                          >
                            <FiX size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user.loginId)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded transition"
                            title="Activate"
                          >
                            <FiCheck size={16} />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setDeleteId(user.loginId);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded transition"
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Signup Panel for Adding Users */}
      {showSignupPanel && (
        <SignupPanel onClose={() => {
          setShowSignupPanel(false);
          fetchUsers();
        }} />
      )}

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal}
        editData={editData}
        errors={errors}
        successMessage={successMessage}
        onClose={handleCloseForm}
        onChange={handleEditChange}
        onSubmit={handleEditSubmit}
      />

      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        passwordData={passwordData}
        errors={errors}
        successMessage={successMessage}
        onClose={() => setShowPasswordModal(false)}
        onChange={(e) => {
          const { name, value } = e.target;
          setPasswordData({ ...passwordData, [name]: value });
        }}
        onSubmit={handleChangePassword}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={() => handleDelete(deleteId)}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

export default Users;
