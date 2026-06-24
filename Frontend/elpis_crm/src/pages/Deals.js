import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Building2, User, MoreVertical, Eye, Trash2 } from "lucide-react";
import apiClient from "../api/client";
import { useContext } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import AuthContext from "../auth/AuthContext";
import { searchAccounts, searchContactsByAccount } from "../api/entitySearch";
import SearchBar from "../utils/SearchBar";
import { fetchExchangeRates, convertCurrency, getCurrencySymbol, cleanCurrencyValue, getINRValueFromDeal, round2 } from "../utils/currency";


export const dealStages = [
  "New Lead",
  "Enquiry Analysis",
  "Under Review",
  "Demo",
  "Proposal/Price Quote",
  "Hold",
  "Negotiation/Review",
  //"Follow Up",
  "PO Received",
  "Won",
  "Lost",
];

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

// Exported function to fetch grouped deal stage counts
export async function fetchDealStageCounts() {
  const res = await fetch(`/Deal`);
  const json = await res.json();
  const grouped = (Array.isArray(json) ? json : []).reduce((acc, deal) => {
    const stage = deal.dealStage || deal.DealStage || "New Lead";
    if (!acc[stage]) acc[stage] = 0;
    acc[stage]++;
    return acc;
  }, {});
  return dealStages.map((stage) => ({
    stage,
    count: grouped[stage] || 0,
  }));
}

const stageHeaderColors = {
  "New Lead": "#e9f5f9",
  "Enquiry Analysis": "#f0f0e9",
  "Under Review": "#f5e9f5",
  Demo: "#e9f9f2",
  "Proposal/Price Quote": "#f9f2e9",
  "Hold": "#fdf6e3",
  "Negotiation/Review": "#f2e9f9",
  //"Follow Up": "#e9e9f9",
  "PO Received": "#f0f8ff",
  Won: "#e0eee8",
  Lost: "#ffe4e1",
};

// currency helpers imported from src/utils/currency.js

// Format price with correct currency symbol and 2 decimals
function formatPrice(price, currency = 'INR') {
  if (price === null || price === undefined || price === "") return `${getCurrencySymbol(currency)}0.00`;
  const numPrice = Number(price);
  if (Number.isNaN(numPrice)) return `${getCurrencySymbol(currency)}0.00`;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numPrice);
}

function formatDealValue(deal) {
  if (!deal) return formatPrice(0, 'INR');
  const currency = deal.currency || deal.Currency || 'INR';
  return formatPrice(deal.dealValue ?? deal.totalPrice ?? 0, currency);
}

function getDealField(deal, fieldName) {
  if (!deal) return undefined;
  if (deal[fieldName] !== undefined) return deal[fieldName];
  const camelCase = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
  if (deal[camelCase] !== undefined) return deal[camelCase];
  if (deal[`Deal${fieldName}`] !== undefined) return deal[`Deal${fieldName}`];
  if (deal[`deal${fieldName}`] !== undefined) return deal[`deal${fieldName}`];
  const dealCamel = `deal${camelCase}`;
  if (deal[dealCamel] !== undefined) return deal[dealCamel];
  if (deal[fieldName.toLowerCase()] !== undefined) return deal[fieldName.toLowerCase()];
  return undefined;
}

/** Account label for slide-in / header: deal fields first, then search list lookup. */
function resolveAccountDisplayName(deal, accountsList) {
  if (!deal) return "";
  const fromDeal =
    getDealField(deal, "accountName") ??
    deal.accountName ??
    deal.AccountName;
  if (fromDeal && String(fromDeal).trim()) return String(fromDeal).trim();

  const id =
    getDealField(deal, "accountId") ?? deal.accountId ?? deal.AccountId;
  if (id == null || id === "" || !Array.isArray(accountsList)) return "";

  const acc = accountsList.find((a) => {
    const aid = a.accountId ?? a.id ?? a.AccountId ?? a.Id;
    return String(aid) === String(id);
  });
  return (acc?.name ?? acc?.Name ?? "").trim();
}

function getDealContactIds(deal) {
  if (!deal) return [];
  const raw =
    deal.contactIds ??
    deal.ContactIds ??
    deal.contactIDs ??
    deal.ContactIDs ??
    null;

  const ids = Array.isArray(raw)
    ? raw
    : raw != null && raw !== ""
      ? String(raw).split(",")
      : [];

  const normalized = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const legacyId = Number(deal.contactId ?? deal.ContactId);
  if (Number.isFinite(legacyId) && legacyId > 0 && !normalized.includes(legacyId)) {
    normalized.unshift(legacyId);
  }

  return [...new Set(normalized)];
}

function getDealContactNames(deal) {
  if (!deal) return [];
  const raw = deal.contactNames ?? deal.ContactNames ?? null;
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((name) => name.trim()).filter(Boolean);
  }
  const legacy = deal.contactName ?? deal.ContactName;
  return legacy ? String(legacy).split(",").map((name) => name.trim()).filter(Boolean) : [];
}

function getContactDisplayName(contact) {
  if (!contact) return "";
  const id = contact.contactId ?? contact.ContactId ?? contact.id ?? contact.Id;
  const firstName = String(contact.FirstName ?? contact.firstName ?? "").trim();
  const lastName = String(contact.LastName ?? contact.lastName ?? "").trim();
  return `${firstName} ${lastName}`.trim() || String(contact.name ?? contact.Name ?? `Contact ${id}`);
}

