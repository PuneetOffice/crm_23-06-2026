import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import AuthContext from "./auth/AuthContext";

// ProtectedRoute now supports role checks via allowedRoles prop.
// Usage: <ProtectedRoute allowedRoles={["admin","manager"]}><Component/></ProtectedRoute>
const ProtectedRoute = ({ children, allowedRoles }) => {
  const auth = useContext(AuthContext);

  if (!auth || !auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = auth.getRole();
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
