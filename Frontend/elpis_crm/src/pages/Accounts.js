﻿// Accounts component
import React, { useMemo, useState, useEffect, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import apiClient from "../api/client";
import AuthContext from "../auth/AuthContext";
import { FiTrash2 } from "react-icons/fi";
import { exportTableToExcel } from "../utils/excelExport";
import { Country, State, City } from "country-state-city";
import { useServerPagination } from "../hooks/useServerPagination";
import { LAZY_LOADING_CONFIG } from "../config/lazyLoadingConfig";
import SearchBar from "../utils/SearchBar";
import { useSearchParams } from "react-router-dom";

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

const fetch = fetchApi;


// API base is provided by `src/api/client.js`

// get initials from name
function getInitials(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

//  get a color from a string for the circle background
function getColorFromString(str, alpha = 0.35, lightness = 85) {
  if (!str) {
    return `hsla(210, 70%, 90%, ${alpha})`;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
}
// get a darker color from a string for the circle text
function getDarkerColorFromString(str, alpha = 1, lightness = 45) {
  if (!str) {
    return `hsla(210, 70%, 45%, ${alpha})`;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
}

// format a value as date-only (YYYY-MM-DD) using local timezone
function formatDateOnly(val) {
  if (val === null || val === undefined || val === "") return "";
  // If it's a number (epoch ms) convert
  const date = new Date(val);
  if (isNaN(date.getTime())) return String(val);
  // Use local date, not UTC date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateNum = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dateNum}`;
}

// fields that should render as date-only in the slide-in
const dateFields = new Set(["LastContactedTime", "CreatedAt", "UpdatedAt", "LastActivityDate", "LastAssignedAt"]);

function Accounts({
  accounts,
  filters,
  onToast,
  onRefetch,
  onRefetchReady,
  contacts: allContactsProp,
  selectedColumns,
  highlightMatch,
  search,
  externalSearch,
  searchHighlight,
  onSearchHighlightDone,
}) {

  console.log("[Accounts] Component received props:", { filters, search, onRefetchReady: typeof onRefetchReady });

  // Get user role from AuthContext
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const userName = auth?.getUserName?.() || localStorage.getItem("userName") || "";
  const isAdmin = ["Admin", "admin", "Manager", "manager"].includes(userRole);
  const isAdminOnly = ["Admin", "admin"].includes(userRole); // for delete actions

  // Can edit = admin/manager OR the user created the record
  const canEditAccount = (account) => {
    if (!account) return false;
    if (isAdmin) return true;
    const creator = account.CreatedBy || account.createdBy || "";
    return creator !== "" && creator === userName;
  };

  // Define all possible columns for the accounts table
  const allColumns = useMemo(
    () => [
      // Core Identity
      { key: "Name", label: "Name" },
      { key: "RelatedContacts", label: "Related Contacts" },
      { key: "IndustryType", label: "Industry Type" },
      { key: "BusinessType", label: "Business Type" },
      // Location
      { key: "Country", label: "Country" },
      { key: "State", label: "State" },
      { key: "City", label: "City" },
      { key: "Zipcode", label: "Zipcode" },
      { key: "Address", label: "Address" },
      // Business Info
      { key: "Website", label: "Website" },
      { key: "Phone", label: "Phone" },
      { key: "DisplayPhone", label: "Display Phone" },
      { key: "Territory", label: "Territory" },
      { key: "NumberOfEmployees", label: "Number of Employees" },
      { key: "AnnualRevenue", label: "Annual Revenue" },
      // Ownership
      { key: "SalesOwner", label: "Sales Owner" },
      // { key: "SalesOwnerId", label: "Sales Owner ID" }, // âŒ HIDDEN - Internal ID should not be visible
      { key: "ParentAccount", label: "Parent Account" },
      // { key: "ParentAccountId", label: "Parent Account ID" }, // âŒ HIDDEN - Internal ID should not be visible
      // Social Media
      { key: "Facebook", label: "Facebook" },
      { key: "Twitter", label: "Twitter" },
      { key: "LinkedIn", label: "LinkedIn" },
      // Activity
      { key: "LastContactedMode", label: "Last Contacted Mode" },
      { key: "LastContactedTime", label: "Last Contacted Time" },
      { key: "LastActivityType", label: "Last Activity Type" },
      { key: "LastActivityDate", label: "Last Activity Date" },
      { key: "RecentNote", label: "Recent Note" },
      { key: "LastAssignedAt", label: "Last Assigned At" },
      // Sequences
      { key: "ActiveSalesSequences", label: "Active Sales Sequences" },
      { key: "CompletedSalesSequences", label: "Completed Sales Sequences" },
      // Metadata
      { key: "Tags", label: "Tags" },
      { key: "ImportID", label: "Import ID" },
      // System
      { key: "CreatedAt", label: "Created At" },
      { key: "UpdatedAt", label: "Updated At" },
      { key: "CreatedBy", label: "Created By" },
      { key: "UpdatedBy", label: "Updated By" },
    ],
    []
  );

  // Filter columns based on selectedColumns prop (if provided)
  const columns = useMemo(
    () =>
      Array.isArray(selectedColumns) && selectedColumns.length > 0
        ? allColumns.filter((col) => selectedColumns.includes(col.key))
        : allColumns,
    [allColumns, selectedColumns]
  );

  // State for sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [localSearch, setLocalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Log when filters prop changes
  useEffect(() => {
    console.log("[Accounts] Filters prop changed:", filters);
  }, [filters]);

  // NOTE: externalSearch (global header bar) is intentionally NOT synced into
  // localSearch.  The header search drives the global dropdown only; the
  // per-table SearchBar below drives its own server-side filter.  Syncing the
  // two caused a duplicate /Account request on every keystroke in the header.

  // Debounce search - wait 400ms after user stops typing before fetching
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 250);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Server-side pagination hook - fetch accounts in pages
  const fetchAccountsPage = React.useCallback(async (page, pageSize) => {
    try {
      const normalizedSearch = debouncedSearch.trim();
      const tagFilter = (filters || []).find(f => String(f.field).toLowerCase().includes('tag'));
      if (tagFilter && tagFilter.value) {
        const tagValue = Array.isArray(tagFilter.value) ? tagFilter.value.join(',') : String(tagFilter.value);
        const res = await fetch(`/Account/tags/accounts?tags=${encodeURIComponent(tagValue)}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        const items = Array.isArray(json) ? json : [];
        return { items, totalCount: items.length };
      }
      // Always use server-side paged search - fast for both empty and non-empty queries
      const searchParam = normalizedSearch ? `&search=${encodeURIComponent(normalizedSearch)}` : '';
      const res = await fetch(`/Account?page=${page}&pageSize=${pageSize}${searchParam}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      return {
        items: Array.isArray(json.items) ? json.items : [],
        totalCount: json.totalCount || 0,
      };
    } catch (err) {
      console.error('Error fetching paginated accounts:', err);
      return { items: [], totalCount: 0 };
    }
  }, [filters, debouncedSearch]);

  const {
    data: paginatedAccounts,
    currentPage,
    totalItems,
    totalPages,
    loading: paginationLoading,
    goToPage,
    nextPage,
    prevPage,
    clearCache
  } = useServerPagination(fetchAccountsPage, LAZY_LOADING_CONFIG.PAGE_SIZE);

  // helper to read fields with case-insensitive fallback
  const getField = (obj, key) => {
    if (!obj) return undefined;
    if (key in obj) return obj[key];
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    if (lower in obj) return obj[lower];
    const alt = key.toLowerCase();
    return obj[alt];
  };

  // Sort data directly from paginatedAccounts to reduce state updates
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return paginatedAccounts;
    const sorted = [...paginatedAccounts].sort((a, b) => {
      const aVal = getField(a, sortConfig.key) ?? "";
      const bVal = getField(b, sortConfig.key) ?? "";
      // Numeric sort if both are numbers
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
      // String sort
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [paginatedAccounts, sortConfig]);

  // Data is already paginated from server - no need to recalculate
  const paginatedData = sortedData;

  // State for selected rows, table data, and editing
  const [selected, setSelected] = useState(() => new Set());
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [activeTagsIndex, setActiveTagsIndex] = useState(null);
  const popoverRef = React.useRef(null);

  // Auto-open account from search highlight
  useEffect(() => {
    if (!searchHighlight || searchHighlight.type !== "account" || !searchHighlight.id) return;
    handleShowAccountDetails(searchHighlight.id);
    if (typeof onSearchHighlightDone === "function") onSearchHighlightDone();
    // eslint-disable-next-line
  }, [searchHighlight]);

  // State for table data and editing
  // Load first page on mount
  useEffect(() => {
    goToPage(1);
  }, [goToPage]);

  // Reload accounts when filters or search changes
  useEffect(() => {
    clearCache();
    goToPage(1);
  }, [filters, debouncedSearch, goToPage, clearCache]);

  // Fetch contacts for visible accounts
  useEffect(() => {
    console.log('Fetching contacts for visible accounts:', paginatedData.length);
    paginatedData.forEach((account) => {
      const accountId = getField(account, "AccountId") ?? getField(account, "accountId");
      console.log('Account ID:', accountId);
      if (accountId && !contactsCache.has(accountId) && !contactsLoading.has(accountId)) {
        fetchContactsForAccount(accountId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedData]);

  // Refetch when an import completes for Accounts
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail?.table || e.detail.table === "Accounts") {
        clearCache();
        goToPage(1);
      }
    };
    window.addEventListener("importComplete", handler);
    return () => window.removeEventListener("importComplete", handler);
  }, [clearCache, goToPage]);

  // Refetch when an account is added
  useEffect(() => {
    const handler = () => {
      clearCache();
      goToPage(1);
    };
    window.addEventListener("accountAdded", handler);
    return () => window.removeEventListener("accountAdded", handler);
  }, [clearCache, goToPage]);

  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({
    AccountId: "",
    Name: "",
    Country: "",
    State: "",
    City: "",
    Zipcode: "",
    Address: "",
    IndustryType: "",
    BusinessType: "",
    Territory: "",
    Website: "",
    Phone: "",
    DisplayPhone: "",
    NumberOfEmployees: "",
    AnnualRevenue: "",
    SalesOwnerId: "",                               // Numeric ID field
    SalesOwner: "",                                 // Display name field
    ParentAccountId: "",                            // Numeric ID field
    ParentAccount: "",                              // Display name field
    Facebook: "",
    Twitter: "",
    LinkedIn: "",
    LastContactedMode: "",
    LastContactedTime: "",
    LastActivityType: "",
    LastActivityDate: "",
    RecentNote: "",
    LastAssignedAt: "",
    ActiveSalesSequences: "",
    CompletedSalesSequences: "",
    CreatedAt: "",
    UpdatedAt: "",
    CreatedBy: "",
    UpdatedBy: "",
  });

  // State for selected rows, table data, and editing
  const [selectedAccountDetails, setSelectedAccountDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // Cache for contacts per account to avoid repeated API calls
  const [contactsCache, setContactsCache] = useState(new Map());
  const [contactsLoading, setContactsLoading] = useState(new Set());

  useEffect(() => {
    if (!selectedAccountDetails) return;
    const accountId =
      getField(selectedAccountDetails, "AccountId") ??
      getField(selectedAccountDetails, "accountId");
    if (!accountId) return;
    if (!contactsCache.has(accountId) && !contactsLoading.has(accountId)) {
      fetchContactsForAccount(accountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountDetails]);

  const [expandedRelatedContacts, setExpandedRelatedContacts] = useState(null);
  const expandButtonRef = useRef(null);
  const panelRef = useRef(null);
  const [relatedContactsPortalCoords, setRelatedContactsPortalCoords] = useState(null);

  // Country/State/City for slide-in
  const [slideCountryCode, setSlideCountryCode] = useState("");
  const [slideStateCode, setSlideStateCode] = useState("");

  // Get all countries
  const countries = Country.getAllCountries();
  // States and cities for slide-in
  const slideStates = useMemo(() => slideCountryCode ? State.getStatesOfCountry(slideCountryCode) : [], [slideCountryCode]);
  const slideCities = slideCountryCode && slideStateCode ? City.getCitiesOfState(slideCountryCode, slideStateCode) : [];

  // When selectedAccountDetails.Country changes, update slideCountryCode
  useEffect(() => {
    if (!selectedAccountDetails) return;
    const countryName = getField(selectedAccountDetails, "Country");
    if (!countryName) {
      setSlideCountryCode("");
      return;
    }
    const found = countries.find(c => c.name === countryName);
    setSlideCountryCode(found ? found.isoCode : "");
  }, [selectedAccountDetails, countries]);

  // When selectedAccountDetails.State changes, update slideStateCode
  useEffect(() => {
    if (!selectedAccountDetails) return;
    const stateName = getField(selectedAccountDetails, "State");
    if (!stateName || !slideCountryCode) {
      setSlideStateCode("");
      return;
    }
    const found = slideStates.find(s => s.name === stateName);
    setSlideStateCode(found ? found.isoCode : "");
  }, [selectedAccountDetails, slideCountryCode, slideStates]);

  useEffect(() => {
    if (!expandedRelatedContacts || !expandButtonRef.current) {
      setRelatedContactsPortalCoords(null);
      return;
    }

    const updatePosition = () => {
      const button = expandButtonRef.current;
      if (!button) {
        setRelatedContactsPortalCoords(null);
        return;
      }
      const rect = button.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const maxLeft = Math.max(8, Math.min(rect.left, viewportWidth - 340));
      setRelatedContactsPortalCoords({
        top: rect.bottom + window.scrollY,
        left: maxLeft + window.scrollX,
      });
    };

    const handleScroll = () => {
      setExpandedRelatedContacts(null);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [expandedRelatedContacts]);

  useEffect(() => {
    if (!expandedRelatedContacts) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      if (!target) return;
      if (expandButtonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setExpandedRelatedContacts(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedRelatedContacts]);

  // Validation helpers
  const isValidURL = (v) => {
    if (!v) return false;
    try {
      const u = new URL(String(v));
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      // If the value lacks a scheme but looks like a domain, try with http://
      try {
        const u2 = new URL("http://" + String(v));
        return u2.protocol === "http:" || u2.protocol === "https:";
      } catch (e2) {
        return false;
      }
    }
  };

  const normalizeUrl = (v) => {
    if (!v) return v;
    try {
      const u = new URL(String(v));
      return u.toString();
    } catch (e) {
      try {
        const prefixed = "http://" + String(v);
        const u2 = new URL(prefixed);
        return u2.toString();
      } catch (e2) {
        return v;
      }
    }
  };
  const isNumeric = (v) => {
    if (v === null || v === undefined || v === "") return false;
    return !isNaN(Number(String(v).replace(/,/g, "")));
  };

  // Handler to show account details in slide-in
  const handleShowAccountDetails = React.useCallback(async (accountId) => {
    if (!accountId && accountId !== 0) return;
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedAccountDetails(null);
    try {
      const res = await fetch(`/Account/${encodeURIComponent(accountId)}`);
      if (!res.ok) {
        setDetailsError(`Failed to load details: ${res.status}`);
        return;
      }
      const data = await res.json();
      setSelectedAccountDetails(data);
    } catch (err) {
      setDetailsError("Error fetching account details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleCloseAccountDetails = () => {
    setSelectedAccountDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  // Handle opening account from query parameter
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const queryAccountId = searchParams.get('id');
    if (queryAccountId) {
      handleShowAccountDetails(queryAccountId);
    }
  }, [searchParams, handleShowAccountDetails]);

  // Fetch contacts for a specific account (with caching)
  const fetchContactsForAccount = async (accountId) => {
    if (!accountId || contactsCache.has(accountId)) return contactsCache.get(accountId) || [];

    if (contactsLoading.has(accountId)) return []; // Already loading

    setContactsLoading(prev => new Set(prev).add(accountId));

    try {
      const res = await fetch(`/Contact/account/${encodeURIComponent(accountId)}`);
      if (!res.ok) return [];
      const contacts = await res.json();
      console.log('Fetched contacts for account', accountId, contacts);
      setContactsCache(prev => new Map(prev).set(accountId, contacts));
      return contacts;
    } catch (err) {
      console.error('Error fetching contacts for account:', err);
      return [];
    } finally {
      setContactsLoading(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  // Handle clicking on a contact to show its details
  const handleShowContactDetails = (contactId) => {
    // Dispatch custom event to dashboard to show contact
    window.dispatchEvent(new CustomEvent('showContact', { detail: { contactId } }));
  };

  // State for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [deleteAccountName, setDeleteAccountName] = useState('');

  // Update data when filtered accounts change
  useEffect(() => {
    console.debug("[Accounts] received accounts prop", { count: (accounts || []).length, sample: (accounts || []).slice(0, 3) });
    // Don't update data here - let the filteredAccounts useEffect handle it
  }, [accounts]);
  // Determine if all or some rows are selected
  const allSelected = sortedData.length > 0 && selected.size === sortedData.length;
  const someSelected = selected.size > 0 && !allSelected;

  // Toggle all rows
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedData.map((_, idx) => idx)));
    }
  };

  // Toggle a single row
  const toggleRow = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Sort handler
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };
  // Export selected rows to Excel
  const exportCsv = () => {
    try {
      exportTableToExcel({
        data: sortedData,
        selected,
        columns,
        title: "Accounts Export",
        filename: "accounts_export.xlsx",
        getField,
      });
      onToast && onToast(`Exported ${selected.size} accounts to Excel`, "success");
    } catch (error) {
      onToast && onToast("Failed to export accounts", "error");
      console.error("Export error:", error);
    }
  };
  // Export all accounts using backend export API
  const exportAllCsv = async () => {
    if (isExportingAll) return;
    setIsExportingAll(true);
    try {
      const tagFilter = (filters || []).find((f) => String(f.field).toLowerCase().includes("tag"));
      const selectedTag = tagFilter && tagFilter.value
        ? Array.isArray(tagFilter.value)
          ? tagFilter.value.join(",")
          : String(tagFilter.value)
        : "";
      const payload = {
        search: localSearch || "",
        tag: selectedTag || "",
        columns: selectedColumns || [],
      };
      const response = await apiClient.post("/export/accounts", payload, {
        responseType: "blob",
      });

      if (!response || !response.data) {
        throw new Error("Invalid export response");
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "accounts.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onToast && onToast("Export download started", "success");
    } catch (error) {
      onToast && onToast("Failed to export all accounts", "error");
      console.error("Export all error:", error);
    } finally {
      setIsExportingAll(false);
    }
  };
  // Refetch data from API - reload current page
  const refetch = React.useCallback(async () => {
    clearCache();
    goToPage(currentPage);
    // Notify parent to refresh its list
    try { onRefetch?.(); } catch (_) { }
  }, [goToPage, currentPage, onRefetch, clearCache]);

  // Allow parent/dashboard/header to trigger this component refresh
  // Disabled infinite refetch loop
  // React.useEffect(() => {
  //   if (typeof onRefetchReady === "function") {
  //     onRefetchReady(refetch);
  //   }
  // }, [onRefetchReady, refetch]);
  // Delete selected rows
  
  const handleDeleteClick = () => {
    const selectedRows = Array.from(selected);
    const ids = selectedRows.map((idx) => getField(sortedData[idx], "AccountId") ?? getField(sortedData[idx], "accountId")).filter((v) => v !== undefined && v !== null);
    if (ids.length === 0) return;
    setDeleteCount(ids.length);
    const _names = selectedRows.map((idx) => getField(sortedData[idx], 'Name') || 'Account'); setDeleteAccountName(_names.join(', '));
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const selectedRows = Array.from(selected);
    // selected stores absoluteIndex values; map back to page-relative index
    const ids = selectedRows
      .map((absIdx) => {
        const pageRelIdx = absIdx - startIndex;
        const row = sortedData[pageRelIdx];
        return row ? (getField(row, "AccountId") ?? getField(row, "accountId")) : null;
      })
      .filter((v) => v !== undefined && v !== null);
    setShowDeleteModal(false);
    if (ids.length === 0) return;
    try {
      // Use efficient bulk delete endpoint with POST body (supports unlimited IDs)
      const res = await fetch(`/Account/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);

      clearCache();
      await refetch();
      setSelected(new Set());
      onToast && onToast(`Deleted ${ids.length} accounts`, "success");
      // close slide-in details if open
      try { handleCloseAccountDetails(); } catch (e) { /* ignore */ }
    } catch (e) {
      onToast && onToast("Failed to delete accounts", "error");
    }
  };
  // Update a row
  const updateRow = async (index, updated) => {
    const row = sortedData[index];
    const id = getField(row, "AccountId") ?? getField(row, "accountId");
    if (id === undefined || id === null) return;
    try {
      const res = await fetch(`/Account/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Update failed");
      await refetch();
      onToast && onToast("Account updated", "success");
      try { onRefetch?.(); } catch (_) { }
    } catch (e) {
      onToast && onToast("Failed to update", "error");
    }
  };
  // Note: Edit functionality is handled via row selection and edit modal

  const submitEdit = async (e) => {
    e.preventDefault();
    // Basic validations for edit modal
    const websiteVal = editForm.website || editForm.Website || "";
    const openDealsVal = editForm.openDealsAmount || editForm.OpenDealsAmount || "";
    if (websiteVal && websiteVal.trim() !== "" && !isValidURL(websiteVal)) {
      onToast && onToast("Website must be a valid URL (include http/https)", "error");
      return;
    }
    if (openDealsVal && openDealsVal !== "" && !isNumeric(openDealsVal)) {
      onToast && onToast("Open Deals Amount must be numeric", "error");
      return;
    }
    const payload = { ...editForm };
    // normalize website to include scheme when possible (e.g., add http:// for www.example.com)
    const rawWebsite = payload.Website || payload.website || "";
    if (rawWebsite && rawWebsite.trim() !== "") {
      const norm = normalizeUrl(rawWebsite.trim());
      payload.Website = norm;
      payload.website = norm;
    }
    await updateRow(editIndex, payload);
    setIsEditing(false);
    setEditIndex(null);
  };
  // Pagination info comes from useServerPagination hook (currentPage, totalPages, totalItems)
  const startIndex = (currentPage - 1) * LAZY_LOADING_CONFIG.PAGE_SIZE;
  const endIndex = Math.min(startIndex + LAZY_LOADING_CONFIG.PAGE_SIZE, totalItems);

  const panelOpen = !!(detailsLoading || detailsError || selectedAccountDetails);
  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 w-full min-h-0 overflow-hidden">
      {paginationLoading && (
        <div className="absolute inset-0 z-40 bg-white/75 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}
      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-blue-50 rounded-lg sm:rounded-xl px-4 sm:px-6 py-3 sm:py-3.5 shadow-sm border border-blue-100 mb-4 w-full backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium text-sm">
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
                <svg className="inline-block w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Confirm Delete</h4>
              <p className="text-sm sm:text-base text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteAccountName || `${deleteCount} account${deleteCount > 1 ? 's' : ''}`}</span>?</p>
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
      {/* Accounts Table with Sticky Pagination */}
      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">
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
            placeholder="Search accounts..."
            className="max-w-xs"
          />
        </div>
        {/* Table Container - Scrollable with fixed height */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative visible-scrollbar">
          <table className="min-w-max w-full border-collapse">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr>
                {/* Select All Checkbox - Touch friendly */}
                <th className="sticky left-0 z-40 min-w-1 sm:min-w-1 w-1 sm:w-2 h-2 px-2 sm:px-3 py-3 text-center bg-gray-50">
                  <input type="checkbox" aria-label="Select all" checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </th>
                {/* Column Headers with Sorting */}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 select-none cursor-pointer hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap ${col.key.toLowerCase() === "name" ? "sticky left-10 sm:left-12 z-30 min-w-40 bg-gray-50" : "hidden sm:table-cell min-w-20 sm:min-w-32"}`}
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
            <tbody className="divide-y divide-gray-100">
              {/* Render sorted and paginated data rows */}
              {paginatedData.map((account, index) => {
                const absoluteIndex = startIndex + index;
                return (
                  <tr
                    key={getField(account, "AccountId") ?? getField(account, "Name") ?? getField(account, "name") ?? index}
                    className={`transition-all duration-150 hover:bg-gray-50 ${selected.has(absoluteIndex) ? "bg-blue-50" : "bg-white"
                      }`}
                  >
                    {/* Row Selection Checkbox */}
                    <td
                      className="sticky left-0 bg-inherit text-center min-w-10 sm:min-w-12 w-10 sm:w-12 px-2 sm:px-3 py-3 flex items-center justify-center"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${index + 1}`}
                        checked={selected.has(absoluteIndex)}
                        onChange={() => toggleRow(absoluteIndex)}
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    {/* Data Cells */}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-left text-xs sm:text-sm text-gray-700 ${col.key.toLowerCase() === "name"
                          ? "sticky left-10 sm:left-12 z-20 min-w-40 bg-white max-w-xs overflow-hidden"
                          : "hidden sm:table-cell bg-inherit max-w-xs truncate overflow-hidden"
                          }`}
                        title={String(dateFields.has(col.key) ? formatDateOnly(getField(account, col.key)) : (getField(account, col.key) || ""))}
                      >
                        {col.key.toLowerCase() === "name" ? (
                          <a
                            href={`/dashboard/Accounts?id=${getField(account, "AccountId") ?? getField(account, "accountId")}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleShowAccountDetails(getField(account, "AccountId") ?? getField(account, "accountId"));
                            }}
                            className="flex items-center gap-2 font-medium text-blue-600 cursor-pointer hover:text-blue-700 transition-colors duration-150 group w-full min-w-0"
                          >
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg shadow-sm font-semibold text-sm transition-transform duration-200 group-hover:scale-110 flex-shrink-0"
                              style={{
                                background: getColorFromString(
                                  getField(account, "Name") ?? getField(account, "name"),
                                  0.35,
                                  85
                                ),
                                color: getDarkerColorFromString(
                                  getField(account, "Name") ?? getField(account, "name"),
                                  1,
                                  45
                                ),
                              }}
                              title={getField(account, "Name") ?? getField(account, "name")}
                            >
                              {getInitials(getField(account, "Name") ?? getField(account, "name"))}
                            </span>
                            <span className="group-hover:underline truncate min-w-0">
                              {highlightMatch
                                ? highlightMatch(getField(account, "Name") ?? getField(account, "name"), search)
                                : getField(account, "Name") ?? getField(account, "name")}
                            </span>
                          </a>

                        ) : col.key === "RelatedContacts" ? (
                          (() => {
                            const accountId = getField(account, "AccountId") ?? getField(account, "accountId");
                            const contacts = contactsCache.get(accountId) || [];
                            const isLoading = contactsLoading.has(accountId);
                            const isExpanded = expandedRelatedContacts === accountId;

                            if (isLoading) {
                              return <span className="text-gray-400">Loading...</span>;
                            }

                            if (contacts.length === 0) {
                              return <span className="italic text-gray-400">-</span>;
                            }

                            const displayContacts = contacts.slice(0, 4);
                            const hasMore = contacts.length > 4;

                            return (
                              <div className="relative inline-flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 min-w-0">
                                    {displayContacts.map((contact, idx) => {
                                      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                                      const initials = getInitials(fullName);
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          className="inline-flex items-center justify-center w-6 h-6 rounded-full shadow-sm font-semibold text-xs transition-transform duration-200 hover:scale-110 flex-shrink-0"
                                          style={{
                                            background: getColorFromString(fullName, 0.35, 85),
                                            color: getDarkerColorFromString(fullName, 1, 45),
                                          }}
                                          title={fullName}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleShowContactDetails(contact.contactId);
                                            setExpandedRelatedContacts(null);
                                          }}
                                        >
                                          {initials}
                                        </button>
                                      );
                                    })}
                                    {hasMore && (
                                      <span className="text-xs text-gray-500 font-medium">+{contacts.length - 4}</span>
                                    )}
                                  </div>
                                  <button
                                    ref={isExpanded ? expandButtonRef : null}
                                    type="button"
                                    className={`ml-auto rounded-full text-[10px] font-semibold transition-all duration-150 ${isExpanded ? 'w-6 h-6 bg-blue-600 text-white flex items-center justify-center' : 'w-5 h-5 bg-transparent text-blue-600 hover:text-blue-800'}`}
                                    aria-expanded={isExpanded}
                                    aria-label={isExpanded ? 'Hide related contacts' : 'Show related contacts'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedRelatedContacts((prev) => (prev === accountId ? null : accountId));
                                    }}
                                  >
                                    &gt;
                                  </button>
                                </div>
                                {isExpanded && relatedContactsPortalCoords && createPortal(
                                  <div
                                    ref={panelRef}
                                    className="z-50 rounded-2xl border border-gray-200 bg-white shadow-xl p-2 text-left whitespace-normal"
                                    style={{
                                      position: 'absolute',
                                      top: `${relatedContactsPortalCoords.top}px`,
                                      left: `${relatedContactsPortalCoords.left}px`,
                                      minWidth: '220px',
                                      maxWidth: '320px',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="text-xs font-semibold text-gray-600 mb-2">Related Contacts</div>
                                    <div className="space-y-1">
                                      {contacts.map((contact) => {
                                        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact';
                                        return (
                                          <button
                                            key={contact.contactId || fullName}
                                            type="button"
                                            className="w-full text-left text-xs sm:text-sm text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg px-3 py-1 transition-colors duration-150"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleShowContactDetails(contact.contactId);
                                              setExpandedRelatedContacts(null);
                                            }}
                                          >
                                            {fullName}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </div>
                            );
                          })()
                        ) : col.key === "Tags" ? (
                          (() => {
                            const raw = getField(account, "Tags") ?? "";
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
                        ) : (
                          dateFields.has(col.key) ? formatDateOnly(getField(account, col.key)) : getField(account, col.key)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
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
              {/* First — hidden on mobile */}
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1 || paginationLoading}
                title="First page"
                className="hidden sm:flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"/></svg>
              </button>

              <button
                onClick={prevPage}
                disabled={currentPage === 1 || paginationLoading}
                title="Previous page"
                className="flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
              </button>

              {/* Last — hidden on mobile */}
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage >= totalPages || paginationLoading}
                title="Last page"
                className="hidden sm:flex items-center px-2 py-1.5 rounded-lg bg-transparent text-gray-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5"/></svg>
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

      {/* Edit Form - Comprehensive Account Fields */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
              <h4 className="text-xl font-semibold text-gray-900">Edit Account</h4>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Name</label>
                    <input type="text" value={editForm.Name || ""} disabled className="border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Industry Type</label>
                    <input type="text" value={editForm.IndustryType || ""} onChange={(e) => setEditForm({ ...editForm, IndustryType: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Business Type</label>
                    <input type="text" value={editForm.BusinessType || ""} onChange={(e) => setEditForm({ ...editForm, BusinessType: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h5 className="font-semibold text-gray-900 mb-4">Location</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Address</label>
                    <textarea value={editForm.Address || ""} onChange={(e) => setEditForm({ ...editForm, Address: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" rows="2" />
                  </div>
                </div>
              </div>

              {/* Business Info */}
              <div>
                <h5 className="font-semibold text-gray-900 mb-4">Business Information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Website</label>
                    <input type="url" value={editForm.Website || ""} onChange={(e) => setEditForm({ ...editForm, Website: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Phone</label>
                    <input type="tel" value={editForm.Phone || ""} onChange={(e) => setEditForm({ ...editForm, Phone: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Display Phone</label>
                    <input type="tel" value={editForm.DisplayPhone || ""} onChange={(e) => setEditForm({ ...editForm, DisplayPhone: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Territory</label>
                    <input type="text" value={editForm.Territory || ""} onChange={(e) => setEditForm({ ...editForm, Territory: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Number of Employees</label>
                    <input type="number" value={editForm.NumberOfEmployees || ""} onChange={(e) => setEditForm({ ...editForm, NumberOfEmployees: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Annual Revenue</label>
                    <input type="number" value={editForm.AnnualRevenue || ""} onChange={(e) => setEditForm({ ...editForm, AnnualRevenue: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <h5 className="font-semibold text-gray-900 mb-4">Social Media</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Facebook</label>
                    <input type="text" value={editForm.Facebook || ""} onChange={(e) => setEditForm({ ...editForm, Facebook: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Twitter</label>
                    <input type="text" value={editForm.Twitter || ""} onChange={(e) => setEditForm({ ...editForm, Twitter: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">LinkedIn</label>
                    <input type="text" value={editForm.LinkedIn || ""} onChange={(e) => setEditForm({ ...editForm, LinkedIn: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Activity & Assignment */}
              <div>
                <h5 className="font-semibold text-gray-900 mb-4">Activity & Assignment</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Last Contacted Mode</label>
                    <input type="text" value={editForm.LastContactedMode || ""} onChange={(e) => setEditForm({ ...editForm, LastContactedMode: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {/* âŒ REMOVED: Last Contacted Time - System-managed date should not be editable
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-gray-700 text-sm">Last Contacted Time</label>
                    <input type="datetime-local" value={editForm.LastContactedTime || ""} onChange={(e) => setEditForm({...editForm, LastContactedTime: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  */}
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
      {/* Account Details Slide-in Popup */}
      {(detailsLoading || detailsError || selectedAccountDetails) && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={handleCloseAccountDetails} />
          <div className="fixed right-0 top-0 h-full w-[60%] bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-gray-200 animate-in slide-in-from-right duration-300 text-sm">
            {/* Header */}
            <div className="relative flex items-center gap-4 sm:gap-5 p-4 sm:p-8 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
              <div
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-sm flex-shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  color: "white",
                }}
              >
                {getField(selectedAccountDetails, "Name")
                  ? String(getField(selectedAccountDetails, "Name")).charAt(0).toUpperCase()
                  : "A"}
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-base sm:text-lg truncate">
                  {getField(selectedAccountDetails, "Name") || "Account"}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span>Account Details</span>
                </div>
                {selectedAccountDetails && (() => {
                  const accountId =
                    getField(selectedAccountDetails, "AccountId") ??
                    getField(selectedAccountDetails, "accountId");
                  const contacts = contactsCache.get(accountId) || [];
                  const isExpanded = expandedRelatedContacts === accountId;
                  const isLoading = contactsLoading.has(accountId);

                  return (
                    <div className="mt-4 ">
                      <button
                        ref={isExpanded ? expandButtonRef : null}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRelatedContacts(isExpanded ? null : accountId);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium px-3 py-2 transition-all shadow-sm"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20h12a6 6 0 00-6-6 6 6 0 00-6 6z"
                          />
                        </svg>
                        Related Contacts
                      </button>
                      {isExpanded && relatedContactsPortalCoords && createPortal(
                        <div
                          ref={panelRef}
                          className="z-50 rounded-2xl border border-gray-200 bg-white shadow-xl p-2 text-left whitespace-normal"
                          style={{
                            position: 'absolute',
                            top: `${relatedContactsPortalCoords.top}px`,
                            left: `${relatedContactsPortalCoords.left}px`,
                            minWidth: '220px',
                            maxWidth: '320px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-xs font-semibold text-gray-600 mb-2">Related Contacts</div>
                          <div className="space-y-1">
                            {isLoading ? (
                              <div className="text-sm text-gray-500 px-3 py-2">Loading contacts...</div>
                            ) : contacts.length === 0 ? (
                              <div className="text-sm text-gray-500 px-3 py-2">No related contacts</div>
                            ) : (
                              contacts.map((contact) => {
                                const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact';
                                return (
                                  <button
                                    key={contact.contactId || fullName}
                                    type="button"
                                    className="w-full text-left text-xs sm:text-sm text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg px-3 py-1 transition-colors duration-150"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleShowContactDetails(contact.contactId);
                                      setExpandedRelatedContacts(null);
                                    }}
                                  >
                                    {fullName}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all duration-200 flex-shrink-0 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Close details"
                onClick={handleCloseAccountDetails}
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 visible-scrollbar">
              <form
                className="space-y-8"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!selectedAccountDetails) return;
                  // Validate required / formatted fields before sending
                  try {
                    const nameVal = getField(selectedAccountDetails, "Name") ?? getField(selectedAccountDetails, "name") ?? "";
                    const websiteVal = getField(selectedAccountDetails, "Website") ?? getField(selectedAccountDetails, "website") ?? "";
                    const phoneVal = getField(selectedAccountDetails, "Phone") ?? getField(selectedAccountDetails, "phone") ?? "";

                    if (!nameVal || String(nameVal).trim() === "") {
                      onToast && onToast("Account Name is required", "error");
                      return;
                    }
                    if (websiteVal && websiteVal.trim() !== "" && !isValidURL(websiteVal)) {
                      onToast && onToast("Website must be a valid URL (include http/https)", "error");
                      return;
                    }
                    if (phoneVal && phoneVal.trim() !== "" && !isNumeric(phoneVal)) {
                      onToast && onToast("Phone must be numeric", "error");
                      return;
                    }

                    const id = getField(selectedAccountDetails, "AccountId") ?? getField(selectedAccountDetails, "accountId");
                    const res = await fetch(`/Account/${encodeURIComponent(id)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(selectedAccountDetails),
                    });
                    if (res.ok) {
                      await refetch();
                      onToast && onToast("Account updated successfully", "success");
                      handleCloseAccountDetails();
                    } else {
                      onToast && onToast("Failed to update account", "error");
                    }
                  } catch (err) {
                    onToast && onToast("Error updating account", "error");
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

                {selectedAccountDetails && (
                  <>
                    {/* Field mapping for comprehensive form - matching add.js */}
                    {(() => {
                      const formFields = [
                        // Core Identity
                        { key: "Name", label: "Company Name" },
                        { key: "IndustryType", label: "Industry Type" },
                        { key: "BusinessType", label: "Business Type" },
                        // Location
                        { key: "Country", label: "Country" },
                        { key: "State", label: "State" },
                        { key: "City", label: "City" },
                        { key: "Zipcode", label: "Zipcode" },
                        { key: "Address", label: "Address" },
                        // Business Info
                        { key: "Website", label: "Website", type: "url" },
                        { key: "Phone", label: "Phone", type: "tel" },
                        { key: "DisplayPhone", label: "Display Phone", type: "tel" },
                        { key: "Territory", label: "Territory" },
                        { key: "NumberOfEmployees", label: "Number of Employees", type: "number" },
                        { key: "AnnualRevenue", label: "Annual Revenue", type: "number" },
                        // Ownership
                        { key: "SalesOwner", label: "Sales Owner" },

                        { key: "ParentAccount", label: "Parent Account" },

                        // Social Media
                        { key: "Facebook", label: "Facebook", type: "url" },
                        { key: "Twitter", label: "Twitter", type: "url" },
                        { key: "LinkedIn", label: "LinkedIn", type: "url" },
                        // Activity
                        { key: "LastContactedMode", label: "Last Contacted Mode" },
                        { key: "LastContactedTime", label: "Last Contacted Time", type: "date" },
                        { key: "LastActivityType", label: "Last Activity Type" },
                        { key: "LastActivityDate", label: "Last Activity Date", type: "date" },
                        { key: "RecentNote", label: "Recent Note" },
                        { key: "LastAssignedAt", label: "Last Assigned At", type: "date" },
                        { key: "CreatedAt", label: "Created At", type: "date" },
                        { key: "UpdatedAt", label: "Updated At", type: "date" },
                        // Sequences
                        { key: "ActiveSalesSequences", label: "Active Sales Sequences", type: "number" },
                        { key: "CompletedSalesSequences", label: "Completed Sales Sequences", type: "number" },
                        // Metadata
                        { key: "Tags", label: "Tags" },
                        { key: "ImportID", label: "Import ID" },
                        { key: "UpdatedBy", label: "Last Updated By" },
                        { key: "CreatedBy", label: "Created By" },
                      ];

                      return (
                        <>
                          {/* Account Information Section - Dynamic Columns */}
                          <div className="bg-white rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-5">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <h3 className="font-normal text-gray-900 text-base">Account Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {formFields.map((col) => (
                                <div key={col.key} className="flex flex-col gap-2">
                                  <label className="font-normal text-gray-700 text-xs">
                                    {col.label}
                                  </label>
                                  {col.key === "Country" ? (
                                    <select
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={getField(selectedAccountDetails, "Country") || ""}
                                      onChange={(e) => {
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          Country: e.target.value,
                                          State: "",
                                          City: "",
                                        });
                                        const found = countries.find(c => c.name === e.target.value);
                                        setSlideCountryCode(found ? found.isoCode : "");
                                        setSlideStateCode("");
                                      }}
                                    >
                                      <option value="">Select Country</option>
                                      {countries.map((c) => (
                                        <option key={c.isoCode} value={c.name}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : col.key === "State" ? (
                                    <select
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={getField(selectedAccountDetails, "State") || ""}
                                      onChange={(e) => {
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          State: e.target.value,
                                          City: "",
                                        });
                                        const found = slideStates.find(s => s.name === e.target.value);
                                        setSlideStateCode(found ? found.isoCode : "");
                                      }}
                                      disabled={!slideCountryCode}
                                    >
                                      <option value="">Select State</option>
                                      {slideStates.map((s) => (
                                        <option key={s.isoCode} value={s.name}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : col.key === "City" ? (
                                    <select
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={getField(selectedAccountDetails, "City") || ""}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          City: e.target.value,
                                        })
                                      }
                                      disabled={!slideStateCode}
                                    >
                                      <option value="">Select City</option>
                                      {slideCities.map((city) => (
                                        <option key={city.name} value={city.name}>
                                          {city.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : col.key === "Address" || col.key === "RecentNote" || col.key === "Tags" || col.key === "ImportID" ? (
                                    <textarea
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 resize-none"
                                      rows="2"
                                      value={getField(selectedAccountDetails, col.key) || ""}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          [col.key]: e.target.value,
                                        })
                                      }
                                    />
                                  ) : col.key === "NumberOfEmployees" || col.key === "AnnualRevenue" || col.key === "ActiveSalesSequences" || col.key === "CompletedSalesSequences" || col.key === "SalesOwnerId" || col.key === "ParentAccountId" ? (
                                    <input
                                      type="number"
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={getField(selectedAccountDetails, col.key) || ""}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          [col.key]: e.target.value ? Number(e.target.value) : null,
                                        })
                                      }
                                    />
                                  ) : col.key === "DisplayPhone" || col.key === "Phone" ? (
                                    <input
                                      type="tel"
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={getField(selectedAccountDetails, col.key) || ""}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          [col.key]: e.target.value,
                                        })
                                      }
                                    />
                                  ) : col.key === "Facebook" || col.key === "Twitter" || col.key === "LinkedIn" || col.key === "Website" ? (
                                    <input
                                      type="url"
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      placeholder="https://..."
                                      value={getField(selectedAccountDetails, col.key) || ""}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          [col.key]: e.target.value,
                                        })
                                      }
                                    />
                                  ) : col.key === "LastActivityDate" || col.key === "LastAssignedAt" || col.key === "LastContactedTime" || col.key === "CreatedAt" || col.key === "UpdatedAt" ? (
                                    <input
                                      type="date"
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={formatDateOnly(getField(selectedAccountDetails, col.key))}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          [col.key]: e.target.value ? new Date(e.target.value).toISOString() : "",
                                        })
                                      }
                                    />
                                  ) : (
                                    <input
                                      type={col.type || "text"}
                                      className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                      value={getField(selectedAccountDetails, col.key) || ""}
                                      onChange={(e) =>
                                        setSelectedAccountDetails({
                                          ...selectedAccountDetails,
                                          [col.key]: e.target.value,
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

                {/* Footer Actions */}
                <div className="flex justify-between items-center gap-3 pt-6  mt-8 bg-white/50 backdrop-blur-sm rounded-xl p-6 -mx-2">
                  {isAdminOnly && (
                    <button
                      type="button"
                      className="px-6 py-3 rounded-xl border-2 border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-600 font-normal transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                      onClick={() => {
                        if (selectedAccountDetails) {
                          const idx = sortedData.findIndex((a) => (getField(a, "AccountId") ?? getField(a, "accountId")) === (getField(selectedAccountDetails, "AccountId") ?? getField(selectedAccountDetails, "accountId")));
                          if (idx !== -1) {
                            setSelected(new Set([idx]));
                            setDeleteCount(1);
                            setShowDeleteModal(true);
                          }
                        }
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Delete Account
                    </button> 
                  )}
                  {canEditAccount(selectedAccountDetails) ? (
                    <button
                      type="submit"
                      className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-normal shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 transform hover:scale-105 ml-auto"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400 ml-auto italic">View-only - you can only edit accounts you created.</p>
                  )}
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Accounts;