/** Most recent activity: UpdatedAt, else CreatedAt (for Kanban ordering). */
function dealActivityTimestampMs(deal) {
  if (!deal) return 0;
  const u = deal.updatedAt ?? deal.UpdatedAt;
  const c = deal.createdAt ?? deal.CreatedAt;
  const t = u ?? c;
  if (!t) return 0;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortDealsGroupedByStage(grouped) {
  Object.keys(grouped).forEach((k) => {
    grouped[k].sort((a, b) => dealActivityTimestampMs(b) - dealActivityTimestampMs(a));
  });
  return grouped;
}

// Textarea that grows with its content instead of scrolling. Height follows the
// text: it expands as you type and shrinks when text is removed, never going
// below the initial `minRows` height and never showing an inner scrollbar.
function AutoGrowTextarea({ value, minRows = 4, className = "", style, ...props }) {
  const ref = useRef(null);
  const minHeightRef = useRef(0);
  const resize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    // Account for borders so box-sizing: border-box doesn't clip the last line.
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.max(el.scrollHeight + borders, minHeightRef.current)}px`;
  };
  useEffect(() => {
    const el = ref.current;
    // Capture the natural height of `minRows` rows once, to use as the floor.
    if (el && !minHeightRef.current) minHeightRef.current = el.offsetHeight;
    resize(el);
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onInput={(e) => resize(e.target)}
      className={`overflow-auto resize ${className}`}
      style={style}
      {...props}
    />
  );
}

function Deals({
  onRefetchReady,
  onToast,
  filters,
  onFiltersChange,
  selectedColumns,
  onSelectedColumnsChange,
  search,
  highlightMatch,
  onTagsAvailable,
  searchHighlight,
  onSearchHighlightDone,
}) {
  console.log("[Deals] Component received props:", { filters, search, onFiltersChange: typeof onFiltersChange });

  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const userName = auth?.getUserName?.() || localStorage.getItem("userName") || "";
  const isAdmin = ["Admin", "admin", "Manager", "manager"].includes(userRole);
  const isManager = ["Manager", "manager"].includes(userRole);

  // A user can edit a deal if they are admin/manager OR they created it
  const canEditDeal = (deal) => {
    if (!deal) return false;
    if (isAdmin || isManager) return true;
    const creator = deal.createdBy || deal.CreatedBy || "";
    return creator !== "" && creator === userName;
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDealName, setDeleteDealName] = useState("");
  const [deleteDealId, setDeleteDealId] = useState(null);
  const [dealsByStage, setDealsByStage] = useState({});
  const [rawDeals, setRawDeals] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedDealDetails, setSelectedDealDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [enquiryNumbers, setEnquiryNumbers] = useState([]);
  const [enquiryLoading, setEnquiryLoading] = useState(false);


  const [accountsList, setAccountsList] = useState([]);
  const [accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [debouncedAccountSearchTerm, setDebouncedAccountSearchTerm] = useState("");
  const [productsList, setProductsList] = useState([]);
  /** Contacts for the account selected in the deal slide-in (GET /Contact/account/:id) */
  const [dealSlideContacts, setDealSlideContacts] = useState([]);
  const [dealSlideContactsLoading, setDealSlideContactsLoading] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all");

  // Local search bar inside the Deals kanban (independent from global header search)
  const [localDealSearch, setLocalDealSearch] = useState("");
  const [debouncedLocalDealSearch, setDebouncedLocalDealSearch] = useState("");

  // Debounce the local search — wait 250ms after the user stops typing before hitting the server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocalDealSearch(localDealSearch), 250);
    return () => clearTimeout(t);
  }, [localDealSearch]);


  // DealNotes state
  const [dealNotes, setDealNotes] = useState([]);
  const [newDealNote, setNewDealNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [showAddNoteBox, setShowAddNoteBox] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // ── Note destination checklist state ────────────────────────────────────
  // Lets the user choose, per deal note, whether it should also appear on one
  // or more of the deal's linked contacts, or stay on the deal only.
  const [noteContactSelections, setNoteContactSelections] = useState(() => new Set());
  const [noteDealOnlySelected, setNoteDealOnlySelected] = useState(false);
  const [noteDestinationError, setNoteDestinationError] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef(null);

  // Reset the checklist whenever the add-note box is opened/closed or the
  // open deal changes, so stale selections from a previous note don't leak in.
  useEffect(() => {
    setNoteContactSelections(new Set());
    setNoteDealOnlySelected(false);
    setNoteDestinationError("");
  }, [showAddNoteBox, selectedDealDetails?.dealId, selectedDealDetails?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(event.target)
      ) {
        setShowContactDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function toggleNoteContact(contactId) {
    setNoteContactSelections((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);

      // Auto-check "This deal only" once at least one contact is selected;
      // auto-release it back to unchecked only once no contacts remain checked.
      setNoteDealOnlySelected((wasChecked) => (next.size > 0 ? true : wasChecked && false));
      return next;
    });
    setNoteDestinationError("");
  }

  function toggleNoteDealOnly() {
    // Locked on while any contact is selected — once a contact is checked,
    // "This deal only" is forced on and can't be unchecked independently.
    if (noteContactSelections.size > 0) return;
    setNoteDealOnlySelected((v) => !v);
    setNoteDestinationError("");
  }

  function formatDateOnly(val) {
    if (val === null || val === undefined || val === "") return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }

  // function getDealCreatedAt(deal) {
  //   const createdValue =
  //     getDealField(deal, "CreatedAt") ??
  //     deal.createdAt ??
  //     deal.CreatedAt;
  //   if (!createdValue) return null;
  //   const date = new Date(createdValue);
  //   return Number.isFinite(date.getTime()) ? date : null;
  // }

  function formatDealCreatedAt(deal) {
    const createdValue =
      getDealField(deal, "CreatedAt") ??
      deal.createdAt ??
      deal.CreatedAt;
    if (!createdValue) return "";
    const date = new Date(createdValue);
    if (!Number.isFinite(date.getTime())) return String(createdValue);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatDealUpdatedAt(deal) {
    const updatedValue =
      getDealField(deal, "UpdatedAt") ??
      deal.updatedAt ??
      deal.UpdatedAt;
    if (!updatedValue) return "";
    const date = new Date(updatedValue);
    if (!Number.isFinite(date.getTime())) return String(updatedValue);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const fetchDeals = useCallback(async (pipelineValue) => {
    setPageLoading(true);
    try {
      // Use only explicitly passed pipeline (prevents stale/unsynced filters from overriding endpoint)
      const pipeline = pipelineValue ?? "all";

      let endpoint = "";

      // Build server-side search param (min 2 chars enforced by backend)
      const searchParam = debouncedLocalDealSearch.trim().length >= 2
        ? `&search=${encodeURIComponent(debouncedLocalDealSearch.trim())}`
        : "";

      if (pipeline === "all") {
        // Deals page always shows all deals; Home dashboard filters per user.
        endpoint = `/Deal?_=${Date.now()}${searchParam}`;
      } else {
        endpoint = `/Deal/pipeline/deals?pipeline=${encodeURIComponent(pipeline)}${searchParam}`;
      }

      console.log("[Deals.fetchDeals] Pipeline filter:", { pipeline, pipelineValue, endpoint, search: debouncedLocalDealSearch });

      const res = await fetch(endpoint);
      console.log("[Deals.fetchDeals] Response status:", res.status);

      const json = await res.json();
      const arr = Array.isArray(json) ? json : [];

      console.log("[Deals.fetchDeals] Deals fetched:", arr.length);

      // Convert stored INR base values back to the deal's currency for display
      try {
        const rates = await fetchExchangeRates();
        for (const deal of arr) {
          try {
            deal.currency = cleanCurrencyValue(deal.currency || deal.Currency || 'INR');
            const storedINR = getINRValueFromDeal(deal) || 0;
            if (storedINR && deal.currency) {
              // convert INR -> currency
              const converted = Math.round((storedINR * (rates[deal.currency] || 1)) * 100) / 100;
              deal.dealValue = converted;
            } else if (deal.dealValue && !storedINR) {
              // fallback: keep existing dealValue
              deal.dealValue = Number(deal.dealValue);
            }
          } catch (e) {
            // ignore per-deal errors
          }
        }
      } catch (e) {
        // ignore rates fetch errors
      }

      setRawDeals(arr);

      const grouped = arr.reduce((acc, deal) => {
        const stage = deal.dealStage || deal.DealStage || "New Lead";
        if (!acc[stage]) acc[stage] = [];
        acc[stage].push(deal);
        return acc;
      }, {});

      sortDealsGroupedByStage(grouped);

      setDealsByStage(grouped);
    } catch (e) {
      console.error("[Deals.fetchDeals] Error:", e);
      setRawDeals([]);
      setDealsByStage({});
    } finally {
      setPageLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLocalDealSearch]);

  const slideInAccountId = useMemo(() => {
    if (!selectedDealDetails) return null;
    const v =
      getDealField(selectedDealDetails, "accountId") ??
      selectedDealDetails.accountId ??
      selectedDealDetails.AccountId;
    if (v === undefined || v === null || v === "") return null;
    return String(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when account id fields change
  }, [selectedDealDetails?.accountId, selectedDealDetails?.AccountId]);

  const [debouncedContactSlideQ, setDebouncedContactSlideQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContactSlideQ(contactSearchTerm), 300);
    return () => clearTimeout(t);
  }, [contactSearchTerm]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAccountSearchTerm(accountSearchTerm), 300);
    return () => clearTimeout(t);
  }, [accountSearchTerm]);

  useEffect(() => {
    if (!slideInAccountId) {
      setDealSlideContacts([]);
      setDealSlideContactsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setDealSlideContactsLoading(true);
      try {
        const list = await searchContactsByAccount(slideInAccountId, debouncedContactSlideQ, 300);
        if (!cancelled) setDealSlideContacts(list);
      } catch {
        if (!cancelled) setDealSlideContacts([]);
      } finally {
        if (!cancelled) setDealSlideContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slideInAccountId, debouncedContactSlideQ]);

  function dateToISOLocal(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateNum = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${dateNum}T${hours}:${minutes}:${seconds}.000Z`;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = debouncedAccountSearchTerm.trim();
      if (q.length < 2) {
        setAccountsList([]);
        setAccountSearchLoading(false);
        return;
      }
      setAccountSearchLoading(true);
      try {
        const rows = await searchAccounts(q, 60);
        if (!cancelled) setAccountsList(rows);
      } catch {
        if (!cancelled) setAccountsList([]);
      } finally {
        if (!cancelled) setAccountSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedAccountSearchTerm]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`/Products`);
        const json = await res.json();
        setProductsList(Array.isArray(json) ? json : []);
      } catch (_) {
        setProductsList([]);
      }
    }
    fetchProducts();
  }, []);

  const onTagsAvailableRef = useRef(onTagsAvailable);
  useEffect(() => { onTagsAvailableRef.current = onTagsAvailable; }, [onTagsAvailable]);
  const onRefetchReadyRef = useRef(onRefetchReady);
  useEffect(() => { onRefetchReadyRef.current = onRefetchReady; }, [onRefetchReady]);

  // Log when filters prop changes
  useEffect(() => {
    console.log("[Deals] Filters prop changed:", filters);
  }, [filters]);

  useEffect(() => {
    // Extract pipeline filter (case-insensitive field matching)
    console.log("[Deals.useEffect.filters] Starting filter extraction, filters:", filters);

    const filterArray = Array.isArray(filters) ? filters : [];
    const pipelineFilter = filterArray.find((f) => {
      const fieldName = String(f?.field || "").toLowerCase().trim();
      console.log("[Deals.useEffect.filters] Checking filter:", { field: f?.field, fieldNameLower: fieldName, matches: fieldName === "dealpipeline" || fieldName === "pipeline" });
      return fieldName === "dealpipeline" || fieldName === "pipeline";
    });

    const createdByFilterItem = filterArray.find((f) => {
      const fieldName = String(f?.field || "").toLowerCase().trim();
      return fieldName === "createdby";
    });

    const pipeline = pipelineFilter?.value;
    const createdByValue = createdByFilterItem?.value;

    console.log("[Deals.useEffect.filters] Filter extraction complete:", { foundPipelineFilter: !!pipelineFilter, pipeline, createdByValue, createdByFilterItem });

    setCreatedByFilter(createdByValue || "all");
    fetchDeals(pipeline);

    try {
      if (typeof onRefetchReadyRef.current === "function") {
        // expose refetch with current pipeline (avoids stale closure)
        onRefetchReadyRef.current(() => fetchDeals(pipeline));
      }
    } catch (e) { }
  }, [filters, search, fetchDeals]);

  // Refetch when an import completes for Deals
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail?.table || e.detail.table === "Deals") {
        // re-fetch using current pipeline selection
        const pipeline = (Array.isArray(filters) ? filters : []).find(
          (f) => String(f?.field || "").toLowerCase() === "dealpipeline"
        )?.value;
        fetchDeals(pipeline);
      }
    };
    window.addEventListener("importComplete", handler);
    return () => window.removeEventListener("importComplete", handler);
  }, [fetchDeals, filters]);

  // Refetch when a deal is added
  useEffect(() => {
    const handler = () => {
      fetchDeals();
    };
    window.addEventListener("dealAdded", handler);
    return () => window.removeEventListener("dealAdded", handler);
  }, [fetchDeals]);

  useEffect(() => {
    if (!rawDeals || rawDeals.length === 0) {
      setDealsByStage({});
      return;
    }

    const finalList = rawDeals.filter((deal) => {
      // Independent Created At and Updated At date-range filters
      const inRange = (date, from, to) => {
        if (from) {
          const minDate = new Date(from);
          minDate.setHours(0, 0, 0, 0);
          if (!date || date < minDate) return false;
        }
        if (to) {
          const maxDate = new Date(to);
          maxDate.setHours(23, 59, 59, 999);
          if (!date || date > maxDate) return false;
        }
        return true;
      };

      if (!inRange(getDealDateByField(deal, "createdAt"), createdFrom, createdTo)) return false;
      if (!inRange(getDealDateByField(deal, "updatedAt"), updatedFrom, updatedTo)) return false;

      if (createdByFilter && createdByFilter !== "all") {
        const creator = String(
          deal.CreatedBy ?? deal.createdBy ?? deal.CreatedBy ?? ""
        ).toLowerCase();
        if (creator !== String(createdByFilter).toLowerCase()) {
          return false;
        }
      }

      // localDealSearch is now handled server-side (see fetchDeals + debouncedLocalDealSearch).
      // Only apply the global header search prop client-side as a secondary pass — token-based.
      if (search) {
        const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const name = String(deal.name ?? deal.dealName ?? deal.DealName ?? "").toLowerCase();
        const stage = String(deal.dealStage ?? deal.DealStage ?? "").toLowerCase();
        const owner = String(deal.salesOwner ?? deal.SalesOwner ?? "").toLowerCase();
        const accName = String(
          (Array.isArray(accountsList) &&
            accountsList.find(a => a.id === deal.accountId || a.accountId === deal.accountId)?.name) || ""
        ).toLowerCase();
        const contact = String(deal.contactName ?? deal.ContactName ?? "").toLowerCase();
        const combined = `${name} ${stage} ${accName} ${owner} ${contact}`;
        // Every token must appear somewhere in the combined text
        if (!tokens.every(t => combined.includes(t))) return false;
      }

      return true;
    });

    const grouped = finalList.reduce((acc, deal) => {

      const stage =
        deal.dealStage ||
        deal.DealStage ||
        "New Lead";

      if (!acc[stage]) {
        acc[stage] = [];
      }

      acc[stage].push(deal);

      return acc;

    }, {});

    sortDealsGroupedByStage(grouped);

    setDealsByStage(grouped);

  }, [rawDeals, search, accountsList, createdFrom, createdTo, updatedFrom, updatedTo, createdByFilter]);

  // Listen for date range events dispatched from header/dashboard
  useEffect(() => {
    const handler = (e) => {
      const d = e.detail || {};
      setCreatedFrom(d.createdFrom || "");
      setCreatedTo(d.createdTo || "");
      setUpdatedFrom(d.updatedFrom || "");
      setUpdatedTo(d.updatedTo || "");
    };
    window.addEventListener("dealsDateRange", handler);
    return () => window.removeEventListener("dealsDateRange", handler);
  }, []);

  function getDealDateByField(deal, field) {
    if (!deal) return undefined;
    const f = (field || "createdAt").toLowerCase();
    const key = f.includes("updated") ? "UpdatedAt" : "CreatedAt";
    const val = getDealField(deal, key);
    if (!val) return undefined;
    const dt = new Date(val);
    return isNaN(dt.getTime()) ? undefined : dt;
  }

  const fetchDealNotes = useCallback(async (dealId) => {
    if (!dealId) return;

    try {
      setNotesLoading(true);

      const res = await fetch(`/Notes/deal/${dealId}`);

      if (res.ok) {
        const data = await res.json();
        setDealNotes(Array.isArray(data) ? data : []);
      } else {
        setDealNotes([]);

        if (onToast) {
          onToast("Failed to fetch deal notes", "error");
        }
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err);

      setDealNotes([]);

      if (onToast) {
        onToast("Failed to load deal notes", "error");
      }
    } finally {
      setNotesLoading(false);
    }
  }, [onToast]);

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [openedFromHome, setOpenedFromHome] = useState(false);

  const handleShowDetails = useCallback(async (dealName) => {
    if (!dealName && dealName !== 0) return;
    if (String(dealName).toLowerCase() === 'undefined') return;
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedDealDetails(null);
    setSelectedProducts([]);
    try {
      const res = await fetch(`/Deal/${dealName}`);
      if (!res.ok) {
        setDetailsError(`Failed to load details: ${res.status}`);
        return;
      }
      const data = await res.json();
      // Clean potentially corrupted currency value
      data.currency = cleanCurrencyValue(data.currency || data.Currency || 'INR');
      try {
        const rawDealValue = data.dealValue ?? data.DealValue ?? data.totalPrice ?? null;
        data.originalDealValue = rawDealValue;
        data.originalCurrency = cleanCurrencyValue(data.currency || data.Currency || 'INR');
        data.dealValue = rawDealValue;
        const storedINR = getINRValueFromDeal(data) || 0;
        data.DealValueInINR = Number(storedINR) || data.DealValueInINR || data.dealValueInBaseCurrency || data.dealValueInINR || 0;
      } catch (e) {
        // ignore
      }
      setSelectedDealDetails(data);
      setAccountSearchTerm(
        getDealField(data, "accountName") ??
        data.accountName ??
        data.AccountName ??
        ""
      );
      setContactSearchTerm(getDealContactNames(data).join(", "));
      fetchDealNotes(dealName);
      if (data.productName) {
        try {
          const productsArray = typeof data.productName === 'string' ? JSON.parse(data.productName) : data.productName;
          setSelectedProducts(Array.isArray(productsArray) ? productsArray : []);
        } catch (ex) {
          console.warn('Failed to parse products:', ex);
          setSelectedProducts([]);
        }
      } else {
        setSelectedProducts([]);
      }
    } catch (err) {
      console.error("Error fetching deal details:", err);
      setDetailsError("Error fetching deal details");
    } finally {
      setDetailsLoading(false);
    }
  }, [fetchDealNotes]);

  useEffect(() => {
    const contactIds = getDealContactIds(selectedDealDetails);
    if (!contactIds?.length) {
      setEnquiryNumbers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setEnquiryLoading(true);

        const res = await fetch("/Contact/enquiry-numbers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactIds),
        });

        if (!cancelled) {
          const data = await res.json();
          setEnquiryNumbers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch enquiry numbers", err);

        if (!cancelled) {
          setEnquiryNumbers([]);
        }
      } finally {
        if (!cancelled) {
          setEnquiryLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDealDetails?.contactIds, selectedDealDetails?.contactId]);

  useEffect(() => {
    // Check query parameters first (from anchor tags)
    const queryDealId = searchParams.get('id');
    // Then check location state (from navigate with state)
    const openDealId = queryDealId || location?.state?.openDealId;

    if (openDealId && !openedFromHome) {
      handleShowDetails(openDealId);
      setOpenedFromHome(true);
      const nextState = { ...(location.state || {}) };
      delete nextState.openDealId;
      window.history.replaceState(nextState, document.title);
    }
  }, [location?.state, searchParams, openedFromHome, handleShowDetails]);
  const handleCloseDetails = () => {
    setSelectedDealDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
    setSelectedProducts([]);
    setShowNotesPanel(false);
    setAccountSearchTerm("");
    setContactSearchTerm("");
    setIsAccountDropdownOpen(false);
    setIsContactDropdownOpen(false);
  };

  // Auto-open a deal when the global search dropdown sends a searchHighlight
  useEffect(() => {
    if (!searchHighlight || searchHighlight.type !== "deal" || !searchHighlight.id) return;
    handleShowDetails(searchHighlight.id);
    if (typeof onSearchHighlightDone === "function") onSearchHighlightDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchHighlight]);

  // Contacts linked to the currently open deal, used to populate the
  // note-destination checklist (id + display name only).
  const noteEligibleContacts = useMemo(() => {
    if (!selectedDealDetails) return [];
    const ids = getDealContactIds(selectedDealDetails);
    const names = getDealContactNames(selectedDealDetails);
    return ids.map((id, index) => {
      const fromSlide = dealSlideContacts.find(
        (c) => String(c.contactId ?? c.ContactId ?? c.id ?? c.Id) === String(id)
      );
      return {
        id,
        name: fromSlide ? getContactDisplayName(fromSlide) : names[index] || `Contact ${id}`,
      };
    });
  }, [selectedDealDetails, dealSlideContacts]);

  const handleSaveDealNote = async () => {
    if (!newDealNote.trim() || !selectedDealDetails) return;

    // Require an explicit destination choice before saving.
    if (noteContactSelections.size === 0 && !noteDealOnlySelected) {
      setNoteDestinationError("Choose where this note should appear before saving.");
      return;
    }

    try {
      const dealId =
        getDealField(selectedDealDetails, "Id") ||
        selectedDealDetails.dealId ||
        selectedDealDetails.id;

      const payload = {
        dealId: dealId,
        description: newDealNote,
        relatedToType: "Deal",
        // Backend writes one independent copy per contact id here, in addition
        // to the original deal note. Empty array = deal-only.
        mirrorToContactIds: Array.from(noteContactSelections),
      };

      // Dummy endpoint
      const res = await fetch(`/Notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedNote = await res.json();

        setDealNotes((prev) => [savedNote, ...prev]);
        setNewDealNote("");
        setShowAddNoteBox(false);
        setShowContactDropdown(false);
        setNoteContactSelections(new Set());
        setNoteDealOnlySelected(false);
        setNoteDestinationError("");

        if (onToast) {
          onToast("Note added successfully", "success");
        }
      } else {
        if (onToast) {
          onToast("Failed to add note", "error");
        }
      }
    } catch (err) {
      console.error(err);

      if (onToast) {
        onToast("Error while saving note", "error");
      }
    }
  };

  const handleUpdateNote = async (note) => {
    try {
      const noteId = note.id || note.Id;

      const payload = {
        ...note,
        description: editingNoteText,
      };

      const res = await fetch(`/Notes/${noteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setDealNotes((prev) =>
          prev.map((n) =>
            (n.id || n.Id) === noteId
              ? {
                ...n,
                description: editingNoteText,
                Description: editingNoteText,
              }
              : n
          )
        );

        setEditingNoteId(null);
        setEditingNoteText("");

        if (onToast) {
          onToast("Note updated successfully", "success");
        }
      } else {
        if (onToast) {
          onToast("Failed to update note", "error");
        }
      }
    } catch (err) {
      console.error(err);

      if (onToast) {
        onToast("Error updating note", "error");
      }
    }
  };

  function getAccountName(details) {
    const name = resolveAccountDisplayName(details, accountsList);
    return name || "No account";
  }

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  const hasActiveFilters =
    !!localDealSearch?.trim() ||
    !!search?.trim() ||
    createdByFilter !== "all" ||
    !!createdFrom ||
    !!createdTo ||
    !!updatedFrom ||
    !!updatedTo ||
    (Array.isArray(filters) && filters.length > 0);

  const orderedStages = hasActiveFilters
    ? [...dealStages].sort((a, b) => {
      const countA = dealsByStage[a]?.length || 0;
      const countB = dealsByStage[b]?.length || 0;

      // Put empty stages at the end
      if (countA === 0 && countB > 0) return 1;
      if (countB === 0 && countA > 0) return -1;

      // Keep original pipeline order among non-empty stages
      return dealStages.indexOf(a) - dealStages.indexOf(b);
    })
    : dealStages;

  const confirmDelete = async () => {
    if (!deleteDealId) return;

    // NOTE DELETE
    if (deleteDealName === "this note") {
      try {
        const res = await fetch(`/Notes/${deleteDealId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          setDealNotes((prev) =>
            prev.filter(
              (n) => String(n.id || n.Id) !== String(deleteDealId)
            )
          );

          if (onToast) {
            onToast("Note deleted successfully", "success");
          }
        } else {
          if (onToast) {
            onToast("Failed to delete note", "error");
          }
        }
      } catch (err) {
        console.error(err);

        if (onToast) {
          onToast("Error deleting note", "error");
        }
      }

      setShowDeleteModal(false);
      setDeleteDealId(null);
      setDeleteDealName("");
      return;
    }

    // DEAL DELETE
    try {
      const res = await fetch(
        `/Deal/${encodeURIComponent(deleteDealId)}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        setRawDeals((prev) =>
          Array.isArray(prev)
            ? prev.filter((deal) => {
              const id =
                getDealField(deal, "Id") ??
                deal.id ??
                deal.dealId;

              return String(id) !== String(deleteDealId);
            })
            : []
        );

        await fetchDeals();

        try {
          if (typeof onFiltersChange === "function") {
            onFiltersChange([]);
          }
        } catch (e) { }

        if (onToast) {
          onToast("Deal deleted successfully", "success");
        }

        try {
          handleCloseDetails();
        } catch (e) { }
      } else {
        if (onToast) {
          onToast("Failed to delete deal", "error");
        }
      }
    } catch (err) {
      console.error(err);

      if (onToast) {
        onToast("Error deleting deal", "error");
      }
    }

    setOpenMenuId(null);
    setShowDeleteModal(false);
    setDeleteDealName("");
    setDeleteDealId(null);
  };

  // Count deals currently visible — rawDeals already filtered server-side by localDealSearch
  const visibleDealCount = Object.values(dealsByStage).reduce((sum, arr) => sum + arr.length, 0);

  // Shared note-destination checklist UI — rendered above the note textarea
  // wherever "Add Note" is opened (right-side Notes slider and the inline
  // notes panel inside the deal slide-in both reuse this).
  const selectedContactsText = (() => {
    if (noteDealOnlySelected && noteContactSelections.size === 0) {
      return "This Deal Only";
    }
    const selectedNames = noteEligibleContacts
      .filter((c) => noteContactSelections.has(c.id))
      .map((c) => c.name);
    if (selectedNames.length === 0) {
      return "Select Destination";
    }
    if (selectedNames.length <= 2) {
      return selectedNames.join(", ");
    }
    return `${selectedNames
      .slice(0, 2)
      .join(", ")} +${selectedNames.length - 2} more`;
  })();

  const noteDestinationChecklist = (
    <div
      className="rounded-2xl border-2 border-gray-200 bg-white p-4"
      ref={contactDropdownRef}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Show this note in
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowContactDropdown((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white hover:border-blue-400"
        >
          <span className="truncate">
            {selectedContactsText}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${
              showContactDropdown ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showContactDropdown && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
            {noteEligibleContacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={noteContactSelections.has(contact.id)}
                  onChange={() => toggleNoteContact(contact.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {contact.name}
                </span>
              </label>
            ))}
            <div className="border-t border-gray-200 my-1" />
            <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer bg-gray-50">
              <input
                type="checkbox"
                checked={noteDealOnlySelected}
                onChange={toggleNoteDealOnly}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                This Deal Only
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full font-[poppins,sans-serif] bg-gray-50">
      {/* Deals-level search bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-end gap-3 shrink-0">
        <SearchBar
          value={localDealSearch}
          onChange={setLocalDealSearch}
          placeholder="Search deals by name, stage, account, owner…"
          className="max-w-sm"
        />
        {localDealSearch && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {visibleDealCount} deal{visibleDealCount !== 1 ? "s" : ""} matched
          </span>
        )}
      </div>

      <div className="relative flex items-stretch overscroll-scroll gap-4 p-4 overflow-x-auto flex-1 visible-scrollbar" style={{ overflowY: "hidden" }}>
        {pageLoading && (
          <div className="absolute inset-0 z-40 bg-white/75 backdrop-blur-sm flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
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
                <p className="text-sm sm:text-base text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteDealName}</span>?</p>
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
        {/* Date pickers are provided in the dashboard header (kept out of the left panel) */}
        {/* Stage Columns — render in fixed pipeline order so every stage (incl. Hold) keeps its position */}
        {orderedStages.map((stage) => (
          <div key={stage} className="bg-white rounded-2xl w
          -[340px] sm:w-[380px] flex flex-col shadow-sm border border-gray-200 flex-shrink-0 h-full overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 gap-2 shrink-0" style={{ backgroundColor: stageHeaderColors[stage] || undefined }}>
              <h3 className="font-[poppins,sans-serif] text-gray-800 text-sm font-medium truncate">{stage}</h3>
              <span className="bg-white text-gray-600 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0">{dealsByStage[stage] ? dealsByStage[stage].length : 0}</span>
            </div>

            {/* Scrollable Cards Container */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-3">
                {dealsByStage[stage] && dealsByStage[stage].length > 0 ? (
                  dealsByStage[stage]
                    .filter((deal) => {
                      // localDealSearch is handled server-side. Only apply global header search client-side — token-based.
                      if (!search) return true;
                      const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
                      const name = String(deal.name ?? deal.dealName ?? deal.DealName ?? "").toLowerCase();
                      const stage = String(deal.dealStage ?? deal.DealStage ?? "").toLowerCase();
                      const owner = String(deal.salesOwner ?? deal.SalesOwner ?? "").toLowerCase();
                      const acc = String(
                        deal.accountName ?? deal.AccountName ??
                        (Array.isArray(accountsList) && accountsList.find(a => a.id === deal.accountId || a.accountId === deal.accountId)?.name) ?? ""
                      ).toLowerCase();
                      const contact = String(deal.contactName ?? deal.ContactName ?? "").toLowerCase();
                      const combined = `${name} ${stage} ${acc} ${owner} ${contact}`;
                      return tokens.every(t => combined.includes(t));
                    })
                    .map((deal) => {
                      let accountName = "No Account";
                      if (deal.accountName || deal.AccountName) {
                        accountName = deal.accountName || deal.AccountName;
                      } else if (deal.accountId && Array.isArray(accountsList)) {
                        const acc = accountsList.find(a => a.id === deal.accountId || a.accountId === deal.accountId);
                        if (acc && (acc.name || acc.Name)) accountName = acc.name || acc.Name;
                      }
                      let contactName = "No Contact";
                      if (deal.contactName || deal.ContactName) {
                        contactName = deal.contactName || deal.ContactName;
                      } else if (deal.contactId) {
                        const first = deal.contactFirstName ?? deal.ContactFirstName ?? "";
                        const last = deal.contactLastName ?? deal.ContactLastName ?? "";
                        const built = `${first} ${last}`.trim();
                        if (built) contactName = built;
                      }
                      return (
                        <div key={deal.dealId || deal.id} className="group relative bg-white rounded-2xl p-3 shadow-md hover:shadow-lg border border-slate-300 hover:border-blue-400 transition-all duration-200 overflow-hidden min-h-[200px] flex flex-col">
                          <button className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none" aria-label="Show more options" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === (deal.dealId || deal.id) ? null : (deal.dealId || deal.id)); }}>
                            <MoreVertical className="w-3.5 h-3.5 text-gray-600" />
                          </button>

                          {openMenuId === (deal.dealId || deal.id) && (
                            <div ref={dropdownRef} className="absolute top-9 right-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-36 animate-in fade-in zoom-in-95 duration-200">
                              <button onClick={() => { handleShowDetails(deal.dealId || deal.id); setOpenMenuId(null); }} className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                <Eye className="w-3.5 h-3.5" /> View Details
                              </button>
                              {isAdmin && (
                                // <button onClick={() => { setDeleteDealId(deal.id || deal.dealId); setDeleteDealName(deal.name || String(deal.id || deal.dealId)); setShowDeleteModal(true); setOpenMenuId(null); }} className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 focus:ring-2 focus:ring-red-500 focus:outline-none">
                                //   <Trash2 className="w-3.5 h-3.5" /> Delete
                                // </button>

                                <button onClick={() => { const dealId = getDealField(deal, "Id") ?? deal.id ?? deal.dealId; setDeleteDealId(dealId); setDeleteDealName(deal.name || deal.dealName || String(dealId)); setShowDeleteModal(true); setOpenMenuId(null); }} className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 focus:ring-2 focus:ring-red-500 focus:outline-none">
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          )}

                          <div className="relative flex h-full flex-col">
                            {/* Deal Name */}
                            <div className="flex justify-between items-start gap-2 mb-2 pr-7">
                              <a href={`/dashboard/Deals?id=${deal.dealId || deal.id}`} onClick={(e) => {
                                e.preventDefault();
                                handleShowDetails(deal.dealId || deal.id);
                              }} className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-blue-700 transition-colors duration-200 line-clamp-2 leading-5 hover:underline">{deal.name}</a>
                            </div>

                            {/* Deal Value */}
                            <div className="mb-2 pb-2 border-b border-gray-200">
                              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Deal Value</p>
                              <p className="text-base font-bold text-emerald-700">{formatDealValue(deal)}</p>
                            </div>

                            {/* Account and Contact in Grid Layout - LEFT and RIGHT */}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {/* Account - Left Column */}
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Account</p>
                                </div>
                                <p className="text-xs text-slate-900 font-medium truncate">{accountName}</p>
                              </div>

                              {/* Contact - Right Column */}
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Contact</p>
                                </div>
                                <p className="text-xs text-slate-900 font-medium truncate">{contactName}</p>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-slate-100 mt-1.5 space-y-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="font-semibold uppercase tracking-wide text-[9px] text-slate-400 leading-none mb-0.5">Created</div>
                                  <div className="text-[11px] text-slate-600">{formatDealCreatedAt(deal) || "—"}</div>
                                </div>
                                <div>
                                  <div className="font-semibold uppercase tracking-wide text-[9px] text-slate-400 leading-none mb-0.5">Updated</div>
                                  <div className="text-[11px] text-slate-600">{formatDealUpdatedAt(deal) || "—"}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold uppercase tracking-wide text-[9px] text-slate-400">By</span>
                                <span className="text-[11px] text-slate-600 truncate">{deal.createdBy || deal.CreatedBy || "Unknown"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">No deals in this stage</div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Deal Details Slide-in Popup - Keeping as is from previous working version */}
        {/* Notes Right Slider */}
        {showNotesPanel && (
          <div className="fixed inset-0 z-[5000] bg-black/40 backdrop-blur-sm flex justify-end">
            <div className="w-[30%] h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="sticky top-0 z-20 bg-white border-b px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Deal Notes</h2>
                  <p className="text-sm text-gray-500">{dealNotes.length} Notes</p>
                </div>
                <button
                  onClick={() => setShowNotesPanel(false)}
                  className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                >✕</button>
              </div>

              <div className="p-5 border-b bg-gray-50">
                {!showAddNoteBox ? (
                  <button
                    type="button"
                    onClick={() => setShowAddNoteBox(true)}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition-all font-medium"
                  >
                    + New Note
                  </button>
                ) : (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    {noteDestinationChecklist}
                    <AutoGrowTextarea
                      minRows={4}
                      placeholder="Write note..."
                      value={newDealNote}
                      onChange={(e) => setNewDealNote(e.target.value)}
                      className="w-full rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none px-4 py-3"
                    />
                    {noteDestinationError && (
        <p className="text-xs text-red-600 pt-1">{noteDestinationError}</p>
      )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSaveDealNote}
                        className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Save Note
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddNoteBox(false);
                          setShowContactDropdown(false);
                          setNewDealNote("");
                          setNoteContactSelections(new Set());
                          setNoteDealOnlySelected(false);
                          setNoteDestinationError("");
                        }}
                        className="px-5 py-3 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {notesLoading ? (
                  <div className="flex justify-center py-10">Loading...</div>
                ) : dealNotes.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">
                    No notes found
                  </div>
                ) : (
                  dealNotes.map((note, index) => {
                    const noteId = note.id || note.Id;
                    const noteText = note.description || note.Description;
                    const noteDate = note.createdAt || note.CreatedAt;
                    return (
                      <div
                        key={noteId || index}
                        className="bg-white border rounded-2xl p-4 shadow-sm"
                      >
                        {editingNoteId === noteId ? (
                          <>
                            <AutoGrowTextarea
                              minRows={4}
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="w-full border rounded-xl p-3"
                            />
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleUpdateNote(note)}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm">Save</button>
                              <button
                                onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }}
                                className="px-4 py-2 rounded-xl bg-gray-200 text-sm" >Cancel</button>
                            </div>
                          </>
                        ) : (

                          <>
                            <div
                              onClick={() =>
                                setExpandedNotes((prev) => ({
                                  ...prev,
                                  [noteId]: !prev[noteId],
                                }))
                              }
                              className="cursor-pointer"
                            >

                              <p className={`text-sm text-gray-800 whitespace-pre-wrap break-words transition-all duration-200 ${expandedNotes[noteId] ? "" : "line-clamp-3"}`} style={{ wordBreak: "break-word", overflowWrap: "break-word", }}> {noteText}</p>
                              {noteText?.length > 120 && (
                                <button type="button" className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"> {expandedNotes[noteId] ? "Show Less" : "Read More"} </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-3 border-t">
                              <div className="flex flex-col"><span className="text-xs text-gray-500">{formatDateOnly(noteDate)}</span>
                              </div>
                              <div className="flex gap-2">

                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(noteText);

                                    setCopiedNoteId(noteId);

                                    setTimeout(() => {
                                      setCopiedNoteId(null);
                                    }, 2000);
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs transition-all ${copiedNoteId === noteId
                                    ? "bg-green-600 text-white"
                                    : "bg-green-50 text-green-700"
                                    }`}
                                >
                                  {copiedNoteId === noteId ? "✔ Copied" : "Copy"}
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingNoteId(noteId);
                                    setEditingNoteText(noteText);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs"
                                >
                                  Edit
                                </button>

                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setDeleteDealId(noteId);
                                      setDeleteDealName("this note");
                                      setShowDeleteModal(true);
                                    }}
                                    className="px-3 py-1 rounded-lg bg-red-50 text-red-600 text-xs"
                                  >
                                    Delete
                                  </button>
                                )}

                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
        {(detailsLoading || detailsError || selectedDealDetails) && (
          <div className="fixed inset-0 z-[3000] flex items-stretch justify-end pointer-events-none animate-in fade-in duration-300">
            <div className="bg-white shadow-2xl w-[60%] h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 text-sm pointer-events-auto">
              <div className="flex flex-col gap-4 p-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center gap-5 justify-between">
                  <div className="flex items-center gap-5 flex-1">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-semibold text-2xl shadow-xl transform hover:scale-105 transition-transform duration-200" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", color: "white" }}>
                      {getAccountName(selectedDealDetails) ? String(getAccountName(selectedDealDetails)).charAt(0).toUpperCase() : "D"}
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="font-normal text-gray-900 text-lg">{selectedDealDetails?.name || "Deal"}</div>
                      <div className="text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {getAccountName(selectedDealDetails)}
                      </div>

                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200" onClick={handleCloseDetails}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Enquiry No:</span>

                    {enquiryLoading ? (
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="font-medium text-indigo-600">
                        {enquiryNumbers?.join(", ") || "-"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="px-2 sm:px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-normal text-sm shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                    onClick={() => setShowNotesPanel(!showNotesPanel)}
                    title="View Notes"
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
                        d="M8 12h8M8 16h6M6 6h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z"
                      />
                    </svg>
                    <span>Notes</span>
                  </button>
                </div>
              </div>
              <div className="relative flex-1 overflow-y-auto p-8">
                <form className="space-y-8" onSubmit={async (e) => {
                  e.preventDefault();
                  if (!selectedDealDetails) return;

                  // Stage-based required reason validation
                  const stageVal = String(selectedDealDetails.dealStage || "").trim();
                  if (stageVal === "Won" && !String(selectedDealDetails.wonReasons || "").trim()) {
                    if (onToast) onToast("Won Reasons is required when the deal stage is Won.", "error");
                    return;
                  }
                  if (stageVal === "Lost" && !String(selectedDealDetails.lostReason || "").trim()) {
                    if (onToast) onToast("Lost Reason is required when the deal stage is Lost.", "error");
                    return;
                  }

                  try {
                    const dealId = getDealField(selectedDealDetails, 'Id') || getDealField(selectedDealDetails, 'dealId') || selectedDealDetails.dealId || selectedDealDetails.id;
                    if (!dealId) { if (onToast) onToast("Deal ID not found - cannot update", "error"); return; }
                    const dealToSubmit = { ...selectedDealDetails, productName: selectedProducts && selectedProducts.length > 0 ? JSON.stringify(selectedProducts) : null };
                    delete dealToSubmit.createdAt; delete dealToSubmit.CreatedAt; delete dealToSubmit.updatedAt; delete dealToSubmit.UpdatedAt;
                    delete dealToSubmit.createdBy; delete dealToSubmit.CreatedBy;
                    dealToSubmit.UpdatedBy = userName;

                    // Ensure currency is clean and valid
                    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'];
                    const currentCurrency = String(dealToSubmit.currency || 'INR').trim().toUpperCase();
                    dealToSubmit.currency = validCurrencies.includes(currentCurrency) ? currentCurrency : 'INR';

                    const aid = getDealField(selectedDealDetails, "accountId") ?? selectedDealDetails.accountId;
                    if (aid != null && aid !== "") {
                      dealToSubmit.accountId = Number(aid);
                      const accLabel =
                        accountSearchTerm.trim() ||
                        resolveAccountDisplayName(selectedDealDetails, accountsList);
                      if (accLabel) dealToSubmit.accountName = accLabel;
                    } else {
                      dealToSubmit.accountId = null;
                      dealToSubmit.accountName = null;
                    }
                    const contactIds = getDealContactIds(selectedDealDetails);
                    if (contactIds.length > 0) {
                      const contactNames = contactIds
                        .map((id) => {
                          const picked = dealSlideContacts.find(
                            (c) => String(c.contactId ?? c.ContactId ?? c.id ?? c.Id) === String(id)
                          );
                          if (picked) return getContactDisplayName(picked);

                          const names = getDealContactNames(selectedDealDetails);
                          const index = contactIds.findIndex((contactId) => String(contactId) === String(id));
                          return names[index] || "";
                        })
                        .filter(Boolean);

                      dealToSubmit.contactIds = contactIds;
                      dealToSubmit.contactNames = contactNames;
                      dealToSubmit.contactId = contactIds[0];
                      dealToSubmit.contactName = contactNames.join(", ");
                    } else {
                      dealToSubmit.contactIds = [];
                      dealToSubmit.contactNames = [];
                      dealToSubmit.contactId = null;
                      dealToSubmit.contactName = null;
                    }
                    delete dealToSubmit.dealId; delete dealToSubmit.DealId; delete dealToSubmit.id; delete dealToSubmit.Id;
                    // Compute and attach INR base value for storage/reporting
                    try {
                      const entered = parseFloat(dealToSubmit.dealValue) || 0;
                      const rates = await fetchExchangeRates();
                      const curr = dealToSubmit.currency || 'INR';
                      const baseINR = curr === 'INR' ? round2(entered) : round2(entered / (rates[curr] || 1));
                      dealToSubmit.DealValueInINR = baseINR;
                      dealToSubmit.dealValueInINR = baseINR;
                      dealToSubmit.dealValueInBaseCurrency = baseINR;
                    } catch (ex) {
                      // ignore conversion errors
                    }
                    const res = await fetch(`/Deal/${dealId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dealToSubmit) });
                    if (res.ok) { fetchDeals(); if (onToast) onToast("Deal updated successfully", "success"); handleCloseDetails(); }
                    else { const errorData = await res.json(); if (onToast) onToast(`Failed to update deal: ${errorData?.title || "Unknown error"}`, "error"); }
                  } catch (err) { console.error(err); if (onToast) onToast("Error updating deal", "error"); }
                }}>

                  <div className="bg-white rounded-2xl p-6 border">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                      <label className="font-normal text-gray-900 text-md">Deal Stage</label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {dealStages.map((stage) => (
                        <button key={stage} type="button" className={["relative inline-flex items-center font-medium px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 text-sm", selectedDealDetails?.dealStage === stage ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105 ring-2 ring-blue-300" : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-blue-300 hover:shadow-md"].join(" ")} onClick={() => setSelectedDealDetails({ ...selectedDealDetails, dealStage: stage })}>
                          {selectedDealDetails?.dealStage === stage && (<svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>)}
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>

                  {detailsLoading && <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}
                  {detailsError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"><svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-red-700 font-medium">{detailsError}</p></div>}

                  {selectedDealDetails && (
                    <div className="bg-white rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                        <h3 className="font-normal text-gray-900 text-lg">Deal Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="flex flex-col gap-2 md:col-span-2"><label className="font-normal text-gray-700 text-sm">Deal Name</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter deal name" value={getDealField(selectedDealDetails, 'Name') || selectedDealDetails.dealName || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, name: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm flex items-center gap-2"><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Deal Value</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">{getCurrencySymbol(selectedDealDetails.currency || 'INR')}</span><input type="number" className="w-full rounded-xl pl-10 pr-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 font-normal" placeholder="Enter total price" value={selectedDealDetails.dealValue || selectedDealDetails.totalPrice || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, dealValue: e.target.value, dealValueInBaseCurrency: e.target.value })} /></div></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm flex items-center gap-2"><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Currency</label><div className="relative"><select className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer" value={selectedDealDetails.currency || "INR"} onChange={async (e) => { const newCurrency = e.target.value; const oldCurrency = selectedDealDetails.currency || 'INR'; if (newCurrency !== oldCurrency && selectedDealDetails.dealValue) { const convertedValue = await convertCurrency(parseFloat(selectedDealDetails.dealValue) || 0, oldCurrency, newCurrency); setSelectedDealDetails({ ...selectedDealDetails, currency: newCurrency, dealValue: convertedValue }); } else { setSelectedDealDetails({ ...selectedDealDetails, currency: newCurrency }); } }}><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="AUD">AUD ($)</option><option value="CAD">CAD ($)</option><option value="SGD">SGD ($)</option></select><svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm flex items-center gap-2"><svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>Account</label><div className="relative">
                          {(() => {
                            const displayAccountName = resolveAccountDisplayName(
                              selectedDealDetails,
                              accountsList
                            );
                            const accountInputValue = isAccountDropdownOpen
                              ? accountSearchTerm
                              : accountSearchTerm || displayAccountName || "";
                            return (
                              <>
                                <input
                                  type="text"
                                  placeholder="Search account..."
                                  value={accountInputValue}
                                  onFocus={() => {
                                    setAccountSearchTerm(
                                      accountSearchTerm || displayAccountName || ""
                                    );
                                    setIsAccountDropdownOpen(true);
                                  }}
                                  onBlur={() => setTimeout(() => setIsAccountDropdownOpen(false), 200)}
                                  onChange={e => {

                                    const value = e.target.value;

                                    setAccountSearchTerm(value);

                                    // user manually cleared account
                                    if (value.trim() === "") {

                                      setSelectedDealDetails(prev => ({
                                        ...prev,
                                        accountId: null,
                                        accountName: null,
                                        contactId: null,
                                        contactName: null,
                                        contactIds: [],
                                        contactNames: [],
                                      }));

                                      setContactSearchTerm("");
                                    }
                                  }}
                                  className="w-full rounded-xl px-4 py-3.5 pr-10 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                />
                                {(displayAccountName || accountSearchTerm) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDealDetails(prev => ({
                                        ...prev,
                                        accountId: null,
                                        accountName: null,
                                        contactId: null,
                                        contactName: null,
                                        contactIds: [],
                                        contactNames: [],
                                      }));
                                      setAccountSearchTerm("");
                                      setContactSearchTerm("");
                                      setIsAccountDropdownOpen(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            );
                          })()}
                          {isAccountDropdownOpen && (
                            <div className="absolute top-[110%] left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                              {accountSearchLoading ? (
                                <div className="px-4 py-3 text-gray-500 text-sm">Searching accounts…</div>
                              ) : accountSearchTerm.trim().length < 2 ? (
                                <div className="px-4 py-3 text-gray-500 text-sm">Type at least 2 characters to search accounts.</div>
                              ) : accountsList.length === 0 ? (
                                <div className="px-4 py-3 text-gray-400 text-sm italic">No accounts found...</div>
                              ) : (
                                accountsList.map((acc) => {
                                  const id = acc.accountId ?? acc.id ?? acc.AccountId ?? acc.Id ?? acc.id;
                                  const name = acc.name ?? acc.Name ?? String(id);
                                  return (
                                    <div
                                      key={id}
                                      onMouseDown={() => {
                                        setSelectedDealDetails((prev) => ({
                                          ...prev,
                                          accountId: id,
                                          accountName: name,
                                          contactId: null,
                                          contactName: null,
                                          contactIds: [],
                                          contactNames: [],
                                        }));
                                        setContactSearchTerm("");
                                        setAccountSearchTerm(name);
                                        setIsAccountDropdownOpen(false);
                                        setIsContactDropdownOpen(false);
                                      }}
                                      className="px-4 py-3 cursor-pointer hover:bg-blue-50 hover:text-blue-700 text-sm border-b last:border-none"
                                    >
                                      {name}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm flex items-center gap-2"><svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20h12a6 6 0 00-6-6 6 6 0 00-6 6z" /></svg>Contact</label><div className="relative">
                          {(() => {
                            const selectedContactIds = getDealContactIds(selectedDealDetails);
                            const selectedContactNames = getDealContactNames(selectedDealDetails);
                            const selectedContacts = selectedContactIds.map((id, index) => {
                              const contact = dealSlideContacts.find(con => String(con.contactId ?? con.id ?? con.ContactId ?? con.Id) === String(id));
                              return {
                                id,
                                name: contact ? getContactDisplayName(contact) : selectedContactNames[index] || `Contact ${id}`,
                              };
                            });
                            const selectedContactName = selectedContacts.map((contact) => contact.name).join(", ");
                            return (
                              <>
                                <input
                                  type="text"
                                  placeholder={selectedContacts.length > 0 ? "Search more contacts..." : "Search contacts..."}
                                  value={isContactDropdownOpen ? contactSearchTerm : selectedContactName}
                                  onFocus={() => {
                                    setContactSearchTerm("");
                                    setIsContactDropdownOpen(true);
                                  }}
                                  onBlur={() => setTimeout(() => setIsContactDropdownOpen(false), 200)}
                                  onChange={e => setContactSearchTerm(e.target.value)}
                                  className="w-full rounded-xl px-4 py-3.5 pr-10 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                                />
                                {/* {selectedContacts.length > 0 && (
                                  <button
                                    type="button"
                                    onMouseDown={() => {
                                      setSelectedDealDetails((prev) =>
                                        prev
                                          ? {
                                            ...prev,
                                            contactId: null,
                                            contactName: null,
                                            contactIds: [],
                                            contactNames: [],
                                          }
                                          : prev
                                      );
                                      setContactSearchTerm("");
                                      setIsContactDropdownOpen(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )} */}
                                {selectedContacts.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedContacts.map((contact) => (
                                      <span key={contact.id} className="inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-700">
                                        {contact.name}
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setSelectedDealDetails((prev) => {
                                              if (!prev) return prev;
                                              const nextContacts = selectedContacts.filter((item) => String(item.id) !== String(contact.id));
                                              return {
                                                ...prev,
                                                contactIds: nextContacts.map((item) => item.id),
                                                contactNames: nextContacts.map((item) => item.name),
                                                contactId: nextContacts[0]?.id ?? null,
                                                contactName: nextContacts.map((item) => item.name).join(", ") || null,
                                              };
                                            });
                                          }}
                                          className="text-blue-500 hover:text-blue-800"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {isContactDropdownOpen && (
                            <div className="absolute top-[110%] left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                              {!slideInAccountId ? (
                                <div className="px-4 py-3 text-gray-500 text-sm">Select an account to see contacts.</div>
                              ) : dealSlideContactsLoading ? (
                                <div className="px-4 py-3 text-gray-600 text-sm">Loading contacts…</div>
                              ) : dealSlideContacts.length === 0 ? (
                                <div className="px-4 py-3 text-gray-400 text-sm italic">No contacts found…</div>
                              ) : (
                                dealSlideContacts.map((con) => {
                                  const id = con.contactId ?? con.id ?? con.ContactId ?? con.Id;
                                  const name = getContactDisplayName(con);
                                  const selectedContactIds = getDealContactIds(selectedDealDetails);
                                  const isSelected = selectedContactIds.some((contactId) => String(contactId) === String(id));
                                  return (
                                    <div
                                      key={id}
                                      onMouseDown={() => {
                                        setSelectedDealDetails((prev) => {
                                          if (!prev) return prev;
                                          const current = getDealContactIds(prev);
                                          const currentNames = getDealContactNames(prev);
                                          const nextIds = isSelected
                                            ? current.filter((contactId) => String(contactId) !== String(id))
                                            : [...current, Number(id)];
                                          const nextNames = nextIds.map((contactId) => {
                                            if (String(contactId) === String(id)) return name;
                                            const index = current.findIndex((item) => String(item) === String(contactId));
                                            return currentNames[index] || `Contact ${contactId}`;
                                          });
                                          return {
                                            ...prev,
                                            contactIds: nextIds,
                                            contactNames: nextNames,
                                            contactId: nextIds[0] ?? null,
                                            contactName: nextNames.join(", ") || null,
                                          };
                                        });
                                        setContactSearchTerm("");
                                      }}
                                      className={`px-4 py-3 cursor-pointer hover:bg-blue-50 hover:text-blue-700 text-sm border-b last:border-none flex items-center justify-between gap-3 ${isSelected ? "bg-blue-50 text-blue-700" : ""}`}
                                    >
                                      <span>{name}</span>
                                      {isSelected && <span className="text-xs font-medium">Selected</span>}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div></div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Deal Type</label>
                            <div className="relative">
                              <select
                                className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer"
                                value={selectedDealDetails.type || ""}
                                onChange={(e) => setSelectedDealDetails({ ...selectedDealDetails, type: e.target.value })}
                              >
                                <option value="" disabled>Select Deal Type</option>
                                <option value="Software">Software</option>
                                <option value="Hardware">Hardware</option>
                                <option value="Service">Service</option>
                                <option value="Software/Hardware">Software/Hardware</option>

                              </select>
                              <svg
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          {/* <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Deal Pipeline</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter deal pipeline" value={selectedDealDetails.dealPipeline || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, dealPipeline: e.target.value })} /></div> */}
                          <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Deal Pipeline</label><div className="relative"><select className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer" value={selectedDealDetails?.dealPipeline || selectedDealDetails?.DealPipeline || "default pipeline"} onChange={(e) => setSelectedDealDetails({ ...selectedDealDetails, dealPipeline: e.target.value })}><option value="default pipeline">Default Pipeline</option><option value="Hardware Product Sale">Hardware Product Sale</option><option value="Software Product Sale">Software Product Sale</option><option value="Software/Hardware Pipeline">Software/Hardware Pipeline</option></select><svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div></div>
                          <div className="md:col-span-2 bg-blue-50 rounded-xl p-4 border-2 border-blue-200 space-y-3">
                            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><label className="font-semibold text-gray-800 text-sm">Products</label>{selectedProducts && selectedProducts.length > 0 && (<span className="text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium">{selectedProducts.length} product(s)</span>)}</div></div>
                            <div className="bg-white p-3 rounded border border-blue-300 space-y-2"><label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Add Product</label><div className="flex gap-2"><select id="slideinProductSelect" className="flex-1 rounded-lg px-3 py-2 border border-gray-300 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" defaultValue=""><option value="">Select product to add</option>{(Array.isArray(productsList) ? productsList : []).map((p) => { const name = p?.name || p?.Name || ""; const isSelected = Array.isArray(selectedProducts) && selectedProducts.some(sp => sp.name === name); return (<option key={name} value={name} disabled={isSelected}>{name} {isSelected ? "(added)" : ""}</option>); })}</select><button type="button" onClick={() => { const select = document.getElementById("slideinProductSelect"); const name = select.value; if (!name || (Array.isArray(selectedProducts) && selectedProducts.some(sp => sp.name === name))) { return; } const prod = (Array.isArray(productsList) ? productsList : []).find(p => (p?.name || p?.Name) === name); const cat = prod ? (prod?.category || prod?.Category || "") : ""; setSelectedProducts([...(selectedProducts || []), { name, category: cat }]); select.value = ""; }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors font-medium">+ Add</button></div></div>
                            {selectedProducts && selectedProducts.length > 0 && (<div className="bg-white p-3 rounded border border-blue-300 space-y-2"><label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Products in Deal</label><div className="space-y-2 max-h-48 overflow-y-auto">{selectedProducts.map((prod, idx) => (<div key={idx} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded border border-orange-200 group hover:border-orange-300 transition-all"><div className="flex-1"><p className="text-sm font-medium text-gray-800">{prod.name}</p><p className="text-xs text-gray-500">{prod.category || "Uncategorized"}</p></div><button type="button" onClick={() => { setSelectedProducts((selectedProducts || []).filter((_, i) => i !== idx)); }} className="ml-2 px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Remove</button></div>))}</div></div>)}
                            {(!selectedProducts || selectedProducts.length === 0) && (<div className="text-center py-3 bg-white rounded border border-dashed border-blue-300"><p className="text-xs text-gray-500 font-medium">No products added yet</p></div>)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Deal Source</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter deal source" value={selectedDealDetails.source || selectedDealDetails.dealSource || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, source: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Territory</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter territory" value={selectedDealDetails.territory || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, territory: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Deal Age (Days)</label><input type="number" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter deal age in days" value={selectedDealDetails.ageInDays || selectedDealDetails.dealAgeInDays || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, ageInDays: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Sales Owner</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter sales owner" value={selectedDealDetails.salesOwner || selectedDealDetails.dealSalesOwner || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, salesOwner: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Campaign</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter campaign" value={selectedDealDetails.campaign || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, campaign: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Probability (%)</label><input type="number" min="0" max="100" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="0-100" value={selectedDealDetails.probability || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, probability: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Expected Close Date</label><input type="date" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" value={formatDateOnly(selectedDealDetails.expectedCloseDate || "")} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, expectedCloseDate: e.target.value ? dateToISOLocal(e.target.value) : "" })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Closed Date</label><input type="date" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" value={formatDateOnly(selectedDealDetails.closedDate || "")} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, closedDate: e.target.value ? dateToISOLocal(e.target.value) : "" })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Payment Status</label><div className="relative"><select className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer" value={selectedDealDetails.paymentStatus || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, paymentStatus: e.target.value })}><option value="">Select Status</option><option value="Pending">Pending</option><option value="Partial">Partial</option><option value="Completed">Completed</option><option value="Failed">Failed</option></select><svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Lost Reason {selectedDealDetails.dealStage === "Lost" && <span className="text-red-500">*</span>}</label><input type="text" className={`w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 ${selectedDealDetails.dealStage === "Lost" && !String(selectedDealDetails.lostReason || "").trim() ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"}`} placeholder="Enter reason if deal was lost" value={selectedDealDetails.lostReason || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, lostReason: e.target.value })} />{selectedDealDetails.dealStage === "Lost" && !String(selectedDealDetails.lostReason || "").trim() && <p className="text-red-500 text-xs">Lost Reason is required for Lost deals.</p>}</div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Won Reasons {selectedDealDetails.dealStage === "Won" && <span className="text-red-500">*</span>}</label><input type="text" className={`w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 ${selectedDealDetails.dealStage === "Won" && !String(selectedDealDetails.wonReasons || "").trim() ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"}`} placeholder="Enter reason if deal was won" value={selectedDealDetails.wonReasons || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, wonReasons: e.target.value })} />{selectedDealDetails.dealStage === "Won" && !String(selectedDealDetails.wonReasons || "").trim() && <p className="text-red-500 text-xs">Won Reasons is required for Won deals.</p>}</div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Forecast Category</label><div className="relative"><select className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer" value={selectedDealDetails.forecastCategory || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, forecastCategory: e.target.value })}><option value="">Select Category</option><option value="Pipeline">Pipeline</option><option value="BestCase">Best Case</option><option value="Likely">Likely</option><option value="Commit">Commit</option></select><svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Enquiry Number</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter enquiry number" value={selectedDealDetails.enquiryNumber || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, enquiryNumber: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Import ID</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter import ID" value={selectedDealDetails.importId || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, importId: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Tags</label><input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter tags" value={selectedDealDetails.tags || selectedDealDetails.dealTags || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, tags: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Created By</label><input type="text" disabled className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 opacity-60 cursor-not-allowed" value={selectedDealDetails?.createdBy || selectedDealDetails?.CreatedBy || "Unknown"} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Updated By</label><input type="text" disabled className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 opacity-60 cursor-not-allowed" value={selectedDealDetails?.updatedBy || selectedDealDetails?.UpdatedBy || "Not Updated"} /></div>
                        <div className="flex flex-col gap-2 md:col-span-2"><label className="font-normal text-gray-700 text-sm">Recent Note</label><AutoGrowTextarea minRows={4} className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" placeholder="Enter recent note" value={selectedDealDetails.recentNote || selectedDealDetails.dealRecentNote || ""} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, recentNote: e.target.value })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Created At</label><input type="date" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" value={formatDateOnly(getDealField(selectedDealDetails, 'CreatedAt') || "")} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, DealCreatedAt: e.target.value ? dateToISOLocal(e.target.value) : "" })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">Updated At</label><input type="date" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" value={formatDateOnly(getDealField(selectedDealDetails, 'UpdatedAt') || "")} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, DealUpdatedAt: e.target.value ? dateToISOLocal(e.target.value) : "" })} /></div>
                        <div className="flex flex-col gap-2"><label className="font-normal text-gray-700 text-sm">First Assigned At</label><input type="date" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150" value={formatDateOnly(getDealField(selectedDealDetails, 'FirstAssignedAt') || "")} onChange={e => setSelectedDealDetails({ ...selectedDealDetails, DealFirstAssignedAt: e.target.value ? dateToISOLocal(e.target.value) : "" })} /></div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-3 pt-6 border-t-2 border-gray-200 mt-8 bg-white/50 backdrop-blur-sm rounded-xl p-6 -mx-2">
                    {/* Delete — Admin only */}
                    {isAdmin && !isManager && (
                      <button type="button" className="px-5 py-3 rounded-xl border-2 border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-600 font-normal transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md" onClick={() => { if (selectedDealDetails) { setDeleteDealId(getDealField(selectedDealDetails, 'Id') ?? null); setDeleteDealName(getDealField(selectedDealDetails, 'Name') || getDealField(selectedDealDetails, 'Id') || ""); setShowDeleteModal(true); } }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> Delete Deal
                      </button>
                    )}
                    {/* Save Changes — visible to admins/managers + the deal's creator */}
                    {canEditDeal(selectedDealDetails) ? (
                      <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-normal shadow-sm hover:shadow-xl transition-all duration-200 flex items-center gap-2 transform hover:scale-105 ml-auto">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Save Changes
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400 ml-auto italic">View-only — you can only edit deals you created.</p>
                    )}
                  </div>
                </form>

                {showNotesPanel && selectedDealDetails && (
                  <div className="absolute top-0 right-0 z-40 h-full w-[30%] bg-white border-l border-gray-200 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-slate-50">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Deal Notes</h3>
                        <p className="text-sm text-gray-500">All notes for this deal</p>
                      </div>
                      <button type="button" className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition" onClick={() => setShowNotesPanel(false)}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="p-6 h-full overflow-y-auto space-y-4">
                      <div className="flex justify-between items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Notes</p>
                          <p className="text-xs text-gray-500">{dealNotes.length} note{dealNotes.length === 1 ? "" : "s"}</p>
                        </div>
                        <button type="button" onClick={() => setShowAddNoteBox(!showAddNoteBox)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition">
                          {showAddNoteBox ? "Cancel" : "+ Add Note"}
                        </button>
                      </div>

                      {showAddNoteBox && (
                        <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          {noteDestinationChecklist}
                          <AutoGrowTextarea
                            minRows={3}
                            placeholder="Write note..."
                            value={newDealNote}
                            onChange={(e) => setNewDealNote(e.target.value)}
                            className="w-full rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none px-3 py-2"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveDealNote}
                              className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm"
                            >
                              Save Note
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddNoteBox(false);
                                setNewDealNote("");
                                setNoteContactSelections(new Set());
                                setNoteDealOnlySelected(false);
                                setNoteDestinationError("");
                              }}
                              className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {notesLoading ? (
                          <div className="text-sm text-gray-500 py-4">Loading notes...</div>
                        ) : dealNotes.length > 0 ? (
                          dealNotes.map((note, index) => (
                            <div key={note.id || note.Id || index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex justify-between gap-3">
                                <div className="space-y-2">
                                  {editingNoteId === (note.id || note.Id) ? (
                                    <AutoGrowTextarea minRows={3} value={editingNoteText} onChange={(e) => setEditingNoteText(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                                  ) : (
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-6">{note.description || note.Description}</p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                  {editingNoteId === (note.id || note.Id) ? (
                                    <>
                                      <button type="button" onClick={() => handleUpdateNote(note)} className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white">Save</button>
                                      <button type="button" onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }} className="text-xs px-3 py-1 rounded-lg bg-gray-200 text-gray-700">Cancel</button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" onClick={() => { setEditingNoteId(note.id || note.Id); setEditingNoteText(note.description || note.Description || ""); }} className="text-xs px-3 py-1 rounded-lg bg-yellow-100 text-yellow-700">Edit</button>
                                      {isAdmin && <button type="button" onClick={() => { setDeleteDealId(note.id || note.Id); setDeleteDealName("this note"); setShowDeleteModal(true); }} className="text-xs px-3 py-1 rounded-lg bg-red-100 text-red-700">Delete</button>}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                                <span>{note.createdBy || note.CreatedBy || ""}</span>
                                <span>{note.createdAt || note.CreatedAt ? formatDateOnly(note.createdAt || note.CreatedAt) : ""}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 border border-dashed rounded-2xl bg-white text-sm text-gray-400">
                            No notes added yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Deals;