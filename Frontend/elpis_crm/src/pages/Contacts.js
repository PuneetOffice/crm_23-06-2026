import React, { useMemo, useState, useEffect, useContext, useRef } from "react";
import apiClient from "../api/client";
import AuthContext from "../auth/AuthContext";
import { Country, State, City } from "country-state-city";
import ContactEmailLogs from "./ContactEmailLogs";
import { FiTrash2 } from "react-icons/fi";
import { exportTableToExcel } from "../utils/excelExport";
import { useServerPagination } from "../hooks/useServerPagination";
import { LAZY_LOADING_CONFIG } from "../config/lazyLoadingConfig";
import SearchBar from "../utils/SearchBar";
import { searchAccounts } from "../api/entitySearch";
import { useSearchParams } from "react-router-dom";

// Compatibility wrapper: route same-origin fetch calls through axios client
async function fetchApi(url, options) {
  try {
    if (/^https?:\/\//i.test(url)) return window.fetch(url, options);
    const path = url.startsWith("/") ? url : `/${url}`;
    const method = (options && options.method) || "GET";
    if (method === "GET") {
      const res = await apiClient.get(path, { params: options && options.params });
      return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) };
    }
    const res = await apiClient.request({ url: path, method, data: options && options.body, headers: options && options.headers });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) };
  } catch (err) {
    return Promise.reject(err);
  }
}

// Use module-local `fetch` so existing code can call fetch(...) unchanged
const fetch = fetchApi;

function extractUniqueEmails(...values) {
  const seen = new Set();
  const emails = [];

  const addEmail = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    emails.push(normalized);
  };

  const collect = (value) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(collect);
      return;
    }

    String(value)
      .split(/[;,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(addEmail);
  };

  values.forEach(collect);
  return emails;
}

