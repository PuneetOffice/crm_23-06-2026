import jwt_decode from "jwt-decode";

const TOKEN_KEY = "authToken";

export function setToken(token) {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token) {
  try {
    return jwt_decode(token);
  } catch (e) {
    return null;
  }
}

export function isTokenExpired(token) {
  if (!token) return true;
  const decoded = decodeToken(token);
  if (!decoded) return true;
  if (!decoded.exp) return false; // some tokens may not have exp
  const now = Date.now() / 1000;
  return decoded.exp < now;
}

const tokenUtils = {
  setToken,
  getToken,
  removeToken,
  decodeToken,
  isTokenExpired,
};

export default tokenUtils;
