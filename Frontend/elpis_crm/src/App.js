import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { AuthProvider } from "./auth/AuthContext";
import client from "./api/client";

//  Code Splitting: Lazy load heavy route components
const Login = lazy(() => import("./pages/Login"));
const Forgot = lazy(() => import("./pages/forgot"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Product = lazy(() => import("./pages/Product"));
const Deals = lazy(() => import("./pages/Deals"));
const OutlookEmail = lazy(() => import("./pages/OutlookEmail"));
const Users = lazy(() => import("./pages/Users"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const ImportData = lazy(() => import("./pages/ImportData"));
const Teams = lazy(() => import("./pages/Teams"));
const Profile = lazy(() => import("./pages/Profile"));
const CalendarPage = lazy(() => import("./pages/CalendarView"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

function App() {
  // Fetch and log backend version on app load
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        // Fetch version from the backend using the configured API client
        const response = await client.get("/search/version");
        console.log(" BACKEND VERSION:", response.data.version, "| Environment:", response.data.environment, "| Timestamp:", response.data.timestamp);
      } catch (error) {
        console.warn(" Could not fetch backend version:", error.message);
      }
    };
    fetchVersion();
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/contact-us" element={<ContactUs />} />

          {/* Dashboard Routes */}
          <Route
            path="/Dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route path="Accounts" element={<Accounts />} />
            <Route path="Contacts" element={<Contacts />} />
            <Route path="Products" element={<Product />} />
            <Route path="Deals" element={<Deals />} />
            <Route path="OutlookEmail" element={<OutlookEmail />} />
            <Route path="users" element={<Users />} />
            <Route path="import" element={<ImportData />} />
            <Route path="Teams" element={<Teams />} />
            <Route path="profile" element={<Profile />} />
            <Route path="Calendar" element={<CalendarPage />} />
          </Route>

          {/* Role specific entry points */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/unauthorized" element={<Unauthorized />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