function Contacts({
  contacts,
  onToast,
  selectedColumns,
  filters,
  highlightMatch,
  search,
  externalSearch,
  onRefetch,
  onRefetchReady,
  searchHighlight,
  onSearchHighlightDone,
}) {
  // Get user role from AuthContext
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const userName = auth?.getUserName?.() || localStorage.getItem("userName") || "";
  const isAdmin = ["Admin", "admin", "Manager", "manager"].includes(userRole);
  const isAdminOnly = ["Admin", "admin"].includes(userRole); // for delete actions

  // Can edit = admin/manager OR user created the record
  const canEditContact = (contact) => {
    if (!contact) return false;
    if (isAdmin) return true;
    const creator = contact.CreatedBy || contact.createdBy || "";
    return creator !== "" && creator === userName;
  };

  // Define state for sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [localSearch, setLocalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");


  // Account picker in contact slide-in (separate from table search)
  const [slideAccountSearch, setSlideAccountSearch] = useState("");
  const [slideAccountMenuOpen, setSlideAccountMenuOpen] = useState(false);
  const slideAccountListSyncRef = useRef(null);
  const [debouncedSlideAccountSearch, setDebouncedSlideAccountSearch] = useState("");
  const [slideAccountSearchLoading, setSlideAccountSearchLoading] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSlideAccountSearch(slideAccountSearch), 300);
    return () => clearTimeout(t);
  }, [slideAccountSearch]);

  // Sync global header search into local search
  React.useEffect(() => {
    if (externalSearch !== undefined && externalSearch !== localSearch) {
      setLocalSearch(externalSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSearch]);

  // Debounce search - wait 400ms after user stops typing before fetching
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 250);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Helper to read fields with case-insensitive fallback
  const getField = (obj, key) => {
    if (!obj) return undefined;
    if (key in obj) return obj[key];
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    if (lower in obj) return obj[lower];
    const alt = key.toLowerCase();
    return obj[alt];
  };

  // format a value as date-only (YYYY-MM-DD) using local timezone
  const formatDateOnly = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const date = new Date(val);
    if (isNaN(date.getTime())) return String(val);
    // Use local date, not UTC date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dateNum = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${dateNum}`;
  };

  // Update date fields that should render as date-only in the table and slide-in
  const dateFields = new Set(["LastActivityDate", "LastAssignedAt", "LastContactedTime", "LastSeenOnChat", "FirstSeenOnChat", "LastSeenOnWeb", "CreatedAt", "UpdatedAt"]);

  // Define columns for the table with useMemo
  const allColumns = useMemo(
    () => [
      // Core Identity
      { key: "FirstName", label: "First Name" },
      { key: "LastName", label: "Last Name" },
      { key: "Account", label: "Account" },
      { key: "EnquiryNo", label: "Enquiry No" },
      { key: "JobTitle", label: "Job Title" },

      { key: "WorkEmail", label: "Work Email" },
      { key: "WorkPhone", label: "Work Phone" },
      { key: "Mobile", label: "Mobile" },
      { key: "LinkedIn", label: "LinkedIn" },
      { key: "Facebook", label: "Facebook" },
      { key: "Twitter", label: "Twitter" },

      // Location
      { key: "Address", label: "Address" },
      { key: "Country", label: "Country" },
      { key: "State", label: "State" },
      { key: "City", label: "City" },
      { key: "Zipcode", label: "Zipcode" },
      { key: "TimeZone", label: "Time Zone" },
      { key: "Locale", label: "Locale" },
      // Assignment
      { key: "SalesOwner", label: "Sales Owner" },
      // { key: "SalesOwnerId", label: "Sales Owner ID" }, // âŒ HIDDEN - Internal ID should not be visible
      { key: "Status", label: "Status" },
      // Classification & Marketing
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
      // Marketing Attribution
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
      // Activity
      { key: "LastActivityType", label: "Last Activity Type" },
      { key: "LastActivityDate", label: "Last Activity Date" },
      { key: "LastContactedTime", label: "Last Contacted Time" },
      { key: "LastContactedMode", label: "Last Contacted Mode" },
      { key: "LastSeenOnChat", label: "Last Seen On Chat" },
      { key: "LastSeenOnWeb", label: "Last Seen On Web" },
      { key: "RecentNote", label: "Recent Note" },
      { key: "LastAssignedAt", label: "Last Assigned At" },
      // Chat & Engagement
      { key: "TotalChatSessions", label: "Total Chat Sessions" },
      { key: "FirstSeenOnChat", label: "First Seen On Chat" },
      // Sequences
      { key: "ActiveSalesSequences", label: "Active Sales Sequences" },
      { key: "CompletedSalesSequences", label: "Completed Sales Sequences" },
      // System
      { key: "CreatedAt", label: "Created At" },
      { key: "UpdatedAt", label: "Updated At" },
      { key: "CreatedBy", label: "Created By" },
      // { key: "CreatedById", label: "Created By ID" }, // âŒ HIDDEN - Internal ID should not be visible
      { key: "UpdatedBy", label: "Updated By" },
      // { key: "UpdatedById", label: "Updated By ID" }, // âŒ HIDDEN - Internal ID should not be visible
      // Additional Fields
      // { key: "ExternalID", label: "External ID" }, // âŒ HIDDEN - Internal ID should not be visible
      // { key: "ImportID", label: "Import ID" }, // âŒ HIDDEN - Internal ID should not be visible
      { key: "WebForms", label: "Web Forms" },
    ],
    []
  );

  // Always add Name as the first column for display
  const columns = useMemo(() => {
    const base = selectedColumns && selectedColumns.length > 0
      ? allColumns.filter((col) => selectedColumns.includes(col.key))
      : allColumns;
    return [{ key: "Name", label: "Name" }, ...base];
  }, [allColumns, selectedColumns]);

  // Define state for sorting

  // State for selected rows
  const [selected, setSelected] = useState(() => new Set());
  const [isExportingAll, setIsExportingAll] = useState(false);

  // Server-side pagination hook - fetch contacts in pages
  const fetchContactsPage = React.useCallback(async (page, pageSize) => {
    try {
      const normalizedSearch = debouncedSearch.trim();
      const tagFilter = (filters || []).find(f => String(f.field).toLowerCase().includes('tag'));
      if (tagFilter && tagFilter.value) {
        const tagValue = Array.isArray(tagFilter.value) ? tagFilter.value.join(',') : String(tagFilter.value);
        const res = await fetch(`/Contact/tags/contacts?tags=${encodeURIComponent(tagValue)}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        const items = Array.isArray(json) ? json : [];
        return { items, totalCount: items.length };
      }
      // Always use server-side paged search - fast for both empty and non-empty queries
      const searchParam = normalizedSearch ? `&search=${encodeURIComponent(normalizedSearch)}` : '';
      const res = await fetch(`/Contact?page=${page}&pageSize=${pageSize}${searchParam}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      return {
        items: Array.isArray(json.items) ? json.items : [],
        totalCount: json.totalCount || 0,
      };
    } catch (err) {
      console.error('Error fetching paginated contacts:', err);
      return { items: [], totalCount: 0 };
    }
  }, [filters, debouncedSearch]);

  const {
    data: paginatedContacts,
    currentPage,
    totalItems,
    totalPages,
    loading: paginationLoading,
    goToPage,
    nextPage,
    prevPage,
    clearCache
  } = useServerPagination(fetchContactsPage, LAZY_LOADING_CONFIG.PAGE_SIZE);

  // sorted data - use paginatedContacts directly to reduce state updates
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return paginatedContacts;
    const sorted = [...paginatedContacts].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === "Name") {
        aVal = `${a.FirstName || ''} ${a.LastName || ''}`.trim();
        bVal = `${b.FirstName || ''} ${b.LastName || ''}`.trim();
      } else {
        aVal = a[sortConfig.key] ?? "";
        bVal = b[sortConfig.key] ?? "";
      }
      if (
        !isNaN(Number(aVal)) &&
        !isNaN(Number(bVal)) &&
        aVal !== "" &&
        bVal !== ""
      ) {
        return sortConfig.direction === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [paginatedContacts, sortConfig]);

  // Since data is already paginated from server, no need to slice
  const paginatedData = sortedData;

  // Load first page on mount
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({
    ContactId: "",
    FirstName: "",
    LastName: "",
    JobTitle: "",
    EnquiryNo: "",
    WorkEmail: "",
    WorkPhone: "",
    Mobile: "",
    LinkedIn: "",
    Facebook: "",
    Twitter: "",
    Address: "",
    Country: "",
    State: "",
    City: "",
    Zipcode: "",
    TimeZone: "",
    Locale: "",
    SalesOwnerId: "",                              // Numeric ID field
    SalesOwner: "",                                // Display name field
    AccountId: "",                                 // Numeric ID field
    Account: "",                                   // Display name field
    Status: "",
    LifeCycleStage: "",
    Territory: "",
    Tags: "",
    Source: "",
    Campaign: "",
    CustomerFit: "",
    Score: "",
    SubscriptionStatus: "",
    LastActivityType: "",
    LastActivityDate: "",
    LastContactedTime: "",
    LastContactedMode: "",
    LastSeenOnChat: "",
    LastSeenOnWeb: "",
    RecentNote: "",
    LastAssignedAt: "",
    TotalChatSessions: "",
    FirstSeenOnChat: "",
    CreatedAt: "",
    UpdatedAt: "",
    CreatedBy: "",
    UpdatedBy: "",
    ExternalID: "",
    ImportID: "",
    WebForms: "",
    ActiveSalesSequences: "",
    CompletedSalesSequences: "",
  });
  // Country/State/City for slide-in details
  const [slideCountryCode, setSlideCountryCode] = useState("");
  const [slideStateCode, setSlideStateCode] = useState("");

  // Slide-in details state - declare early for use in dependencies
  const [selectedContactDetails, setSelectedContactDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // Get all countries
  const countries = Country.getAllCountries();

  // States and cities for slide-in
  const slideStates = useMemo(() => slideCountryCode ? State.getStatesOfCountry(slideCountryCode) : [], [slideCountryCode]);
  const slideCities = slideCountryCode && slideStateCode ? City.getCitiesOfState(slideCountryCode, slideStateCode) : [];

  // When selectedContactDetails.Country changes, update slideCountryCode
  useEffect(() => {
    if (!selectedContactDetails) return;
    const countryName = getField(selectedContactDetails, "Country");
    if (!countryName) {
      setSlideCountryCode("");
      return;
    }
    const found = countries.find(c => c.name === countryName);
    setSlideCountryCode(found ? found.isoCode : "");
  }, [selectedContactDetails, countries]);

  // When selectedContactDetails.State changes, update slideStateCode
  useEffect(() => {
    if (!selectedContactDetails) return;
    const stateName = getField(selectedContactDetails, "State");
    if (!stateName || !slideCountryCode) {
      setSlideStateCode("");
      return;
    }
    const found = slideStates.find(s => s.name === stateName);
    setSlideStateCode(found ? found.isoCode : "");
  }, [selectedContactDetails, slideCountryCode, slideStates]);
  //using public Api's for fetching states and cities dynamically

  // Email/Call logs slide-in state
  const [showEmailLogs, setShowEmailLogs] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState("email"); // "email" or "call"

  // Business Card Modal state
  const [showBusinessCard, setShowBusinessCard] = useState(false);
  const [businessCardImages, setBusinessCardImages] = useState({ front: null, back: null });
  const [businessCardLoading, setBusinessCardLoading] = useState(false);
  const [businessCardZoom, setBusinessCardZoom] = useState(1);
  const [businessCardSide, setBusinessCardSide] = useState("front");

  const handleBusinessCardWheel = (event) => {
    event.preventDefault();
    setBusinessCardZoom((z) => {
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      const next = Math.min(2, Math.max(1, z + delta));
      return Math.round(next * 100) / 100;
    });
  };

  // State for accounts list (merged cache: slide-in search + single-account fetches)
  const [accountsList, setAccountsList] = useState([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = debouncedSlideAccountSearch.trim();
      if (q.length < 2) {
        setSlideAccountSearchLoading(false);
        return;
      }
      setSlideAccountSearchLoading(true);
      try {
        const rows = await searchAccounts(q, 60);
        if (cancelled) return;
        setAccountsList((prev) => {
          const byId = new Map();
          [...(Array.isArray(prev) ? prev : []), ...rows].forEach((a) => {
            const id = a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
            if (id != null && id !== "") byId.set(String(id), a);
          });
          return Array.from(byId.values());
        });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setSlideAccountSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSlideAccountSearch]);

  // Handler to show contact details in slide-in
  const handleShowContactDetails = React.useCallback(async (contactId) => {
    if (!contactId && contactId !== 0) return;
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedContactDetails(null);
    setSlideAccountSearch("");
    setSlideAccountMenuOpen(false);
    slideAccountListSyncRef.current = null;
    try {
      const res = await fetch(`/Contact/${encodeURIComponent(contactId)}`);
      if (!res.ok) {
        setDetailsError(`Failed to load details: ${res.status}`);
        return;
      }
      const data = await res.json();
      setSelectedContactDetails(data);
      const nameFromApi = String(getField(data, "Account") ?? "").trim();
      setSlideAccountSearch(nameFromApi);
    } catch (err) {
      setDetailsError("Error fetching contact details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleCloseContactDetails = () => {
    setSelectedContactDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
    setSlideAccountSearch("");
    setSlideAccountMenuOpen(false);
    slideAccountListSyncRef.current = null;
  };

  // Handle opening contact from query parameter
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const queryContactId = searchParams.get('id');
    if (queryContactId) {
      handleShowContactDetails(queryContactId);
    }
  }, [searchParams, handleShowContactDetails]);

  // Open contact slide-in when routed from Accounts (or global search highlight)
  useEffect(() => {
    if (!searchHighlight || searchHighlight.type !== "contact") return;
    const rawId = searchHighlight.id;
    if (rawId === undefined || rawId === null || rawId === "") return;

    let cancelled = false;
    (async () => {
      try {
        await handleShowContactDetails(rawId);
      } finally {
        if (!cancelled && typeof onSearchHighlightDone === "function") {
          onSearchHighlightDone();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when highlight payload changes
  }, [searchHighlight]);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [deleteContactName, setDeleteContactName] = useState('');

  // Fetch data from API on mount - load first page
  useEffect(() => {
    goToPage(1);
  }, [goToPage]);

  // Reload contacts when filters or search changes
  useEffect(() => {
    clearCache();
    goToPage(1);
  }, [filters, debouncedSearch, goToPage, clearCache]);

  // Refetch when an import completes for Contacts
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail?.table || e.detail.table === "Contacts") {
        clearCache();
        goToPage(1);
      }
    };
    window.addEventListener("importComplete", handler);
    return () => window.removeEventListener("importComplete", handler);
  }, [clearCache, goToPage]);

  // Refetch when a contact is added
  useEffect(() => {
    const handler = () => {
      clearCache();
      goToPage(1);
    };
    window.addEventListener("contactAdded", handler);
    return () => window.removeEventListener("contactAdded", handler);
  }, [clearCache, goToPage]);

  // Select or deselect all rows
  const toggleAll = () => {
    const next = selected.size === (sortedData?.length || 0) ? new Set() : new Set((sortedData || []).map((_, idx) => idx));
    setSelected(next);
    // persist selected emails and tags to localStorage
    const emails = Array.from(next)
      .map((i) => getField(sortedData[i], "WorkEmail"))
      .filter(Boolean);
    const tags = Array.from(next)
      .map((i) => getField(sortedData[i], "Tags"))
      .flatMap((tagStr) =>
        typeof tagStr === "string"
          ? tagStr.split(/,|;/).map((t) => t.trim()).filter(Boolean)
          : []
      );
    if (emails.length)
      localStorage.setItem("selectedContactEmails", JSON.stringify(emails));
    else localStorage.removeItem("selectedContactEmails");
    if (tags.length)
      localStorage.setItem("selectedContactTags", JSON.stringify(tags));
    else localStorage.removeItem("selectedContactTags");
  };

  // Toggle a single row selection
  const toggleRow = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      // persist selected emails and tags to localStorage
      const emails = Array.from(next)
        .map((i) => getField(sortedData[i], "WorkEmail"))
        .filter(Boolean);
      const tags = Array.from(next)
        .map((i) => getField(sortedData[i], "Tags"))
        .flatMap((tagStr) =>
          typeof tagStr === "string"
            ? tagStr.split(/,|;/).map((t) => t.trim()).filter(Boolean)
            : []
        );
      if (emails.length)
        localStorage.setItem("selectedContactEmails", JSON.stringify(emails));
      else localStorage.removeItem("selectedContactEmails");
      if (tags.length)
        localStorage.setItem("selectedContactTags", JSON.stringify(tags));
      else localStorage.removeItem("selectedContactTags");
      return next;
    });
  };

  // Sorting Handling
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Refetch data from API - reload current page
  const refetch = React.useCallback(async () => {
    clearCache();
    goToPage(currentPage);
  }, [goToPage, currentPage, clearCache]);

  // Allow parent/dashboard/header to trigger this component refresh
  React.useEffect(() => {
    if (typeof onRefetchReady === "function") {
      onRefetchReady(refetch);
    }
  }, [onRefetchReady, refetch]);

  // Export selected rows as CSV
  const exportCsv = () => {
    try {
      exportTableToExcel({
        data: sortedData,
        selected,
        columns,
        title: "Contacts Export",
        filename: "contacts_export.xlsx",
        getField,
      });
      onToast && onToast(`Exported ${selected.size} contacts to Excel`, "success");
    } catch (error) {
      onToast && onToast("Failed to export contacts", "error");
      console.error("Export error:", error);
    }
  };
  // Export all contacts using backend export API
  const exportAllCsv = async () => {
    if (isExportingAll) return;
    setIsExportingAll(true);
    try {
      const payload = {
        search: localSearch || "",
        columns: selectedColumns || [],
      };
      const response = await apiClient.post("/export/contacts", payload, {
        responseType: "blob",
      });

      if (!response || !response.data) {
        throw new Error("Invalid export response");
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "contacts.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onToast && onToast("Export download started", "success");
    } catch (error) {
      onToast && onToast("Failed to export all contacts", "error");
      console.error("Export all error:", error);
    } finally {
      setIsExportingAll(false);
    }
  };

  // Delete selected rows
  const handleDeleteClick = () => {
    const indexes = Array.from(selected);
    const ids = indexes.map((i) => getField(sortedData[i], "ContactId")).filter((v) => v !== undefined && v !== null);
    console.log("handleDeleteClick selected indexes:", indexes, "ids:", ids);
    if (ids.length === 0) {
      onToast?.("No contacts selected to delete", "error");
      return;
    }
    setDeleteCount(ids.length);
    const _names = indexes.map((i) => { const _r = sortedData[i]; const fn = getField(_r, 'FirstName') || ''; const ln = getField(_r, 'LastName') || ''; return (fn + ' ' + ln).trim() || 'Contact'; }); setDeleteContactName(_names.join(', '));
    setShowDeleteModal(true);
    onToast?.(`Delete ${ids.length} contact(s) selected`, "info");
  };

  const confirmDelete = async () => {
    const indexes = Array.from(selected);
    const ids = indexes
      .map((i) => getField(sortedData[i], "ContactId"))
      .filter(Boolean);

    setShowDeleteModal(false);
    if (ids.length === 0) return;

    try {
      console.log("Deleting contacts", ids);
      onToast?.(`Deleting ${ids.length} contact(s)...`, "info");
      await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/Contact/${id}`, {
            method: "DELETE",
          });
          console.log(`DELETE /Contact/${id} -> ${res.status}`);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error(`Delete failed for ${id}:`, res.status, text);
            throw new Error(`Failed to delete contact ${id}: ${res.status}`);
          }
          return res;
        })
      );

      clearCache();
      await refetch();
      setSelected(new Set());
      // notify parent to refresh its list (Dashboard)
      try { onRefetch?.(); } catch (_) { }
      onToast?.(`Deleted ${ids.length} contacts`, "success");
      // close slide-in details if open
      try { handleCloseContactDetails(); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      onToast?.("Failed to delete contacts", "error");
    }
  };


  // Update a row
  const updateRow = async (index, updated) => {
    const id = getField(sortedData[index], "ContactId");
    if (id === undefined || id === null) return;
    try {
      const res = await fetch(`/Contact/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      }
      );
      if (!res.ok) throw new Error("Update failed");
      await refetch();
      if (onToast) onToast("Contact updated", "success");
      try { onRefetch?.(); } catch (_) { }
    } catch (_) {
      if (onToast) onToast("Failed to update", "error");
    }
  };


  // Note: Edit functionality is handled via row selection and edit modal

  // Submit edit form
  const submitEdit = async (e) => {
    e.preventDefault();
    // Add updatedBy to track who made the edit
    const updatedData = {
      ...editForm,
    };
    await updateRow(editIndex, updatedData);
    setIsEditing(false);
    setEditIndex(null);
  };
  // Track which row's tags popover is open (null = none)
  const [activeTagsIndex, setActiveTagsIndex] = React.useState(null);
  const popoverRef = React.useRef();
  React.useEffect(() => {
    if (activeTagsIndex === null) return;
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setActiveTagsIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeTagsIndex]);
  // Pagination info comes from the useServerPagination hook:
  // - currentPage, totalPages, totalItems are already set
  // - Data is already limited to PAGE_SIZE items

  const startIndex = (currentPage - 1) * LAZY_LOADING_CONFIG.PAGE_SIZE;
  const endIndex = Math.min(startIndex + LAZY_LOADING_CONFIG.PAGE_SIZE, totalItems);

  // Calculate selection states for displayed (sorted) rows
  const allSelected = (sortedData && sortedData.length > 0) ? selected.size === sortedData.length : false;
  const someSelected = selected.size > 0 && !allSelected;

  // Helper functions for initials and colors
  function getInitials(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  }
  //For Circle background colors based on name
  function getColorFromString(str, alpha = 0.35, lightness = 85) {
    if (!str) return `hsla(210, 70%, 90%, ${alpha})`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
  }
  // Darker color for text inside circle
  function getDarkerColorFromString(str, alpha = 1, lightness = 45) {
    if (!str) return `hsla(210, 70%, 45%, ${alpha})`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
  }

  // Cache for account names by id to avoid repeated lookups, prefilled from accountsList
  const [accountNameCache, setAccountNameCache] = useState({});


  // Prefill accountNameCache from accountsList whenever it changes
  useEffect(() => {
    if (!Array.isArray(accountsList) || accountsList.length === 0) return;
    setAccountNameCache((prev) => {
      const next = { ...prev };
      accountsList.forEach((a) => {
        const id = a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
        const name = a?.Name ?? a?.name ?? a?.title ?? a?.Title;
        if (id != null && name) next[String(id)] = name;
      });
      return next;
    });
  }, [accountsList]);

  // Resolve account names from accountsList; fetch /Account/:id when still unknown (batched)
  useEffect(() => {
    if (!sortedData || sortedData.length === 0) return;
    const updates = {};
    const toFetch = [];
    sortedData.forEach((contact) => {
      const accId = getField(contact, "AccountId") ?? getField(contact, "accountId");
      if (accId == null) return;
      const key = String(accId);
      if (accountNameCache[key] !== undefined) return;
      const found = Array.isArray(accountsList) && accountsList.find(
        (a) => String(a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id) === key
      );
      if (found) {
        updates[key] = found.Name ?? found.name ?? null;
      } else if (!toFetch.includes(key)) {
        toFetch.push(key);
      }
    });
    if (Object.keys(updates).length > 0) {
      setAccountNameCache((prev) => ({ ...prev, ...updates }));
    }
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const key of toFetch.slice(0, 25)) {
        if (cancelled) break;
        try {
          const res = await apiClient.get(`/Account/${encodeURIComponent(key)}`);
          const a = res.data;
          if (!a) {
            setAccountNameCache((prev) => ({ ...prev, [key]: null }));
            continue;
          }
          setAccountsList((prev) => {
            const byId = new Map();
            [...(Array.isArray(prev) ? prev : []), a].forEach((row) => {
              const id = row?.AccountId ?? row?.accountId ?? row?.Id ?? row?.id;
              if (id != null && id !== "") byId.set(String(id), row);
            });
            return Array.from(byId.values());
          });
          const nm = a.Name ?? a.name ?? null;
          setAccountNameCache((prev) => ({ ...prev, [key]: nm }));
        } catch {
          setAccountNameCache((prev) => ({ ...prev, [key]: null }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sortedData, accountsList, accountNameCache]);

  // After contact opens: fill slide-in account search from cache, merged list, or GET /Account/:id
  useEffect(() => {
    if (!selectedContactDetails) return;
    const cid = String(
      getField(selectedContactDetails, "ContactId") ??
      getField(selectedContactDetails, "contactId") ??
      ""
    );
    if (!cid) return;
    const nameFromApi = String(getField(selectedContactDetails, "Account") ?? "").trim();
    if (nameFromApi) {
      slideAccountListSyncRef.current = cid;
      return;
    }
    const accId = getField(selectedContactDetails, "AccountId") ?? getField(selectedContactDetails, "accountId");
    if (accId == null || accId === "") {
      slideAccountListSyncRef.current = cid;
      return;
    }
    if (slideAccountListSyncRef.current === cid) return;

    const found = Array.isArray(accountsList) && accountsList.find(
      (a) => String(a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id) === String(accId)
    );
    if (found) {
      const nm = (found.Name ?? found.name ?? "").trim();
      if (nm) {
        setSlideAccountSearch(nm);
        slideAccountListSyncRef.current = cid;
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/Account/${encodeURIComponent(accId)}`);
        const a = res.data;
        if (!a || cancelled) return;
        setAccountsList((prev) => {
          const byId = new Map();
          [...(Array.isArray(prev) ? prev : []), a].forEach((row) => {
            const id = row?.AccountId ?? row?.accountId ?? row?.Id ?? row?.id;
            if (id != null && id !== "") byId.set(String(id), row);
          });
          return Array.from(byId.values());
        });
        const nm = (a.Name ?? a.name ?? "").trim();
        if (nm) {
          setSlideAccountSearch(nm);
          slideAccountListSyncRef.current = cid;
        }
      } catch {
        slideAccountListSyncRef.current = cid;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedContactDetails, accountsList]);

  // Resolve account name for slide-in from accountsList (no API call)
  useEffect(() => {
    if (!selectedContactDetails) return;
    const accId = getField(selectedContactDetails, "AccountId") ?? getField(selectedContactDetails, "accountId");
    if (accId == null) return;
    const key = String(accId);
    if (accountNameCache[key] !== undefined) return;
    const found = Array.isArray(accountsList) && accountsList.find(
      (a) => String(a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id) === key
    );
    setAccountNameCache((prev) => ({ ...prev, [key]: found ? (found.Name ?? found.name ?? null) : null }));
  }, [selectedContactDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  const panelOpen = !!(detailsLoading || detailsError || selectedContactDetails);
  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative flex flex-col flex-1 w-full h-full min-h-0 overflow-hidden font-[poppins,sans-serif]">
        {paginationLoading && (
          <div className="absolute inset-0 z-40 bg-white/75 backdrop-blur-sm flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        )}
        {selected.size > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-blue-50 rounded-lg sm:rounded-xl px-4 sm:px-6 py-3 sm:py-3.5 shadow-sm border border-blue-100 mb-4 w-full backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                {selected.size}
              </div>
              <span className="text-sm sm:text-base text-gray-700">selected</span>
            </div>
            <div className="hidden sm:flex flex-1" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                className="flex-1 sm:flex-none bg-white border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 font-medium hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
                onClick={exportCsv}
              >
                Export Selected
              </button>
              <button
                className="flex-1 sm:flex-none bg-white border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 font-medium hover:bg-gray-50 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={exportAllCsv}
                disabled={isExportingAll}
              >
                {isExportingAll ? (
                  <span className="inline-block animate-spin mr-2"></span>
                ) : null}
                Export All
              </button>
              {isAdminOnly && (
                <button
                  aria-label="Delete selected"
                  className="flex-1 sm:flex-none bg-white border border-red-200 text-red-600 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium hover:bg-red-50 transition-all duration-200"
                  onClick={handleDeleteClick}
                >
                  <FiTrash2 className="inline mr-1" /> Delete
                </button>
              )}
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
            <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Confirm Delete</h4>
                <p className="text-sm sm:text-base text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteContactName || `${deleteCount} contact${deleteCount > 1 ? 's' : ''}`}</span>?</p>
              </div>
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={() => setShowDeleteModal(false)}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  Cancel
                </button>
                <button type="button" onClick={confirmDelete}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-md focus:ring-2 focus:ring-red-500 focus:outline-none">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Business Card Modal */}
        {showBusinessCard && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-4 sm:p-5 transform animate-in zoom-in-95 duration-200 max-h-[86vh] overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 mb-4">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Business Card</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedContactDetails?.FirstName || selectedContactDetails?.firstName || ''} {selectedContactDetails?.LastName || selectedContactDetails?.lastName || ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBusinessCard(false)}
                  className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-150"
                  aria-label="Close business card modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {businessCardLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm text-gray-700">
                    <div>Scroll to zoom, double-click to reset</div>
                    {businessCardImages.back && (
                      <div className="flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => setBusinessCardSide('front')}
                          className={`px-3 py-2 rounded-lg transition-colors duration-150 ${businessCardSide === 'front' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          onClick={() => setBusinessCardSide('back')}
                          className={`px-3 py-2 rounded-lg transition-colors duration-150 ${businessCardSide === 'back' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Back
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
                    <div className="text-sm font-medium text-gray-900 px-4 py-3 border-b border-gray-200 bg-white">
                      {businessCardSide === 'front' ? 'Front' : 'Back'}
                    </div>
                    <div
                      className="relative overflow-auto bg-black/5 cursor-zoom-in"
                      style={{ minHeight: '40vh', maxHeight: '56vh' }}
                      onWheel={handleBusinessCardWheel}
                      onDoubleClick={() => setBusinessCardZoom(1)}
                    >
                      {businessCardImages[businessCardSide] ? (
                        <div className="flex items-center justify-center p-4">
                          <img
                            src={businessCardImages[businessCardSide]}
                            alt={`Business Card ${businessCardSide}`}
                            className="max-w-full max-h-[48vh] object-contain"
                            style={{
                              transform: `scale(${businessCardZoom})`,
                              transformOrigin: 'center',
                              transition: 'transform 0.15s ease-in-out',
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[40vh] text-gray-500 text-sm">
                          No {businessCardSide} image available.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* Contacts Table with Sticky Pagination */}
        <div className="w-full flex-1 min-h-0 flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          {/* Sticky Search Bar */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-end gap-3">
            {localSearch && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Results for "<span className="font-medium text-gray-700">{localSearch}</span>"
              </span>
            )}
            <SearchBar
              value={localSearch}
              onChange={setLocalSearch}
              placeholder="Search contacts..."
              className="max-w-xs"
            />
          </div>
          {/* Table Container - Scrollable with fixed height */}
          <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-auto relative visible-scrollbar">
            <table className="min-w-max w-full border-collapse">
              <thead className="sticky top-0 z-30 bg-white shadow-sm" style={{ position: 'sticky', top: 0 }}>
                <tr>
                  {/* Select All Checkbox - Touch friendly */}
                  <th className="sticky left-0 z-40 min-w-10 sm:min-w-12 w-10 sm:w-12 px-2 sm:px-3 py-3 text-center bg-gray-50">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </th>
                  {/* Column Headers with Sorting */}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 select-none cursor-pointer hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap ${col.key === "Name"
                        ? "sticky left-10 sm:left-12 z-30 min-w-40 bg-gray-50"
                        : "hidden sm:table-cell min-w-20 sm:min-w-32"
                        }`}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">{col.label}</span>
                        {sortConfig.key === col.key && (
                          <span className="text-blue-600 flex-shrink-0">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table body */}
              <tbody className="divide-y divide-gray-100">
                {paginatedData.map((contact, index) => (
                  <tr
                    key={getField(contact, "ContactId") ?? getField(contact, "FirstName") + getField(contact, "LastName") ?? index}
                    className={`transition-all duration-150 hover:bg-gray-50 ${selected.has(index) ? "bg-blue-50" : "bg-white"
                      }`}
                  >
                    {/* Row Selection Checkbox */}
                    <td
                      className="sticky left-0 bg-inherit text-center min-w-10 sm:min-w-12 w-10 sm:w-12 px-2 sm:px-3 py-3 flex items-center justify-center"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${index + 1}`}
                        checked={selected.has(index)}
                        onChange={() => toggleRow(index)}
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* Data cells */}
                    {columns.map((col, colIdx) => {
                      let tooltipContent = "";
                      if (col.key === "FirstName" || col.key === "LastName") {
                        tooltipContent = getField(contact, col.key) || "";
                      } else if (col.key === "AccountId") {
                        const accId = getField(contact, "AccountId");
                        if (!accId) {
                          tooltipContent = "No account";
                        } else {
                          const acct = accountsList.find((a) => String(a.AccountId ?? a.accountId ?? a.Id ?? a.id) === String(accId));
                          tooltipContent = (acct && (acct.Name || acct.name)) ? (acct.Name ?? acct.name) : "Loading...";
                        }
                      } else if (col.key === "Tags") {
                        const raw = getField(contact, "Tags") ?? "";
                        tooltipContent = raw ? String(raw).split(/,|;/).map((t) => t.trim()).filter(Boolean).join(", ") : "-";
                      } else {
                        const raw = getField(contact, col.key);
                        tooltipContent = dateFields.has(col.key) ? formatDateOnly(raw) : String(raw || "");
                      }
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-left text-xs sm:text-sm text-gray-700 ${col.key === "Name"
                            ? "sticky left-10 sm:left-12 min-w-40 bg-white max-w-xs overflow-hidden"
                            : "hidden sm:table-cell bg-inherit max-w-xs truncate overflow-hidden"
                            }`}
                          title={tooltipContent}
                        >
                          {col.key === "Name" ? (
                            <a
                              href={`/dashboard/contacts?id=${getField(contact, "ContactId")}`}
                              onClick={(e) => {
                                e.preventDefault();
                                handleShowContactDetails(getField(contact, "ContactId"));
                              }}
                              className="flex items-center gap-2 font-medium text-blue-600 cursor-pointer hover:text-blue-700 transition-colors duration-150 group w-full min-w-0"
                            >
                              <span
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg shadow-sm font-semibold text-sm transition-transform duration-200 group-hover:scale-110 flex-shrink-0"
                                style={{
                                  background: getColorFromString(
                                    `${getField(contact, "FirstName") || ''} ${getField(contact, "LastName") || ''}`.trim(),
                                    0.35,
                                    85
                                  ),
                                  color: getDarkerColorFromString(
                                    `${getField(contact, "FirstName") || ''} ${getField(contact, "LastName") || ''}`.trim(),
                                    1,
                                    45
                                  ),
                                }}
                                title={`${getField(contact, "FirstName") || ''} ${getField(contact, "LastName") || ''}`.trim()}
                              >
                                {getInitials(`${getField(contact, "FirstName") || ''} ${getField(contact, "LastName") || ''}`.trim())}
                              </span>
                              <span className="group-hover:underline truncate min-w-0">
                                {highlightMatch
                                  ? highlightMatch(`${getField(contact, "FirstName") || ''} ${getField(contact, "LastName") || ''}`.trim(), search)
                                  : `${getField(contact, "FirstName") || ''} ${getField(contact, "LastName") || ''}`.trim()}
                              </span>
                            </a>
                          ) : col.key === "Tags" ? (
                            (() => {
                              const raw = getField(contact, "Tags") ?? "";
                              if (!raw)
                                return (
                                  <span className="italic text-gray-400">-</span>
                                );
                              const tags = String(raw)
                                .split(/,|;/)
                                .map((t) => t.trim())
                                .filter(Boolean);
                              if (tags.length === 0)
                                return (
                                  <span className="italic text-gray-400">-</span>
                                );
                              // Popover state

                              return (
                                <div className="flex items-center gap-1 relative">
                                  <span
                                    className="px-5 py-2.5 rounded-full text-xs font-semibold"
                                    style={{
                                      background: getColorFromString(
                                        tags[0],
                                        0.18,
                                        55
                                      ),
                                      color: getDarkerColorFromString(tags[0], 1, 30),
                                    }}
                                    title={tags[0]}
                                  >
                                    {tags[0]}
                                  </span>
                                  {tags.length > 1 && (
                                    <button
                                      type="button"
                                      className="ml-1 px-2 py-1 rounded-full bg-gray-200 text-xs font-semibold hover:bg-gray-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTagsIndex(prev => prev === index ? null : index);
                                      }}
                                    >
                                      +{tags.length - 1}
                                    </button>
                                  )}
                                  {tags.length > 1 && activeTagsIndex === index && (
                                    <div
                                      ref={popoverRef}
                                      className="absolute z-50 left-0 top-full mt-2 bg-white border rounded-lg shadow-lg p-2 flex flex-wrap gap-1"
                                      style={{ minWidth: "120px" }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {tags.map((t, i) => (
                                        <span
                                          key={t + i}
                                          className="px-3 py-1 rounded-full text-xs font-semibold border"
                                          style={{
                                            background: getColorFromString(
                                              t,
                                              0.18,
                                              55
                                            ),
                                            color: getDarkerColorFromString(t, 1, 30),
                                          }}
                                          title={t}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : col.key === "AccountId" ? (
                            (() => {
                              const accId = getField(contact, "AccountId") ?? getField(contact, "accountId");
                              const cacheVal = accId != null ? accountNameCache[String(accId)] : undefined;
                              let display;
                              if (accId == null) {
                                display = "-";
                              } else if (typeof cacheVal === "string" && cacheVal) {
                                display = cacheVal;
                              } else if (cacheVal === null) {
                                // fetch attempted but no name found
                                display = "Account not found";
                              } else {
                                // not yet fetched; try a quick lookup in accountsList as fallback
                                const acct = accountsList.find(
                                  (a) => String(a.AccountId ?? a.accountId ?? a.Id ?? a.id) === String(accId)
                                );
                                if (acct && (acct.Name || acct.name)) display = acct.Name ?? acct.name;
                                else display = "Loading...";
                              }
                              return (
                                <span className={col.key === "score" ? "font-semibold text-gray-900" : ""}>
                                  {highlightMatch && typeof display === "string"
                                    ? highlightMatch(display, search)
                                    : display}
                                </span>
                              );
                            })()
                          ) : (
                            <span
                              className={col.key === "score" ? "font-semibold text-gray-900" : ""}
                            >
                              {highlightMatch && typeof getField(contact, col.key) === "string"
                                ? highlightMatch(
                                  dateFields.has(col.key)
                                    ? formatDateOnly(getField(contact, col.key))
                                    : getField(contact, col.key),
                                  search
                                )
                                : dateFields.has(col.key)
                                  ? formatDateOnly(getField(contact, col.key))
                                  : getField(contact, col.key)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Modern SaaS-Style Pagination - Centered */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              {/* Left: Showing X-Y of Z */}
              <div className="text-sm text-gray-600 min-w-[150px]">
                <span className="font-medium">{Math.min(startIndex + 1, totalItems)}</span>-<span className="font-medium">{Math.min(endIndex, totalItems)}</span> of <span className="font-medium">{totalItems}</span>
              </div>


              {/* Center: Pagination Controls */}
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                {/* First/Prev - hidden on mobile */}
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1 || paginationLoading}
                  title="First page"
                  className="hidden sm:flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
                </button>

                <button
                  onClick={prevPage}
                  disabled={currentPage === 1 || paginationLoading}
                  title="Previous page"
                  className="flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>

                {/* Mobile: just "Page X of Y" */}
                <span className="sm:hidden px-3 py-1.5 rounded-lg bg-blue-200 text-black text-sm font-medium min-w-[80px] text-center">
                  {currentPage} / {totalPages}
                </span>

                {/* Desktop: full page number list */}
                <div className="hidden sm:flex items-center gap-1">
                  {(() => {
                    const maxVisible = 5;
                    const pages = [];
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                    if (endPage - startPage < maxVisible - 1) {
                      startPage = Math.max(1, endPage - maxVisible + 1);
                    }
                    if (startPage > 1) {
                      pages.push(
                        <button key={1} onClick={() => goToPage(1)} disabled={paginationLoading}
                          className="px-3 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 transition-all duration-200">1</button>
                      );
                      if (startPage > 2) pages.push(<span key="ellipsis-start" className="text-gray-400 px-2 font-medium">...</span>);
                    }
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button key={i} onClick={() => goToPage(i)} disabled={paginationLoading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${i === currentPage ? 'bg-blue-200 text-black shadow-sm' : 'bg-transparent text-gray-700 hover:bg-blue-100'
                            }`}>{i}</button>
                      );
                    }
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) pages.push(<span key="ellipsis-end" className="text-gray-400 px-2 font-medium">...</span>);
                      pages.push(
                        <button key={totalPages} onClick={() => goToPage(totalPages)} disabled={paginationLoading}
                          className="px-3 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 transition-all duration-200">{totalPages}</button>
                      );
                    }
                    return pages;
                  })()}
                </div>

                <button
                  onClick={nextPage}
                  disabled={currentPage >= totalPages || paginationLoading}
                  title="Next page"
                  className="flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage >= totalPages || paginationLoading}
                  title="Last page"
                  className="hidden sm:flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" /></svg>
                </button>
              </div>

              {/* Right: Empty Space / Optional Loading Indicator */}
              <div className="min-w-[150px] flex justify-end">
                {paginationLoading && (
                  <span className="text-xs sm:text-sm text-blue-600 font-medium">Loading...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                <h4 className="text-xl font-semibold text-gray-900">Edit Contact</h4>
                <button
                  onClick={() => setIsEditing(false)}
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors duration-150"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form className="p-6 space-y-6" onSubmit={submitEdit}>
                {/* Core Identity */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-4">Core Identity</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-xs">First Name</label>
                      <input type="text" value={editForm.FirstName || ""} onChange={(e) => setEditForm({ ...editForm, FirstName: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-xs">Last Name</label>
                      <input type="text" value={editForm.LastName || ""} onChange={(e) => setEditForm({ ...editForm, LastName: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Job Title</label>
                      <input type="text" value={editForm.JobTitle || ""} onChange={(e) => setEditForm({ ...editForm, JobTitle: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {/* <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Enquiry No</label>
                    <input type="text" value={editForm.EnquiryNo || ""} onChange={(e) => setEditForm({ ...editForm, EnquiryNo: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div> */}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-4">Contact Information</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Work Email</label>
                      <input type="email" value={editForm.WorkEmail || ""} onChange={(e) => setEditForm({ ...editForm, WorkEmail: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Work Phone</label>
                      <input type="tel" value={editForm.WorkPhone || ""} onChange={(e) => setEditForm({ ...editForm, WorkPhone: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Mobile</label>
                      <input type="tel" value={editForm.Mobile || ""} onChange={(e) => setEditForm({ ...editForm, Mobile: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">LinkedIn</label>
                      <input type="text" value={editForm.LinkedIn || ""} onChange={(e) => setEditForm({ ...editForm, LinkedIn: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Facebook</label>
                      <input type="text" value={editForm.Facebook || ""} onChange={(e) => setEditForm({ ...editForm, Facebook: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Twitter</label>
                      <input type="text" value={editForm.Twitter || ""} onChange={(e) => setEditForm({ ...editForm, Twitter: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-4">Location</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Address</label>
                      <textarea value={editForm.Address || ""} onChange={(e) => setEditForm({ ...editForm, Address: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" rows="2" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Country</label>
                      <input type="text" value={editForm.Country || ""} onChange={(e) => setEditForm({ ...editForm, Country: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">State</label>
                      <input type="text" value={editForm.State || ""} onChange={(e) => setEditForm({ ...editForm, State: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">City</label>
                      <input type="text" value={editForm.City || ""} onChange={(e) => setEditForm({ ...editForm, City: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Zipcode</label>
                      <input type="text" value={editForm.Zipcode || ""} onChange={(e) => setEditForm({ ...editForm, Zipcode: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Time Zone</label>
                      <input type="text" value={editForm.TimeZone || ""} onChange={(e) => setEditForm({ ...editForm, TimeZone: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Business Association */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-4">Business Association</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* âŒ REMOVED: Account ID - Internal ID should not be editable
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Account ID</label>
                    <input type="number" value={editForm.AccountId || ""} onChange={(e) => setEditForm({...editForm, AccountId: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Account</label>
                      <input type="text" value={editForm.Account || ""} onChange={(e) => setEditForm({ ...editForm, Account: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {/* âŒ REMOVED: Sales Owner ID - Internal ID should not be editable
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Sales Owner ID</label>
                    <input type="number" value={editForm.SalesOwnerId || ""} onChange={(e) => setEditForm({...editForm, SalesOwnerId: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Sales Owner</label>
                      <input type="text" value={editForm.SalesOwner || ""} onChange={(e) => setEditForm({ ...editForm, SalesOwner: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Classification */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-4">Classification & Marketing</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Status</label>
                      <input type="text" value={editForm.Status || ""} onChange={(e) => setEditForm({ ...editForm, Status: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Life Cycle Stage</label>
                      <input type="text" value={editForm.LifeCycleStage || ""} onChange={(e) => setEditForm({ ...editForm, LifeCycleStage: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Territory</label>
                      <input type="text" value={editForm.Territory || ""} onChange={(e) => setEditForm({ ...editForm, Territory: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Source</label>
                      <input type="text" value={editForm.Source || ""} onChange={(e) => setEditForm({ ...editForm, Source: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Campaign</label>
                      <input type="text" value={editForm.Campaign || ""} onChange={(e) => setEditForm({ ...editForm, Campaign: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Customer Fit</label>
                      <input type="text" value={editForm.CustomerFit || ""} onChange={(e) => setEditForm({ ...editForm, CustomerFit: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Score</label>
                      <input type="number" value={editForm.Score || ""} onChange={(e) => setEditForm({ ...editForm, Score: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Subscription Status</label>
                      <input type="text" value={editForm.SubscriptionStatus || ""} onChange={(e) => setEditForm({ ...editForm, SubscriptionStatus: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Tags</label>
                      <input type="text" value={editForm.Tags || ""} onChange={(e) => setEditForm({ ...editForm, Tags: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Activity */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-4">Activity</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Last Activity Type</label>
                      <input type="text" value={editForm.LastActivityType || ""} onChange={(e) => setEditForm({ ...editForm, LastActivityType: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {/* âŒ REMOVED: Last Activity Date - System-managed date should not be editable
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Last Activity Date</label>
                    <input type="date" value={editForm.LastActivityDate || ""} onChange={(e) => setEditForm({...editForm, LastActivityDate: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  */}
                    {/* âŒ REMOVED: Last Contacted Time - System-managed date should not be editable
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Last Contacted Time</label>
                    <input type="datetime-local" value={editForm.LastContactedTime || ""} onChange={(e) => setEditForm({...editForm, LastContactedTime: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Last Contacted Mode</label>
                      <input type="text" value={editForm.LastContactedMode || ""} onChange={(e) => setEditForm({ ...editForm, LastContactedMode: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="font-medium text-gray-700 text-sm">Recent Note</label>
                      <textarea value={editForm.RecentNote || ""} onChange={(e) => setEditForm({ ...editForm, RecentNote: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" rows="2" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-all"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      {/* Contact Details Slide-in Popup */}
      {(detailsLoading || detailsError || selectedContactDetails) && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={handleCloseContactDetails} />
          <div className="fixed right-0 top-0 h-full w-[60%] bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-gray-200 animate-in slide-in-from-right duration-300 text-sm">
            {/* Header */}
            <div className="flex items-center gap-5 p-4  bg-white/80 backdrop-blur-sm">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-semibold text-3xl shadow-xl transform hover:scale-105 transition-transform duration-200"
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                  color: "white",
                }}
              >
                {selectedContactDetails
                  ? `${selectedContactDetails.FirstName || selectedContactDetails.firstName || ''} ${selectedContactDetails.LastName || selectedContactDetails.lastName || ''}`.trim().charAt(0).toUpperCase() || 'C'
                  : "C"}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="font-normal text-gray-900 text-lg">
                  {selectedContactDetails
                    ? `${selectedContactDetails.FirstName || selectedContactDetails.firstName || ''} ${selectedContactDetails.LastName || selectedContactDetails.lastName || ''}`.trim() || "Contact"
                    : "Contact"}
                </div>
                <div className="text-gray-600 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  {(() => {
                    const emails = selectedContactDetails?.Emails || selectedContactDetails?.emails || "";
                    if (emails) {
                      // If Emails contains multiple addresses (comma or semicolon separated), show first one
                      const firstEmail = typeof emails === "string" ? emails.split(/[,;]/)[0].trim() : String(emails);
                      return firstEmail || "No email";
                    }
                    // Fallback to individual email fields
                    return selectedContactDetails?.WorkEmail || selectedContactDetails?.workEmail || selectedContactDetails?.Email || selectedContactDetails?.email || "No email";
                  })()}
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200"
                onClick={handleCloseContactDetails}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Secondary header row for actions */}
            {selectedContactDetails && (
              <div className="flex items-center gap-4 px-3 py-2 border-b border-b-gray-200 bg-white">

                <div className="text-sm font-semibold text-gray-700">
                  Enquiry No:
                  <span className="ml-1 text-blue-600">
                    {selectedContactDetails?.EnquiryNo ||
                      selectedContactDetails?.enquiryNo ||
                      "-"}
                  </span>
                </div>


                <div className="flex-1" />
                <button
                  className={`flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-5 py-2 rounded-md text-sm transition-all duration-200 w-full sm:w-auto
                  ${showEmailLogs
                      ? "bg-gray-700 text-white"
                      : "bg-gray-600 text-white hover:bg-gray-700"
                    }`}
                  onClick={() => {
                    setShowEmailLogs((v) => {
                      if (!v) setActiveLogTab("email");
                      return !v;
                    });
                  }}
                  type="button"
                  title="View Email and Call Logs"
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span>Conversations</span>
                </button>

                {/* Business Card Button - Only show if contact has images */}
                {(selectedContactDetails?.FrontImage || selectedContactDetails?.frontImage || selectedContactDetails?.BackImage || selectedContactDetails?.backImage) && (
                  <button
                    className={`flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-5 py-2 rounded-md text-sm transition-all duration-200 w-full sm:w-auto
                    ${showBusinessCard
                        ? "bg-blue-700 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    onClick={async () => {
                      if (!showBusinessCard) {
                        setBusinessCardSide("front");
                        setBusinessCardZoom(1);
                        setBusinessCardLoading(true);
                        try {
                          const contactId = selectedContactDetails?.ContactId || selectedContactDetails?.contactId;
                          const frontRes = await apiClient.get(`/contact/${contactId}/image/front`, { responseType: 'arraybuffer' });
                          const backRes = await apiClient.get(`/contact/${contactId}/image/back`, { responseType: 'arraybuffer' }).catch(() => null);

                          const frontImageUrl = frontRes?.data ? URL.createObjectURL(new Blob([frontRes.data], { type: 'image/jpeg' })) : null;
                          const backImageUrl = backRes?.data ? URL.createObjectURL(new Blob([backRes.data], { type: 'image/jpeg' })) : null;

                          setBusinessCardImages({
                            front: frontImageUrl,
                            back: backImageUrl,
                          });
                        } catch (err) {
                          console.error('Error fetching business card images:', err);
                          onToast?.('Failed to load business card images', 'error');
                          setBusinessCardImages({ front: null, back: null });
                        } finally {
                          setBusinessCardLoading(false);
                        }
                      }
                      setShowBusinessCard((v) => !v);
                    }}
                    type="button"
                    title="View Business Card"
                    disabled={businessCardLoading}
                  >
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 9H3v6h12V9z M3 9l1.05-3h16.9L21 9m-18 6h18v3H3v-3z"
                      />
                    </svg>
                    <span>Business Card</span>
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-8 visible-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Show conversations only if toggled, otherwise show form */}
              {showEmailLogs && selectedContactDetails ? (
                <div className="mb-8">
                  {/* Tabs for Email and Call Logs */}
                  <div className="flex border-b border-gray-200 mb-4">
                    <button
                      className={`px-6 py-2 font-medium text-sm border-b-2 transition-colors duration-150 ${activeLogTab === "email"
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-gray-500 hover:text-blue-600"
                        }`}
                      onClick={() => setActiveLogTab("email")}
                    >
                      Email Logs
                    </button>
                    <button
                      className={`px-6 py-2 font-medium text-sm border-b-2 transition-colors duration-150 ${activeLogTab === "call"
                        ? "border-green-600 text-green-700"
                        : "border-transparent text-gray-500 hover:text-green-600"
                        }`}
                      onClick={() => setActiveLogTab("call")}
                    >
                      Call Logs
                    </button>
                  </div>
                  <ContactEmailLogs
                    contactEmail={
                      selectedContactDetails.WorkEmail ||
                      selectedContactDetails.workEmail ||
                      selectedContactDetails.Email ||
                      ""
                    }
                    contactEmails={extractUniqueEmails(
                      selectedContactDetails.WorkEmail,
                      selectedContactDetails.workEmail,
                      selectedContactDetails.Email,
                      selectedContactDetails.email,
                      selectedContactDetails.Emails,
                      selectedContactDetails.emails,
                      selectedContactDetails.EmailIds,
                      selectedContactDetails.emailIds
                    )}

                    contactName={
                      selectedContactDetails.FirstName ||
                        selectedContactDetails.firstName ||
                        selectedContactDetails.LastName ||
                        selectedContactDetails.lastName
                        ? `${selectedContactDetails.FirstName || selectedContactDetails.firstName || ''} ${selectedContactDetails.LastName || selectedContactDetails.lastName || ''}`.trim()
                        : selectedContactDetails.FirstName || selectedContactDetails.firstName || "Unknown Contact"

                    }
                    accountName={
                      selectedContactDetails.Account ||
                      selectedContactDetails.account ||
                      ""
                    }
                    accountId={
                      selectedContactDetails.AccountId ||
                      selectedContactDetails.accountId
                    }
                    contactId={
                      selectedContactDetails.ContactId ||
                      selectedContactDetails.contactId
                    }
                    onClose={() => setShowEmailLogs(false)}
                  />

                </div>
              ) : (
                <form
                  className="space-y-8"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!selectedContactDetails) return;
                    try {
                      const q = slideAccountSearch.trim();
                      const curId =
                        getField(selectedContactDetails, "AccountId") ??
                        getField(selectedContactDetails, "accountId");
                      const curName = String(getField(selectedContactDetails, "Account") ?? "").trim();

                      let resolvedId = curId != null && curId !== "" ? Number(curId) : null;
                      if (resolvedId != null && (!Number.isFinite(resolvedId) || resolvedId <= 0)) {
                        resolvedId = null;
                      }
                      let resolvedName = curName;

                      if (q) {
                        const exact = accountsList.find(
                          (a) => String(a.Name ?? a.name ?? "").trim().toLowerCase() === q.toLowerCase()
                        );
                        if (exact) {
                          const id = exact.AccountId ?? exact.accountId ?? exact.Id ?? exact.id;
                          resolvedId = id != null ? Number(id) : null;
                          resolvedName = String(exact.Name ?? exact.name ?? "").trim();
                        } else {
                          resolvedName = q;
                          resolvedId = null;
                        }
                      } else {
                        resolvedId = null;
                        resolvedName = "";
                      }

                      if (resolvedId != null && (!Number.isFinite(resolvedId) || resolvedId <= 0)) {
                        resolvedId = null;
                      }

                      const updatedContactData = {
                        ...selectedContactDetails,
                        AccountId: resolvedId,
                        accountId: resolvedId,
                        Account: resolvedName,
                        account: resolvedName,
                        updatedBy:
                          auth?.getUser?.()?.name || localStorage.getItem("userName") || "Unknown",
                      };

                      const res = await fetch(
                        `/Contact/${encodeURIComponent(getField(selectedContactDetails, "ContactId") ?? getField(selectedContactDetails, "contactId") ?? selectedContactDetails.ContactId ?? selectedContactDetails.contactId)}`,
                        {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(updatedContactData),
                        }
                      );
                      if (res.ok) {
                        await refetch();
                        onToast &&
                          onToast("Contact updated successfully", "success");
                        handleCloseContactDetails();
                      } else {
                        onToast && onToast("Failed to update contact", "error");
                      }
                    } catch (err) {
                      onToast && onToast("Error updating contact", "error");
                    }
                  }}
                >


                  {detailsLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  )}

                  {detailsError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-red-700 font-normal">{detailsError}</p>
                    </div>
                  )}

                  {selectedContactDetails && (
                    <>
                      {/* Contact Information Section */}
                      <div className="bg-white rounded-2xl p-6   ">
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                          <h3 className="font-normal text-gray-900 text-lg">
                            Contact Information
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {[
                            ["AccountId", "Account"],
                            ["FirstName", "First Name"],
                            ["LastName", "Last Name"],
                            ["JobTitle", "Job Title"],
                            //["EnquiryNo", "Enquiry No"],
                            ["WorkEmail", "Work Email"],
                            ["WorkPhone", "Work Phone"],
                            ["Mobile", "Mobile"],
                            ["LinkedIn", "LinkedIn"],
                            ["Address", "Address"],
                          ].map(([key, label]) => (
                            <div className="flex flex-col gap-2" key={key}>
                              <label className="font-normal text-gray-700 text-sm">{label}</label>
                              {key === "AccountId" ? (
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Search account..."
                                    autoComplete="off"
                                    value={slideAccountSearch}
                                    onChange={(e) => {
                                      setSlideAccountSearch(e.target.value);
                                      setSlideAccountMenuOpen(true);
                                    }}
                                    onFocus={() => setSlideAccountMenuOpen(true)}
                                    onBlur={() => {
                                      setTimeout(() => setSlideAccountMenuOpen(false), 200);
                                    }}
                                    className="w-full rounded-xl px-4 py-3.5 pr-10 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                  />
                                  {(slideAccountSearch ||
                                    getField(selectedContactDetails, "AccountId") != null ||
                                    getField(selectedContactDetails, "accountId") != null) && (
                                      <button
                                        type="button"
                                        title="Clear account"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setSlideAccountSearch("");
                                          setSelectedContactDetails((prev) =>
                                            prev
                                              ? {
                                                ...prev,
                                                AccountId: null,
                                                accountId: null,
                                                Account: "",
                                                account: "",
                                              }
                                              : prev
                                          );
                                          setSlideAccountMenuOpen(false);
                                        }}
                                      >
                                        <span className="sr-only">Clear</span>
                                      </button>
                                    )}
                                  {slideAccountMenuOpen && (
                                    <div className="absolute top-[110%] left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                      {slideAccountSearchLoading ? (
                                        <div className="px-4 py-3 text-gray-500 text-sm">Searching accounts...</div>
                                      ) : slideAccountSearch.trim().length < 2 ? (
                                        <div className="px-4 py-3 text-gray-500 text-sm">Type at least 2 characters to search all accounts.</div>
                                      ) : (
                                        <>
                                          {accountsList
                                            .filter((a) => {
                                              const name = String(a.Name ?? a.name ?? "").toLowerCase();
                                              const q = slideAccountSearch.toLowerCase().trim();
                                              return !q || name.includes(q);
                                            })
                                            .slice(0, 80)
                                            .map((a) => {
                                              const id = a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
                                              const name = a?.Name ?? a?.name ?? String(id);
                                              return (
                                                <div
                                                  key={String(id)}
                                                  onMouseDown={() => {
                                                    setSelectedContactDetails((prev) =>
                                                      prev
                                                        ? {
                                                          ...prev,
                                                          AccountId: id,
                                                          accountId: id,
                                                          Account: name,
                                                          account: name,
                                                        }
                                                        : prev
                                                    );
                                                    setSlideAccountSearch(name);
                                                    setSlideAccountMenuOpen(false);
                                                  }}
                                                  className="px-4 py-3 cursor-pointer hover:bg-blue-50 hover:text-blue-700 text-sm border-b last:border-none"
                                                >
                                                  {name}
                                                </div>
                                              );
                                            })}
                                          {accountsList.filter((a) => {
                                            const name = String(a.Name ?? a.name ?? "").toLowerCase();
                                            const q = slideAccountSearch.toLowerCase().trim();
                                            return !q || name.includes(q);
                                          }).length === 0 && (
                                              <div className="px-4 py-3 text-gray-400 text-sm italic">No accounts found...</div>
                                            )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value })}
                                />
                              )}
                            </div>
                          ))}

                          {/* Country Dropdown */}
                          <div className="flex flex-col gap-2">
                            <label className="font-normal text-gray-700 text-sm">Country</label>
                            <select
                              className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                              value={getField(selectedContactDetails, "Country") || ""}
                              onChange={e => {
                                setSelectedContactDetails({ ...selectedContactDetails, Country: e.target.value, State: "", City: "" });
                                const found = countries.find(c => c.name === e.target.value);
                                setSlideCountryCode(found ? found.isoCode : "");
                                setSlideStateCode("");
                              }}
                            >
                              <option value="">Select Country</option>
                              {countries.map(c => (
                                <option key={c.isoCode} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* State Dropdown */}
                          <div className="flex flex-col gap-2">
                            <label className="font-normal text-gray-700 text-sm">State</label>
                            <select
                              className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                              value={getField(selectedContactDetails, "State") || ""}
                              onChange={e => {
                                setSelectedContactDetails({ ...selectedContactDetails, State: e.target.value, City: "" });
                                const found = slideStates.find(s => s.name === e.target.value);
                                setSlideStateCode(found ? found.isoCode : "");
                              }}
                              disabled={!slideCountryCode}
                            >
                              <option value="">Select State</option>
                              {slideStates.map(s => (
                                <option key={s.isoCode} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* City Dropdown */}
                          <div className="flex flex-col gap-2">
                            <label className="font-normal text-gray-700 text-sm">City</label>
                            <select
                              className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                              value={getField(selectedContactDetails, "City") || ""}
                              onChange={e => setSelectedContactDetails({ ...selectedContactDetails, City: e.target.value })}
                              disabled={!slideStateCode}
                            >
                              <option value="">Select City</option>
                              {slideCities.map(city => (
                                <option key={city.name} value={city.name}>{city.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Additional comprehensive fields - user-editable only */}
                          {[
                            ["Zipcode", "Zipcode"],
                            ["TimeZone", "Time Zone"],
                            ["Locale", "Locale"],
                            ["Phone", "Phone"],
                            ["Facebook", "Facebook"],
                            ["Twitter", "Twitter"],
                            ["SalesOwner", "Sales Owner"],
                            ["Status", "Status"],
                            ["LifeCycleStage", "Life Cycle Stage"],
                            ["Territory", "Territory"],
                            ["Source", "Source"],
                            ["Campaign", "Campaign"],
                            ["CustomerFit", "Customer Fit"],
                            ["Score", "Score"],
                            ["SubscriptionStatus", "Subscription Status"],
                            ["UnsubscribeReason", "Unsubscribe Reason"],
                            ["OtherUnsubscribeReasons", "Other Unsubscribe Reasons"],
                            ["WhatsAppSubscriptionStatus", "WhatsApp Subscription Status"],
                            ["SMSSubscriptionStatus", "SMS Subscription Status"],
                            ["Medium", "Medium"],
                            ["Keyword", "Keyword"],
                            ["LostReason", "Lost Reason"],
                            ["OriginalCampaign", "Original Campaign"],
                            ["OriginalMedium", "Original Medium"],
                            ["OriginalSource", "Original Source"],
                            ["CreatedThroughCampaign", "Created Through Campaign"],
                            ["CreatedFromMedium", "Created From Medium"],
                            ["CreatedFromSource", "Created From Source"],
                            ["MostRecentCampaign", "Most Recent Campaign"],
                            ["MostRecentMedium", "Most Recent Medium"],
                            ["MostRecentSource", "Most Recent Source"],
                            ["LastSeenOnChat", "Last Seen On Chat"],
                            ["FirstSeenOnChat", "First Seen On Chat"],
                            ["TotalChatSessions", "Total Chat Sessions"],
                            ["LastSeenOnWeb", "Last Seen On Web"],
                            ["LastActivityType", "Last Activity Type"],
                            ["LastActivityDate", "Last Activity Date"],
                            ["LastContactedMode", "Last Contacted Mode"],
                            ["LastContactedTime", "Last Contacted Time"],
                            ["LastAssignedAt", "Last Assigned At"],
                            ["RecentNote", "Recent Note"],
                            ["Tags", "Tags"],
                            ["ExternalID", "External ID"],
                            ["WebForms", "Web Forms"],
                            ["ImportID", "Import ID"],
                            ["ActiveSalesSequences", "Active Sales Sequences"],
                            ["CompletedSalesSequences", "Completed Sales Sequences"],
                            ["Emails", "Emails"],
                            ["LinkedIn", "LinkedIn"],
                            ["UpdatedAt", "Updated At"],
                            ["CreatedAt", "Created At"],
                            ["CreatedBy", "Created By"],
                            ["UpdatedBy", "Updated By"],
                          ].map(([key, label]) => (
                            <div className="flex flex-col gap-2" key={key}>
                              <label className="font-normal text-gray-700 text-sm">{label}</label>
                              {key === "Tags" || key === "RecentNote" || key === "OtherUnsubscribeReasons" || key === "WebForms" ? (
                                <textarea
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 resize-none"
                                  rows="2"
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value })}
                                />
                              ) : key === "Score" || key === "TotalChatSessions" || key === "ActiveSalesSequences" || key === "CompletedSalesSequences" ? (
                                <input
                                  type="number"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value ? Number(e.target.value) : null })}
                                />
                              ) : key === "WorkPhone" || key === "Mobile" || key === "Phone" ? (
                                <input
                                  type="tel"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value })}
                                />
                              ) : key === "WorkEmail" ? (
                                <input
                                  type="email"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value })}
                                />
                              ) : key === "Facebook" || key === "Twitter" || key === "LinkedIn" ? (
                                <input
                                  type="url"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  placeholder="https://..."
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value })}
                                />
                              ) : key === "LastActivityDate" ? (
                                <input
                                  type="date"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={formatDateOnly(getField(selectedContactDetails, key))}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                                />
                              ) : key === "LastContactedTime" || key === "LastAssignedAt" || key === "LastSeenOnChat" || key === "FirstSeenOnChat" || key === "LastSeenOnWeb" || key === "CreatedAt" || key === "UpdatedAt" ? (
                                <input
                                  type="date"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={formatDateOnly(getField(selectedContactDetails, key))}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                                />
                              ) : (
                                <input
                                  type="text"
                                  className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                  value={getField(selectedContactDetails, key) || ""}
                                  onChange={e => setSelectedContactDetails({ ...selectedContactDetails, [key]: e.target.value })}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </>
                  )}

                  {/* Footer Actions */}
                  <div className="flex justify-between items-center gap-3 pt-6 border-t-2 border-gray-200 mt-8 bg-white/50 backdrop-blur-sm rounded-xl p-6 -mx-2">
                    {isAdminOnly && (
                      <button
                        type="button"
                        className="px-5 py-3 rounded-xl border-2 border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-600 font-normal transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                        onClick={() => {
                          if (!selectedContactDetails) return;
                          const rawId = getField(selectedContactDetails, "ContactId") ?? getField(selectedContactDetails, "contactId") ?? selectedContactDetails.id;
                          const idx = sortedData.findIndex((a) => String(getField(a, "ContactId")) === String(rawId));
                          const sortedIdx = (sortedData || []).findIndex((s) => String(getField(s, "ContactId")) === String(rawId));
                          if (sortedIdx !== -1) {
                            setSelected(new Set([sortedIdx]));
                            setDeleteCount(1);
                            setShowDeleteModal(true);
                            onToast?.("Delete 1 contact selected", "info");
                          } else if (idx !== -1) {
                            // fallback: select using data index if sorted index not found
                            setSelected(new Set([idx]));
                            setDeleteCount(1);
                            setShowDeleteModal(true);
                            onToast?.("Delete 1 contact selected (fallback)", "info");
                          } else {
                            onToast?.("Contact not found", "error");
                          }
                        }}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete Contact
                      </button>
                    )}
                    {canEditContact(selectedContactDetails) ? (
                      <button
                        type="submit"
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-normal shadow-sm hover:shadow-xl transition-all duration-200 flex items-center gap-2 transform hover:scale-105 ml-auto"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400 ml-auto italic">View-only - you can only edit contacts you created.</p>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Contacts;