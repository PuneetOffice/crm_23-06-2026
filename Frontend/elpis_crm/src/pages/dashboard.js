// Dashboard component
import React, { useEffect, useState, useContext } from "react";
import { useLocation, Outlet, useNavigate } from "react-router-dom";
// Import icons for upload button
import { ArrowDownToLine, X, FileSpreadsheet, CheckCircle2, Upload, Filter, Mail, Plus } from "lucide-react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthContext from "../auth/AuthContext";
import { useTaskReminders } from "../hooks/useTaskReminders";
// axios replaced by centralized apiClient
import Contacts from "./Contacts";
import Accounts from "./Accounts";
import Product from "./Product";
import Home from "./Home";

import Sidebar from "./Sidebar";
import Header from "./header";
import Email from "./Email";
import Deals from "./Deals";
import OutlookEmail from "./OutlookEmail";
import Teams from "./Teams";
import CalendarView from "./CalendarView";
import Users from "./Users";

import AddForms from "./add";
import FilterPanel from "./FilterPanel";
import DealsFilterDrawer from "./DealsFilterDrawer";
import CallLogs from "./CallLogs";
import { getActiveFilterCount } from "../utils/filterUtils";

// Get backend host from environment variables, use port 7229
import apiClient from "../api/client";
import tokenUtils from "../auth/tokenUtils";

async function fetchApi(url, options) {
  try {
    if (/^https?:\/\//i.test(url)) return window.fetch(url, options);
    const path = url.startsWith("/") ? url : `/${url}`;
    const method = (options && options.method) || "GET";

    //  Use native fetch for FormData to avoid axios serialization issues
    if (options?.body instanceof FormData) {
      const fullUrl = new URL(path, window.location.origin).href;
      const token = tokenUtils.getToken();
      const fetchOptions = {
        method: method,
        body: options.body,
        headers: {
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      };
      const res = await window.fetch(fullUrl, fetchOptions);
      const isJson = res.headers.get("content-type")?.includes("application/json");
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: async () => isJson ? await res.json() : {},
        text: async () => await res.text()
      };
    }

    if (method === "GET") {
      const res = await apiClient.get(path, { params: options && options.params });
      return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) };
    }

    // Use method-specific axios functions for JSON requests
    let res;
    const config = { headers: options && options.headers };
    const data = options && options.body;

    if (method.toUpperCase() === "POST") {
      res = await apiClient.post(path, data, config);
    } else if (method.toUpperCase() === "PUT") {
      res = await apiClient.put(path, data, config);
    } else if (method.toUpperCase() === "DELETE") {
      res = await apiClient.delete(path, config);
    } else if (method.toUpperCase() === "PATCH") {
      res = await apiClient.patch(path, data, config);
    } else {
      res = await apiClient.request({ url: path, method: method.toUpperCase(), data, ...config });
    }

    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) };
  } catch (err) {
    return Promise.reject(err);
  }
}

