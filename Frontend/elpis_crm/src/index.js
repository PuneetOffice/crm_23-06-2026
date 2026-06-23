/**
 * CRITICAL: Polyfills must be loaded FIRST before any other imports
 * This ensures crypto, Buffer, stream are available for all dependencies
 */
import "./polyfills.js";


import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import "./index.css";
import "./globals.css";
import { msalConfig } from "./auth/msalConfig.js";
console.log("BUILD VERSION: 6fc45a7a");

// 🔹 Create MSAL Instance
if (!msalConfig || !msalConfig.auth) {
  // Fail-fast for development; in production avoid leaking config
  console.error("msalConfig is invalid or missing. Check ./auth/msalConfig.js");
  throw new Error("msalConfig is undefined or invalid. Cannot initialize MSAL.");
}
// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);
// Do not expose internals in production builds; keep local export for internal imports/tests
export { msalInstance };

ReactDOM.createRoot(document.getElementById("root")).render(
  <MsalProvider instance={msalInstance}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </MsalProvider>
);

