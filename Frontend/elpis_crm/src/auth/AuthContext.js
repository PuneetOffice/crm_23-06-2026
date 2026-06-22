import React, { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import tokenUtils from "./tokenUtils";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => tokenUtils.getToken());
  const [role, setRole] = useState(() => {
    const t = tokenUtils.getToken();
    const d = t ? tokenUtils.decodeToken(t) : null;
    return d?.role || d?.Role || null;
  });
  const [userName] = useState(() => {
    try {
      return localStorage.getItem("userName") || "";
    } catch {
      return "";
    }
  });

  const isAuthenticated = !!token && !tokenUtils.isTokenExpired(token);

  useEffect(() => {
    // keep role in sync when token changes
    if (token) {
      const decoded = tokenUtils.decodeToken(token);
      const r = decoded?.role || decoded?.Role || null;
      setRole(r);
      tokenUtils.setToken(token);
    } else {
      setRole(null);
      tokenUtils.removeToken();
    }
  }, [token]);

  const login = (newToken) => {
    if (!newToken) return;
    tokenUtils.setToken(newToken);
    setToken(newToken);
  };

  const logout = () => {
    tokenUtils.removeToken();
    setToken(null);
    setRole(null);
    try {
      sessionStorage.removeItem("userEmail");
      sessionStorage.removeItem("userName");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userName");
    } catch {}
    navigate("/");
  };

  const getToken = () => tokenUtils.getToken();
  const getRole = () => role;
  const getUserName = () => userName;

  return (
    <AuthContext.Provider
      value={{ token, role, isAuthenticated, login, logout, getToken, getRole, userName, getUserName }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