const fetch = fetchApi;

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  // Initialize reminder checking
  useTaskReminders();

  // Get user role from AuthContext
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const canAddEdit = userRole === "Admin" || userRole === "admin" || userRole === "Manager" || userRole === "manager" || userRole === "User" || userRole === "user";

  // Search state for accounts
  const [search, setSearch] = useState("");
  // State for which active section.
  const [activeContent, setActiveContent] = useState("home");
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [openTabs, setOpenTabs] = useState(["home"]);
  // Search highlight: { type, id } — tells child pages to auto-open this record
  const [searchHighlight, setSearchHighlight] = useState(null);
  // State for showing the add panel
  const [showPanel, setShowPanel] = useState(false);
  // State for showing the import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  // State to trigger refresh of deals

  // Filter state for each section
  const [showFilterPanel, setShowFilterPanel] = useState(null); // "contacts", "accounts", "products", "deals"

  // Contacts filter state
  const [contactFilters, setContactFilters] = useState([]);
  const [selectedContactColumns, setSelectedContactColumns] = useState([]);

  // Accounts filter state
  const [accountFilters, setAccountFilters] = useState([]);
  const [selectedAccountColumns, setSelectedAccountColumns] = useState([]);

  // Products filter state
  const [productFilters, setProductFilters] = useState([]);
  const [selectedProductColumns, setSelectedProductColumns] = useState([]);

  // Deals filter state (for future use)
  const [dealFilters, setDealFilters] = useState([]);
  const [selectedDealColumns, setSelectedDealColumns] = useState([]);
  const [dealDateRange, setDealDateRange] = useState({ createdFrom: "", createdTo: "", updatedFrom: "", updatedTo: "" });
  const [dealCreatedByOptions, setDealCreatedByOptions] = useState([]);

  // Log dealFilters changes
  useEffect(() => {
    console.log("[Dashboard] dealFilters updated:", dealFilters);
  }, [dealFilters]);

  useEffect(() => {
    const loadDealCreatedByOptions = async () => {
      if (showFilterPanel !== "deals") {
        setDealCreatedByOptions([]);
        return;
      }
      try {
        const res = await fetch(`/Deal`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const options = Array.isArray(json)
          ? [...new Set(json.map((deal) => (deal?.CreatedBy || deal?.createdBy || "")).filter(Boolean))]
          : [];
        setDealCreatedByOptions(options.sort((a, b) => String(a).localeCompare(String(b))));
      } catch (err) {
        console.error("[Dashboard] Failed to load deal Created By options:", err);
        setDealCreatedByOptions([]);
      }
    };
    loadDealCreatedByOptions();
  }, [showFilterPanel]);

  // Columns for Deals table
  const dealColumns = React.useMemo(() => [
    { key: "dealId", label: "Deal ID" },
    { key: "name", label: "Deal Name" },
    { key: "type", label: "Deal Type" },
    { key: "dealPipeline", label: "Deal Pipeline" },
    { key: "dealStage", label: "Deal Stage" },
    { key: "dealValue", label: "Deal Value" },
    { key: "currency", label: "Currency" },
    { key: "source", label: "Source" },
    { key: "territory", label: "Territory" },
    { key: "ageInDays", label: "Age (Days)" },
    { key: "salesOwner", label: "Sales Owner" },
    { key: "tags", label: "Tags" },
    { key: "recentNote", label: "Recent Note" },
    { key: "probability", label: "Probability" },
    { key: "expectedCloseDate", label: "Expected Close Date" },
    { key: "closedDate", label: "Closed Date" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "wonReasons", label: "Won Reasons" },
    { key: "createdAt", label: "Created At" },
    { key: "updatedAt", label: "Updated At" },
    { key: "createdBy", label: "Created By" },
  ], []);

  // Columns for Contacts table (updated to match SQL schema)
  const contactColumns = React.useMemo(() => [
    { key: "FirstName", label: "First Name" },
    { key: "LastName", label: "Last Name" },
    { key: "Account", label: "Account" },
    { key: "JobTitle", label: "Job Title" },
    { key: "Account", label: "Account" },
    {key: "EnquiryNo", label: "Enquiry Number"},
    { key: "WorkEmail", label: "Work Email" },
    { key: "WorkPhone", label: "Work Phone" },
    { key: "Mobile", label: "Mobile" },
    { key: "LinkedIn", label: "LinkedIn" },
    { key: "Facebook", label: "Facebook" },
    { key: "Twitter", label: "Twitter" },
    { key: "Address", label: "Address" },
    { key: "Country", label: "Country" },
    { key: "State", label: "State" },
    { key: "City", label: "City" },
    { key: "Zipcode", label: "Zipcode" },
    { key: "TimeZone", label: "Time Zone" },
    { key: "Locale", label: "Locale" },
    { key: "SalesOwner", label: "Sales Owner" },
    { key: "Status", label: "Status" },
    { key: "LifeCycleStage", label: "Life Cycle Stage" },
    { key: "Territory", label: "Territory" },
    { key: "Tags", label: "Tags" },
    { key: "Source", label: "Source" },
    { key: "Campaign", label: "Campaign" },
    { key: "CustomerFit", label: "Customer Fit" },
    { key: "Score", label: "Score" },
    { key: "SubscriptionStatus", label: "Subscription Status" },
    { key: "UnsubscribeReason", label: "Unsubscribe Reason" },
    { key: "WhatsAppSubscriptionStatus", label: "WhatsApp Subscription Status" },
    { key: "SMSSubscriptionStatus", label: "SMS Subscription Status" },
    { key: "LostReason", label: "Lost Reason" },
    { key: "Medium", label: "Medium" },
    { key: "Keyword", label: "Keyword" },
    { key: "OriginalCampaign", label: "Original Campaign" },
    { key: "OriginalMedium", label: "Original Medium" },
    { key: "OriginalSource", label: "Original Source" },
    { key: "CreatedThroughCampaign", label: "Created Through Campaign" },
    { key: "CreatedFromMedium", label: "Created From Medium" },
    { key: "CreatedFromSource", label: "Created From Source" },
    { key: "MostRecentCampaign", label: "Most Recent Campaign" },
    { key: "MostRecentMedium", label: "Most Recent Medium" },
    { key: "MostRecentSource", label: "Most Recent Source" },
    { key: "LastActivityType", label: "Last Activity Type" },
    { key: "LastActivityDate", label: "Last Activity Date" },
    { key: "LastContactedTime", label: "Last Contacted Time" },
    { key: "LastContactedMode", label: "Last Contacted Mode" },
    { key: "LastSeenOnChat", label: "Last Seen On Chat" },
    { key: "LastSeenOnWeb", label: "Last Seen On Web" },
    { key: "RecentNote", label: "Recent Note" },
    { key: "LastAssignedAt", label: "Last Assigned At" },
    { key: "TotalChatSessions", label: "Total Chat Sessions" },
    { key: "FirstSeenOnChat", label: "First Seen On Chat" },
    { key: "ActiveSalesSequences", label: "Active Sales Sequences" },
    { key: "CompletedSalesSequences", label: "Completed Sales Sequences" },
    { key: "CreatedAt", label: "Created At" },
    { key: "UpdatedAt", label: "Updated At" },
    { key: "CreatedBy", label: "Created By" },
    { key: "UpdatedBy", label: "Updated By" },
    { key: "WebForms", label: "Web Forms" },
  ], []);

  // Columns for Accounts table (updated to match SQL schema)
  const accountColumns = React.useMemo(() => [
    { key: "Name", label: "Name" },
    { key: "RelatedContacts", label: "Related Contacts" },
    { key: "IndustryType", label: "Industry Type" },
    { key: "BusinessType", label: "Business Type" },
    { key: "Country", label: "Country" },
    { key: "State", label: "State" },
    { key: "City", label: "City" },
    { key: "Zipcode", label: "Zipcode" },
    { key: "Address", label: "Address" },
    { key: "Website", label: "Website" },
    { key: "Phone", label: "Phone" },
    { key: "DisplayPhone", label: "Display Phone" },
    { key: "Territory", label: "Territory" },
    { key: "NumberOfEmployees", label: "Number of Employees" },
    { key: "AnnualRevenue", label: "Annual Revenue" },
    { key: "SalesOwner", label: "Sales Owner" },
    { key: "ParentAccount", label: "Parent Account" },
    { key: "Facebook", label: "Facebook" },
    { key: "Twitter", label: "Twitter" },
    { key: "LinkedIn", label: "LinkedIn" },
    { key: "LastContactedMode", label: "Last Contacted Mode" },
    { key: "LastContactedTime", label: "Last Contacted Time" },
    { key: "LastActivityType", label: "Last Activity Type" },
    { key: "LastActivityDate", label: "Last Activity Date" },
    { key: "RecentNote", label: "Recent Note" },
    { key: "LastAssignedAt", label: "Last Assigned At" },
    { key: "ActiveSalesSequences", label: "Active Sales Sequences" },
    { key: "CompletedSalesSequences", label: "Completed Sales Sequences" },
    { key: "Tags", label: "Tags" },
    { key: "ImportID", label: "Import ID" },
    { key: "CreatedAt", label: "Created At" },
    { key: "UpdatedAt", label: "Updated At" },
    { key: "CreatedBy", label: "Created By" },
    { key: "UpdatedBy", label: "Updated By" },
  ], []);

  // Columns for Deals table removed (unused)

  // Columns for Products table
  const productColumns = React.useMemo(() => [
    { key: "active", label: "Active" },
    { key: "baseCurrencyAmount", label: "Base Currency Amount" },
    { key: "category", label: "Category" },
    { key: "createdAt", label: "Created At" },
    { key: "createdBy", label: "Created By" },
  ], []);

  // Initialize selected columns with all columns on mount
  useEffect(() => {
    if (selectedContactColumns.length === 0) {
      setSelectedContactColumns(contactColumns.map((c) => c.key));
    }
    if (selectedAccountColumns.length === 0) {
      setSelectedAccountColumns(accountColumns.map((c) => c.key));
    }
    if (selectedProductColumns.length === 0) {
      setSelectedProductColumns(["name", ...productColumns.map((c) => c.key)]);
    }
    if (selectedDealColumns.length === 0) {
      setSelectedDealColumns(dealColumns.map((c) => c.key));
    }
  }, [contactColumns, accountColumns, productColumns, dealColumns, selectedContactColumns.length, selectedAccountColumns.length, selectedProductColumns.length, selectedDealColumns.length]);

  // Sync tab state with URL
  useEffect(() => {
    // Map URL path to tab
    const path = location.pathname.toLowerCase();
    let tab = "home";
    if (path.includes("/dashboard/accounts")) tab = "accounts";
    else if (path.includes("/dashboard/contacts")) tab = "contacts";
    else if (path.includes("/dashboard/teams")) tab = "teams";
    else if (path.includes("/dashboard/products")) tab = "products";
    else if (path.includes("/dashboard/deals")) tab = "deals";
    else if (path.includes("/dashboard/outlookemail")) tab = "outlookEmail";
    else if (path.includes("/dashboard/users")) tab = "users";
    else if (path.includes("/dashboard/calllogs")) tab = "calllogs";
    else if (path.includes("/dashboard/profile")) return; // profile renders via Outlet, don't touch activeContent
    else if (path.includes("/dashboard/calendar")) return; // calendar renders via Outlet
    else if (path.includes("/dashboard")) tab = "home";


    setActiveContent(tab);
    setOpenTabs([tab]);
    // ✅ ALWAYS CLOSE the add panel when navigating between tabs
    setShowPanel(false);
  }, [location.pathname]);

  // Listen for showContact event from Accounts page
  useEffect(() => {
    const handleShowContact = (event) => {
      const { contactId } = event.detail || {};
      if (contactId === undefined || contactId === null || contactId === "") return;
      console.log("Handling showContact event for contactId:", contactId);
      setSearchHighlight({ type: "contact", id: contactId });
      setActiveContent("contacts");
      setOpenTabs(["contacts"]);
      navigate("/dashboard/contacts", { replace: true });
    };

    window.addEventListener("showContact", handleShowContact);
    return () => window.removeEventListener("showContact", handleShowContact);
  }, [navigate]);

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("All"); // filter by category
  const [categories, setCategories] = useState([]); // all available categories

  // Tab display names
  const tabTitles = {
    home: "Home",
    accounts: "Accounts",
    contacts: "Contacts",
    teams: "Teams",
    products: "Products",
    deals: "Deals",
    outlookEmail: " Email",
    users: "Users",
    calllogs: "Call Logs",
    calendar: "Calendar",
  };
  // Highlight search matches in text
  function highlightMatch(text, search) {
    if (!search) return text;
    const regex = new RegExp(
      `(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return String(text)
      .split(regex)
      .map((part, i) =>
        regex.test(part) ? (
          <span key={i} style={{ backgroundColor: "yellow" }}>
            {part}
          </span>
        ) : (
          part
        )
      );
  }

  // Switch tab and update URL
  const openOrActivateTab = (tabId) => {
    setOpenTabs([tabId]);
    setActiveContent(tabId);
    // Update URL for browser navigation
    let url = "/dashboard";
    if (tabId === "accounts") url = "/dashboard/Accounts";
    else if (tabId === "contacts") url = "/dashboard/contacts";
    else if (tabId === "teams") url = "/dashboard/Teams";
    else if (tabId === "products") url = "/dashboard/Products";
    else if (tabId === "deals") url = "/dashboard/Deals";
    else if (tabId === "outlookEmail") url = "/dashboard/OutlookEmail";
    else if (tabId === "users") url = "/dashboard/users";
    else if (tabId === "calllogs") url = "/dashboard/calllogs";
    else if (tabId === "calendar") url = "/dashboard/Calendar";
    window.history.pushState({}, "", url);
  };

  // Show a toast notification
  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };
  // expose toast helper globally so other components (header panel) can show toasts
  try { window.addToast = addToast; } catch (_) { }

  // Import logic for all sections
  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/csv'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv)$/i)) {
        addToast('Invalid file type', 'error');
        return;
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        addToast('File too large (max 50MB)', 'error');
        return;
      }

      // Validate file size (min 1KB)
      if (file.size < 1024) {
        addToast('File is too small or empty', 'error');
        return;
      }

      setImportFile(file);
      addToast(`Selected: ${file.name}`);
    }
  };

  const closeImportModal = () => {
    if (importLoading) return;
    setShowImportModal(false);
    setImportFile(null);
  };

  // Get endpoint and label based on activeContent
  const getImportConfig = () => {
    const tableMap = {
      accounts: "accounts",
      contacts: "contacts",
      deals: "deals",
      products: "products",
      calllogs: "calllogs"
    };

    const tableName = tableMap[activeContent];
    if (!tableName) return { endpoint: "", label: "" };

    const labelMap = {
      accounts: "Accounts",
      contacts: "Contacts",
      deals: "Deals",
      products: "Products",
      calllogs: "Call Logs"
    };

    return { endpoint: `/import/${tableName}`, label: labelMap[activeContent] };
  };

  const handleImportUpload = async (e) => {
    e.preventDefault();
    if (!importFile) {
      addToast("Please select a file to upload", "error");
      return;
    }
    setImportLoading(true);
    const formData = new FormData();
    formData.append("file", importFile);
    const { endpoint, label } = getImportConfig();
    try {
      const res = await apiClient.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res?.data?.success) {
        addToast(res.data.message || `${label} imported successfully`);
        closeImportModal();
        // refetch data for the current active tab so UI shows updated details
        try {
          if (activeContent === "accounts") {
            window.dispatchEvent(new CustomEvent('importComplete', { detail: { table: 'Accounts' } }));
          } else if (activeContent === "contacts") {
            window.dispatchEvent(new CustomEvent('importComplete', { detail: { table: 'Contacts' } }));
          } else if (activeContent === "deals") {
            try { if (typeof window.refetchDeals === "function") window.refetchDeals(); } catch (_) { }
          } else if (activeContent === "products") {
            const r = await apiClient.get(`/Products`);
            setProducts(Array.isArray(r.data) ? r.data : []);
          } else if (activeContent === "calllogs") {
            try { if (typeof window.refetchCallLogs === "function") window.refetchCallLogs(); } catch (_) { }
          }
        } catch (e) {
          console.warn("Refetch after import failed:", e);
        }
      } else {
        // Check for specific error types
        if (res?.data?.message) {
          if (res.data.message.toLowerCase().includes('invalid')) {
            addToast("Invalid data format. Please check the file and try again.", "error");
          } else if (res.data.message.toLowerCase().includes('validation')) {
            addToast("Data validation failed. Please check the file contents.", "error");
          } else {
            addToast(res.data.message, "error");
          }
        } else {
          addToast("Upload failed", "error");
        }
      }
    } catch (error) {
      // Handle errors from apiClient
      let errorMsg = "Upload failed. Please try again.";
      if (error?.message?.includes('timeout')) {
        errorMsg = "Upload timed out. File may be too large or data processing took too long.";
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      addToast(errorMsg, "error");
    } finally {
      setImportLoading(false);
    }
  };

  // Remove a toast by id
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Accounts data — not fetched here, Accounts component uses server-side pagination
  const [accounts, setAccounts] = useState([]);

  // Contacts data — not fetched here, Contacts component uses server-side pagination
  const [contacts, setContacts] = useState([]);

  // Deals are fetched and filtered inside `Deals` component now

  const [product, setProducts] = useState([]);

  // Tags available for current filter panel (contacts/accounts/deals/products)
  const [tagOptions, setTagOptions] = useState([]);



  // Load Products from API
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get(`/Products`);
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        addToast("Failed to load Products", "error");
      }
    };
    load();
    // expose refetch for products
    try { window.refetchProducts = load; } catch (_) { }
  }, []);

  // Accounts/contacts are no longer bulk-loaded for the dashboard shell (search-driven pickers in AddForms).
  useEffect(() => {
    setAccounts([]);
    setContacts([]);
    const noop = async () => { };
    try {
      window.refetchAccounts = noop;
      window.refetchContacts = noop;
    } catch (_) { }
  }, []);

  // Fetch all Product categories for dropdown filter
  const fetchAllCategories = async () => {
    try {
      const res = await fetch(`/Products`);
      const json = await res.json();
      // Extract unique category names from response
      const uniqueCats = [
        ...new Set(
          (Array.isArray(json) ? json : [])
            .map((p) => p.category)
            .filter(Boolean)
        ),
      ];
      setCategories(uniqueCats);
    } catch (_) { }
  };

  useEffect(() => {
    fetchAllCategories();
  }, []);

  // Fetch tag options for the currently opened filter panel (if any)
  useEffect(() => {
    const loadTagsFor = async (panel) => {
      if (!panel) return;
      const endpointMap = {
        contacts: `/Contact/tags/all`,
        accounts: `/Account/tags/all`,
        deals: `/Deal/tags/all`,
        products: `/Products/tags/all`,
      };
      const url = endpointMap[panel];
      if (!url) return setTagOptions([]);
      // For deals, rely on the Deals component to provide tags (onTagsAvailable)
      if (panel === 'deals') {
        console.log("[Dashboard] Deals filter panel opened - clearing tagOptions");
        return setTagOptions([]);
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const tags = Array.isArray(json) ? json : [];
        console.debug("[Dashboard] loadTagsFor:", panel, { count: tags.length, sample: tags.slice(0, 5) });
        setTagOptions(tags);
      } catch (err) {
        console.error("[Dashboard] Failed to load tags for", panel, err);
        setTagOptions([]);
      }
    };
    loadTagsFor(showFilterPanel);
  }, [showFilterPanel]);

  return (
    <div className="flex flex-col h-full bg-gray-50 font-[poppins,sans-serif] overflow-hidden">
      {/* Toast notification container */}
      <ToastContainer
        position="top-right"
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      {/* Header - FIXED at top */}
      <Header search={search} setSearch={setSearch} setActiveContent={(tab) => { openOrActivateTab(tab); }} onSearchSelect={(item) => {
        openOrActivateTab(item.type === "contact" ? "contacts" : item.type === "account" ? "accounts" : item.type === "deal" ? "deals" : "products");
        setSearchHighlight(item);
      }} />

      {/* Main Layout - flex row, takes remaining height */}
      <div className="flex flex-1 min-w-0 pt-14 overflow-hidden">
        {/* Sidebar - responsive */}
        <Sidebar
          activeContent={activeContent}
          openOrActivateTab={openOrActivateTab}
          setShowPanel={setShowPanel}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Tabs and Controls Header */}
          {!openTabs.includes("outlookEmail") &&
            !openTabs.includes("teams") &&
            !openTabs.includes("calendar") &&
            !openTabs.includes("home") && (
              <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 lg:px-6">
                  {/* Tab Navigation */}
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {openTabs.map((tabId) => (
                      <button
                        key={tabId}
                        onClick={() => openOrActivateTab(tabId)}
                        className={`
                        px-8 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 border
                        ${activeContent === tabId
                            ? "bg-black/65 text-emerald-100 border-black/10 shadow-md"
                            : "bg-transparent text-gray-700 border-gray-700 hover:bg-gray-50"
                          }
                      `}
                      >
                        {tabTitles[tabId] || tabId}
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter - Products */}
                    {activeContent === "products" && (
                      <select
                        id="category-filter"
                        className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Contacts Action Buttons */}
                    {activeContent === "contacts" && (
                      <>
                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-teal-600 border border-teal-600 text-sm font-small hover:bg-teal-50 transition-colors"
                          onClick={() => setShowEmailPanel(true)}
                        >
                          <Mail className="w-4 h-4" />
                          <span className="hidden sm:inline">Send Mail</span>
                        </button>
                        {canAddEdit && (
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-teal-600 border border-teal-600 text-sm font-small hover:bg-teal-50 transition-colors"
                            onClick={() => setShowPanel(true)}
                          >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Contact</span>
                          </button>
                        )}
                        <button
                          className="hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-green-600 border border-green-600 text-sm font-small hover:bg-green-50 transition-colors"
                          onClick={() => setShowImportModal(true)}
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          <span className="hidden sm:inline">Import</span>
                        </button>
                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-blue-600 border border-blue-600 text-sm font-small hover:bg-blue-50 transition-colors"
                          onClick={() => setShowFilterPanel(showFilterPanel === "contacts" ? null : "contacts")}
                        >
                          <Filter className="w-4 h-4" />
                          Filters
                          {getActiveFilterCount(contactFilters) > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-600 bg-white rounded-full">
                              {getActiveFilterCount(contactFilters)}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {/* Accounts Action Buttons */}
                    {activeContent === "accounts" && (
                      <>
                        {canAddEdit && (
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-teal-600 border border-teal-600 text-sm font-small hover:bg-teal-50 transition-colors"
                            onClick={() => setShowPanel(true)}
                          >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Account</span>
                          </button>
                        )}
                        <button
                          className="hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-green-600 border border-green-600 text-sm font-small hover:bg-green-50 transition-colors"
                          onClick={() => setShowImportModal(true)}
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          <span className="hidden sm:inline">Import</span>
                        </button>
                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-blue-600 border border-blue-600 text-sm font-small hover:bg-blue-50 transition-colors"
                          onClick={() => setShowFilterPanel(showFilterPanel === "accounts" ? null : "accounts")}
                        >
                          <Filter className="w-4 h-4" />
                          Filters
                          {getActiveFilterCount(accountFilters) > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-600 bg-white rounded-full">
                              {getActiveFilterCount(accountFilters)}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {/* Products Action Buttons */}
                    {activeContent === "products" && (
                      <>
                        {canAddEdit && (
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-teal-600 border border-teal-600 text-sm font-small hover:bg-teal-50 transition-colors"
                            onClick={() => setShowPanel(true)}
                          >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Product</span>
                          </button>
                        )}
                        <button
                          className="hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-green-600 border border-green-600 text-sm font-small hover:bg-green-50 transition-colors"
                          onClick={() => setShowImportModal(true)}
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          <span className="hidden sm:inline">Import</span>
                        </button>
                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-blue-600 border border-blue-600 text-sm font-small hover:bg-blue-50 transition-colors"
                          onClick={() => setShowFilterPanel(showFilterPanel === "products" ? null : "products")}
                        >
                          <Filter className="w-4 h-4" />
                          Filters
                          {getActiveFilterCount(productFilters) > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-600 bg-white rounded-full">
                              {getActiveFilterCount(productFilters)}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {/* Deals Action Buttons */}
                    {activeContent === "deals" && (
                      <>
                        <button
                          className="hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-green-600 border border-green-600 text-sm font-small hover:bg-green-50 transition-colors"
                          onClick={() => setShowImportModal(true)}
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          <span className="hidden sm:inline">Import</span>
                        </button>

                        {/* Date range moved into the Filters panel (Created At / Updated At) */}

                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-teal-600 border border-teal-600 text-sm font-small hover:bg-teal-50 transition-colors"
                          onClick={() => setShowPanel(true)}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Add Deal</span>
                        </button>

                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-blue-600 border border-blue-600 text-sm font-small hover:bg-blue-50 transition-colors"
                          onClick={() => setShowFilterPanel(showFilterPanel === "deals" ? null : "deals")}
                        >
                          <Filter className="w-4 h-4" />
                          Filters
                          {getActiveFilterCount(dealFilters) > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-600 bg-white rounded-full">
                              {getActiveFilterCount(dealFilters)}
                            </span>
                          )}
                        </button>
                      </>
                    )}
                    {/* Call Logs Action Buttons */}
                    {activeContent === "calllogs" && (
                      <>
                        <button
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent text-green-600 border border-green-600 text-sm font-small hover:bg-green-50 transition-colors"
                          onClick={() => setShowImportModal(true)}
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          <span className="hidden sm:inline">Import</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Content Area */}


          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* Render nested routes (like Import) via Outlet */}

            {location.pathname.includes("/Import") || location.pathname.includes("/Contacts") || location.pathname.includes("/Teams") || location.pathname.includes("/OutlookEmail") || location.pathname.includes("/users") || location.pathname.toLowerCase().includes("/profile") || location.pathname.toLowerCase().includes("/calendar") ? (

              <Outlet />

            ) : location.pathname.includes("/Accounts") ? (

              // For /Dashboard/Accounts route, render Accounts with Dashboard state
              <Accounts
                accounts={accounts}
                onToast={addToast}
                onRefetch={() => { }}
                onRefetchReady={null}
                selectedColumns={selectedAccountColumns}
                filters={accountFilters}
                highlightMatch={highlightMatch}
                search={search}
                externalSearch={search}
                searchHighlight={searchHighlight}
                onSearchHighlightDone={() => setSearchHighlight(null)}
              />

            ) : location.pathname.includes("/Deals") ? (

              // For /Dashboard/Deals route, render Deals with Dashboard state
              <Deals
                onToast={addToast}
                onRefetchReady={(fn) => (window.refetchDeals = fn)}
                onTagsAvailable={(tags) => setTagOptions(tags)}
                highlightMatch={highlightMatch}
                search={search}
                filters={dealFilters}
                onFiltersChange={setDealFilters}
                selectedColumns={selectedDealColumns}
                onSelectedColumnsChange={setSelectedDealColumns}
                searchHighlight={searchHighlight}
                onSearchHighlightDone={() => setSearchHighlight(null)}
              />

            ) : location.pathname.includes("/Products") ? (

              // For /Dashboard/Products route, render Product with Dashboard state
              <Product
                products={
                  search.trim()
                    ? product.filter((p) =>
                      Object.values(p)
                        .join(" ")
                        .toLowerCase()
                        .includes(search.trim().toLowerCase())
                    )
                    : product
                }
                onToast={addToast}
                onRefetch={() => window.refetchProducts && window.refetchProducts()}
                categoryFilter={categoryFilter}
                selectedColumns={selectedProductColumns}
                filters={productFilters}
                highlightMatch={highlightMatch}
                search={search}
              />

            ) : (

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Home Dashboard */}

                {activeContent === "home" && openTabs.includes("home") && (
                  <div className="flex-1 overflow-y-auto overflow-x-hidden relative visible-scrollbar">
                    <Home search={search} highlightMatch={highlightMatch} />
                  </div>
                )}

                {/* Contacts Table */}

                {activeContent === "contacts" && openTabs.includes("contacts") && (
                  <Contacts
                    contacts={contacts}
                    onToast={addToast}
                    onRefetch={() => window.refetchContacts && window.refetchContacts()}
                    onRefetchReady={(fn) => {
                      try { window.refetchContacts = fn; } catch (_) { }
                    }}
                    selectedColumns={selectedContactColumns}
                    filters={contactFilters}
                    highlightMatch={highlightMatch}
                    search={search}
                    externalSearch={search}
                    searchHighlight={searchHighlight}
                    onSearchHighlightDone={() => setSearchHighlight(null)}
                  />
                )}

                {/* Accounts Table */}
                {activeContent === "accounts" && openTabs.includes("accounts") && (
                  <Accounts
                    accounts={accounts}
                    onToast={addToast}
                    onRefetch={() => { }}
                    onRefetchReady={null}
                    selectedColumns={selectedAccountColumns}
                    filters={accountFilters}
                    highlightMatch={highlightMatch}
                    search={search}
                    externalSearch={search}
                    searchHighlight={searchHighlight}
                    onSearchHighlightDone={() => setSearchHighlight(null)}
                  />
                )}

                {/* Products Table */}
                {activeContent === "products" && openTabs.includes("products") && (
                  <Product
                    products={
                      search.trim()
                        ? product.filter((p) =>
                          Object.values(p)
                            .join(" ")
                            .toLowerCase()
                            .includes(search.trim().toLowerCase())
                        )
                        : product
                    }
                    onToast={addToast}
                    onRefetch={() => window.refetchProducts && window.refetchProducts()}
                    categoryFilter={categoryFilter}
                    selectedColumns={selectedProductColumns}
                    filters={productFilters}
                    highlightMatch={highlightMatch}
                    search={search}
                  />
                )}

                {/* Deals Dashboard */}
                {activeContent === "deals" && openTabs.includes("deals") && (
                  <Deals
                    onToast={addToast}
                    onRefetchReady={(fn) => (window.refetchDeals = fn)}
                    onTagsAvailable={(tags) => setTagOptions(tags)}
                    highlightMatch={highlightMatch}
                    search={search}
                    filters={dealFilters}
                    onFiltersChange={setDealFilters}
                    selectedColumns={selectedDealColumns}
                    onSelectedColumnsChange={setSelectedDealColumns}
                    searchHighlight={searchHighlight}
                    onSearchHighlightDone={() => setSearchHighlight(null)}
                  />
                )}

                {/* Outlook Email */}
                {activeContent === "outlookEmail" && openTabs.includes("outlookEmail") && (
                  <OutlookEmail />
                )}

                {/* Teams Tab */}
                {activeContent === "teams" && openTabs.includes("teams") && (
                  <Teams />
                )}

                {/* Calendar Tab */}
                {activeContent === "calendar" && openTabs.includes("calendar") && (
                  <CalendarView />
                )}

                {/* Users Tab */}
                {activeContent === "users" && openTabs.includes("users") && (
                  <Users />
                )}

                {/* Call Logs Tab */}
                {activeContent === "calllogs" && openTabs.includes("calllogs") && (
                  <CallLogs onToast={addToast} />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {showFilterPanel === "contacts" && (
        <FilterPanel
          isOpen={true}
          onClose={() => setShowFilterPanel(null)}
          columns={contactColumns}
          selectedColumns={selectedContactColumns}
          onColumnsChange={setSelectedContactColumns}
          filters={contactFilters}
          onFiltersChange={setContactFilters}
          tagOptions={[]}
          onApply={() => { }}
          onClear={() => {
            setContactFilters([]);
            setSelectedContactColumns(contactColumns.map((c) => c.key));
          }}
        />
      )}
      {showFilterPanel === "accounts" && (
        <FilterPanel
          isOpen={true}
          onClose={() => setShowFilterPanel(null)}
          columns={accountColumns}
          selectedColumns={selectedAccountColumns}
          onColumnsChange={setSelectedAccountColumns}
          filters={accountFilters}
          onFiltersChange={setAccountFilters}
          tagOptions={tagOptions}
          allowAddFilter={false}
          onApply={() => { }}
          onClear={() => {
            setAccountFilters([]);
            setSelectedAccountColumns(accountColumns.map((c) => c.key));
          }}
        />
      )}
      {showFilterPanel === "products" && (
        <FilterPanel
          isOpen={true}
          onClose={() => setShowFilterPanel(null)}
          columns={[{ key: "name", label: "Name" }, ...productColumns]}
          selectedColumns={selectedProductColumns}
          onColumnsChange={setSelectedProductColumns}
          filters={productFilters}
          onFiltersChange={setProductFilters}
          showFilters={false}
          tagOptions={tagOptions}
          defaultColumnsExpanded={true}
          onApply={() => { }}
          onClear={() => {
            setProductFilters([]);
            setSelectedProductColumns(["name", ...productColumns.map((c) => c.key)]);
          }}
        />
      )}
      {showFilterPanel === "deals" && (
        <DealsFilterDrawer
          isOpen={true}
          onClose={() => setShowFilterPanel(null)}
          filters={dealFilters}
          dateRange={dealDateRange}
          createdByOptions={dealCreatedByOptions}
          onApply={(next, dates) => {
            setDealFilters(next);
            setDealDateRange(dates);
            window.dispatchEvent(new CustomEvent("dealsDateRange", { detail: dates }));
          }}
          onClear={() => {
            const emptyDates = { createdFrom: "", createdTo: "", updatedFrom: "", updatedTo: "" };
            setDealFilters([]);
            setDealDateRange(emptyDates);
            setSelectedDealColumns(dealColumns.map((c) => c.key));
            window.dispatchEvent(new CustomEvent("dealsDateRange", { detail: emptyDates }));
          }}
        />
      )}

      {/* Email Panel */}
      {showEmailPanel && <Email onClose={() => setShowEmailPanel(false)} />}
      {/* Add Form Side Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowPanel(false)} />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[60%] bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {activeContent === "contacts"
                  ? "Add New Contact"
                  : activeContent === "accounts"
                    ? "Add New Account"
                    : activeContent === "products"
                      ? "Add New Product"
                      : "Add New Deal"}
              </h3>
              <button
                onClick={() => setShowPanel(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <AddForms
                type={
                  activeContent === "contacts"
                    ? "contacts"
                    : activeContent === "accounts"
                      ? "accounts"
                      : activeContent === "products"
                        ? "products"
                        : activeContent === "deals"
                          ? "deals"
                          : null
                }
                accounts={accounts}
                contacts={contacts}
                products={activeContent === "products" ? setProducts : product}
                deals={undefined}
                onSuccess={() => {
                  setShowPanel(false);
                  addToast(
                    activeContent === "contacts"
                      ? "Contact added successfully!"
                      : activeContent === "accounts"
                        ? "Account added successfully!"
                        : activeContent === "products"
                          ? "Product added successfully!"
                          : "Deal added successfully!"
                  );
                  if (
                    activeContent === "deals" &&
                    typeof window.refetchDeals === "function"
                  ) {
                    window.refetchDeals();
                  }
                }}
                onError={() => {
                  addToast(
                    activeContent === "contacts"
                      ? "Failed to add contact"
                      : activeContent === "accounts"
                        ? "Failed to add account"
                        : activeContent === "products"
                          ? "Failed to add product"
                          : "Failed to add deal",
                    "error"
                  );
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Import Modal */}
      {showImportModal && ["accounts", "contacts", "deals", "products", "calllogs"].includes(activeContent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="px-6 py-6 bg-gradient-to-r  from-green-50 to-green-100 border-b">
              <button
                onClick={closeImportModal}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
                disabled={importLoading}
                aria-label="Close modal"
              >
                <X />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-xl">
                  <FileSpreadsheet className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Import {getImportConfig().label}</h2>
                  <p className="text-sm text-slate-600">Upload Excel to import {getImportConfig().label.toLowerCase()}</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleImportUpload} className="p-6 flex flex-col gap-6">
              {/* Drop Zone */}
              <div
                className="flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 border-green-300 bg-green-50"
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const event = { target: { files: [file] } };
                    handleImportFileChange(event);
                  }
                }}
                onClick={() => document.getElementById("dashboardFileInput").click()}
              >
                <input
                  id="dashboardFileInput"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFileChange}
                  disabled={importLoading}
                />
                {!importFile ? (
                  <>
                    <Upload className="w-10 h-10 text-green-600 mb-2 animate-bounce" />
                    <p className="text-base font-medium text-slate-700">
                      <span className="text-green-600 underline">Click</span> or drag & drop Excel file
                    </p>
                    <span className="text-xs text-slate-400 mt-1">Supported: .xlsx, .xls, .csv</span>
                  </>
                ) : (
                  <div className="flex items-center gap-2 bg-green-100 px-3 py-2 rounded-lg max-w-xs">
                    <FileSpreadsheet className="text-green-600 w-5 h-5 flex-shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-slate-700 truncate text-sm" title={importFile.name}>
                        {importFile.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {(importFile.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImportFile(null);
                      }}
                      className="ml-auto p-1 rounded hover:bg-red-200 flex-shrink-0"
                      disabled={importLoading}
                    >
                      <X className="text-red-500 w-4 h-4" />
                    </button>
                  </div>
                )}
                {importLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-xl">
                    <svg className="animate-spin h-8 w-8 text-green-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <span className="text-green-600 font-semibold">Uploading...</span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="flex-1 py-2.5 bg-slate-100 rounded-lg font-semibold text-slate-700 hover:bg-slate-200 transition"
                  disabled={importLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importLoading}
                  className={`flex-1 py-2.5 rounded-lg font-semibold bg-green-600 text-white flex items-center justify-center gap-2 shadow-md transition ${!importFile || importLoading ? "opacity-60 cursor-not-allowed" : "hover:bg-green-700"}`}
                >
                  {importLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 flex flex-col gap-2 z-40">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm animate-in fade-in slide-in-from-top-4 ${toast.type === "success"
              ? "bg-emerald-600"
              : toast.type === "error"
                ? "bg-red-600"
                : "bg-blue-600"
              }`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              className="text-white hover:text-gray-100 transition-colors"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


export default Dashboard;
