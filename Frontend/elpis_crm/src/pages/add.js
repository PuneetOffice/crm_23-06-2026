import React, { useState, useEffect, useMemo, useRef } from "react";
import { Country, State, City } from "country-state-city";
import { isRequired, isNumber } from "../utils/validation";
import apiClient from "../api/client";
import { searchAccounts, searchContacts, searchContactsByAccount } from "../api/entitySearch";
import { fetchExchangeRates, round2, cleanCurrencyValue } from "../utils/currency";

// ============ MODERN REUSABLE COMPONENTS ============

const FormInput = ({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  readOnly = false,
  defaultValue,
  step,
  error,
  className = "",
}) => (
  <div className="space-y-1.5">
    {label && (
      <label className="text-label block">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      defaultValue={defaultValue}
      step={step}
      className={`w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-slate-300 ${disabled ? "bg-slate-50 cursor-not-allowed text-slate-500" : ""
        } ${error ? "border-red-500 focus:ring-red-500" : ""} ${className}`}
    />
    {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
  </div>
);

const FormSelect = ({
  label,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  defaultValue,
  error,
  children,
  className = "",
}) => (
  <div className="space-y-1.5">
    {label && (
      <label className="text-label block">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    <select
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      defaultValue={defaultValue}
      className={`w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-sm text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-slate-300 ${disabled ? "bg-slate-50 cursor-not-allowed text-slate-500" : ""
        } ${error ? "border-red-500 focus:ring-red-500" : ""} ${className}`}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
  </div>
);

// Textarea that grows with its content instead of scrolling. Height follows the
// text: it expands as you type and shrinks when text is removed, never going
// below the initial `rows` height and never clipping the last line.
const AutoGrowTextarea = ({ value, rows = 3, className = "", ...props }) => {
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
    // Capture the natural height of `rows` rows once, to use as the floor.
    if (el && !minHeightRef.current) minHeightRef.current = el.offsetHeight;
    resize(el);
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      onInput={(e) => resize(e.target)}
      className={`resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
};

const FormTextarea = ({
  label,
  name,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  defaultValue,
  error,
  rows = 3,
  className = "",
}) => (
  <div className="space-y-1.5">
    {label && (
      <label className="text-label block">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    <AutoGrowTextarea
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      defaultValue={defaultValue}
      rows={rows}
      className={`w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-slate-300 ${disabled ? "bg-slate-50 cursor-not-allowed text-slate-500" : ""
        } ${error ? "border-red-500 focus:ring-red-500" : ""} ${className}`}
    />
    {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
  </div>
);

const FormSection = ({
  title,
  icon: Icon,
  id,
  isExpanded,
  onToggle,
  children,
}) => (
  <div className="border border-gray-200 rounded-xl overflow-visible bg-white hover:shadow-sm transition-shadow duration-200">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="w-full px-5 py-3 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors duration-200 group"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors flex-shrink-0">
            {Icon}
          </div>
        )}
        <h3 className="title-h4 font-medium text-gray-900">{title}</h3>
      </div>
      <svg
        className={`w-5 h-5 text-gray-600 transform transition-all duration-300 flex-shrink-0 ${isExpanded ? "rotate-180" : ""
          }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    </button>
    {isExpanded && (
      <div className="px-5 py-4 border-t border-gray-100 bg-white space-y-4 animate-in fade-in duration-200">
        {children}
      </div>
    )}
  </div>
);

// ============ MAIN COMPONENT ============

function AddForms({
  type,
  accounts,
  contacts,
  products,
  deals,
  onSuccess,
  onError,
  dealPrefill,
}) {
  // ============ STATE ============
  // Countries/states/cities for contacts form
  const [contactCountry, setContactCountry] = useState("");
  const [contactState, setContactState] = useState("");
  // Countries/states/cities for accounts form
  const [accountCountry, setAccountCountry] = useState("");
  const [accountState, setAccountState] = useState("");
  const allCountries = Country.getAllCountries();

  // Loading/saving states for async operations
  const [isSaving, setIsSaving] = useState(false);
  // read logged-in user's name from localStorage (set at login)
  const savedUserName = (() => {
    try {
      return localStorage.getItem("userName") || "";
    } catch (e) {
      return "";
    }
  })();
  // Exchange rates TO INR (fetched live; fallback if API fails)
  const [currencyRatesToINR, setCurrencyRatesToINR] = useState({
    INR: 1,
    USD: 83,
    EUR: 90,
    GBP: 105,
    AED: 23,
  });

  // Load exchange rates once on mount
  useEffect(() => {
    let cancelled = false;
    let mounted = true;
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch("https://api.exchangerate-api.com/v4/latest/INR", {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error("Failed to fetch exchange rates");
        const data = await resp.json();
        // API returns INR base: rates[currency] = 1 INR in currency
        // We need TO INR: 1 currency => INR => 1 / rates[currency]
        const rates = data?.rates || {};
        const toINR = { INR: 1 };
        Object.keys(rates).forEach((cur) => {
          const v = rates[cur];
          if (cur === "INR") return;
          if (typeof v === "number" && Number.isFinite(v) && v > 0) {
            toINR[cur] = Math.round((1 / v) * 100) / 100;
          }
        });
        if (!cancelled && mounted) {
          setCurrencyRatesToINR((prev) => ({ ...prev, ...toINR }));
        }
      } catch (e) {
        // keep fallback values already in state
        if (!cancelled) console.warn("Using fallback exchange rates:", e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
      mounted = false;
    };
  }, []);

  const [dealCurrency, setDealCurrency] = useState("INR");
  // Product amount input and currency for products form
  const [productAmount, setProductAmount] = useState("");
  const [productCurrency, setProductCurrency] = useState("INR");
  // Deal total input for live conversions
  const [dealAmount, setDealAmount] = useState("");
  // Product fields for deals form - NOW SUPPORTS MULTIPLE PRODUCTS
  const [showProductFields, setShowProductFields] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]); // Array of { name, category }
  const [dealErrors, setDealErrors] = useState({});
  // State for collapsible sections (ALL FORMS)
  const [expandedSectionsContact, setExpandedSectionsContact] = useState({
    personal: true,
    contact: true,
    location: false,
    organization: false,
    marketing: false,
    additional: false,
  });
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    location: true,
    business: false,
    social: false,
    ownership: false,
    activity: false,
    sequences: false,
    metadata: false,
  });
  const [expandedSectionsDeal, setExpandedSectionsDeal] = useState({
    account: true,
    dealinfo: true,
    products: false,
    business: false,
    additional: false,
  });

  // State for account/contact lookup fields (to allow searching/filtering in dropdowns)
  const [accountSearch, setAccountSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showAccounts, setShowAccounts] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [selectedContactNames, setSelectedContactNames] = useState([]);
  /** Account rows from typeahead API (+ optional parent `accounts` merge on submit) */
  const [accountPickerRows, setAccountPickerRows] = useState([]);
  const [accountPickerLoading, setAccountPickerLoading] = useState(false);
  /** Contact rows: global search or account-scoped API */
  const [contactPickerRows, setContactPickerRows] = useState([]);
  const [accountContactsLoading, setAccountContactsLoading] = useState(false);
  const accountRef = useRef(null);
  const contactRef = useRef(null);

  const getContactDisplayName = (contact) => {
    if (!contact) return "";
    const id = contact?.ContactId ?? contact?.contactId ?? contact?.Id ?? contact?.id;
    const first = String(contact?.FirstName ?? contact?.firstName ?? "").trim();
    const last = String(contact?.LastName ?? contact?.lastName ?? "").trim();
    return `${first} ${last}`.trim() || String(contact?.Name ?? contact?.name ?? `Contact ${id}`);
  };

  const syncSelectedContactState = (contactsToKeep) => {
    const ids = contactsToKeep.map((item) => String(item.id));
    const names = contactsToKeep.map((item) => item.name);
    setSelectedContactIds(ids);
    setSelectedContactNames(names);
    setSelectedContactId(ids[0] || "");
    setContactSearch(names.join(", "));
  };

  useEffect(() => {
    if (type !== "deals" || !dealPrefill) return;

    if (dealPrefill.accountId) {
      setSelectedAccountId(String(dealPrefill.accountId));
      setAccountSearch(dealPrefill.accountName || "");
    } else if (dealPrefill.accountName) {
      setAccountSearch(dealPrefill.accountName);
      setSelectedAccountId("");
    }

    if (dealPrefill.contactId) {
      syncSelectedContactState([{
        id: dealPrefill.contactId,
        name: dealPrefill.contactName || `Contact ${dealPrefill.contactId}`,
      }]);
    } else if (dealPrefill.contactName) {
      setContactSearch(dealPrefill.contactName);
      setSelectedContactId("");
      setSelectedContactIds([]);
      setSelectedContactNames([]);
    }

    setShowAccounts(false);
    setShowContacts(false);
  }, [dealPrefill, type]);

  // ============ FORM FIELD STATE - PREVENTS DATA LOSS WHEN SECTIONS COLLAPSE ============

  // Contact form fields state
  const [contactFormData, setContactFormData] = useState({
    FirstName: "",
    LastName: "",
    JobTitle: "",
    WorkEmail: "",
    Email: "",
    WorkPhone: "",
    Mobile: "",
    LinkedIn: "",
    Facebook: "",
    Twitter: "",
    Phone: "",
    Address: "",
    Country: "",
    State: "",
    City: "",
    Zipcode: "",
    TimeZone: "",
    Locale: "",
    SalesOwner: "",
    Status: "",
    LifeCycleStage: "",
    Territory: "",
    Source: "",
    Campaign: "",
    CustomerFit: "",
    Score: "",
    SubscriptionStatus: "",
    UnsubscribeReason: "",
    OtherUnsubscribeReasons: "",
    WhatsAppSubscriptionStatus: "",
    SMSSubscriptionStatus: "",
    Tags: "",
    Medium: "",
    Keyword: "",
    LostReason: "",
    OriginalCampaign: "",
    OriginalMedium: "",
    OriginalSource: "",
    CreatedThroughCampaign: "",
    CreatedFromMedium: "",
    CreatedFromSource: "",
    MostRecentCampaign: "",
    MostRecentMedium: "",
    MostRecentSource: "",
    ExternalID: "",
    WebForms: "",
    ImportID: "",
    Account: "",
  });

  // Account form fields state
  const [accountFormData, setAccountFormData] = useState({
    Name: "",
    IndustryType: "",
    BusinessType: "",
    Territory: "",
    Website: "",
    Phone: "",
    DisplayPhone: "",
    Country: "",
    State: "",
    City: "",
    Zipcode: "",
    Address: "",
    NumberOfEmployees: "",
    AnnualRevenue: "",
    SalesOwner: "",
    ParentAccount: "",
    Facebook: "",
    Twitter: "",
    LinkedIn: "",
    LastContactedMode: "",
    LastActivityType: "",
    RecentNote: "",
    ActiveSalesSequences: "",
    CompletedSalesSequences: "",
    Tags: "",
    ImportID: "",
  });

  // Deal form fields state
  const [dealFormData, setDealFormData] = useState({
    DealName: "",
    DealType: "",
    DealPipeline: "",
    DealStage: "",
    ExpectedDealValue: "",
    DealSource: "",
    Territory: "",
    Campaign: "",
    Probability: "",
    ForecastCategory: "",
    ExpectedCloseDate: "",
    ClosedDate: "",
    PaymentStatus: "",
    SalesOwner: "",
    SalesOwnerId: "",
    Tags: "",
    RecentNote: "",
    LostReason: "",
    ImportID: "",
    WebForm: "",
    UpcomingActivities: "",
    DealAgeInDays: "",
    LastActivityType: "",
    LastActivityDate: "",
    LastContactedMode: "",
    LastContactedTime: "",
  });

  // Product form fields state
  const [productFormData, setProductFormData] = useState({
    Name: "",
    Category: "",
    Active: "Yes",
    BaseCurrencyAmount: "",
  });

  // Helper function to update contact form fields
  const updateContactField = (fieldName, value) => {
    setContactFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Helper function to update account form fields
  const updateAccountField = (fieldName, value) => {
    setAccountFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Helper function to update deal form fields
  const updateDealField = (fieldName, value) => {
    setDealFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Helper function to update product form fields
  const updateProductField = (fieldName, value) => {
    setProductFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const [debouncedAccountSearch, setDebouncedAccountSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAccountSearch(accountSearch), 350);
    return () => clearTimeout(t);
  }, [accountSearch]);

  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContactSearch(contactSearch), 350);
    return () => clearTimeout(t);
  }, [contactSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = debouncedAccountSearch.trim();
      if (q.length < 2) {
        setAccountPickerRows([]);
        setAccountPickerLoading(false);
        return;
      }
      setAccountPickerLoading(true);
      try {
        const rows = await searchAccounts(q, 60);
        if (!cancelled) setAccountPickerRows(rows);
      } catch {
        if (!cancelled) setAccountPickerRows([]);
      } finally {
        if (!cancelled) setAccountPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedAccountSearch]);

  useEffect(() => {
    if (!selectedAccountId || Number.isNaN(Number(selectedAccountId))) {
      setContactPickerRows([]);
      setAccountContactsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setAccountContactsLoading(true);
      try {
        const rows = await searchContactsByAccount(
          selectedAccountId,
          debouncedContactSearch,
          300
        );
        if (!cancelled) setContactPickerRows(rows);
      } catch {
        if (!cancelled) setContactPickerRows([]);
      } finally {
        if (!cancelled) setAccountContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, debouncedContactSearch]);

  useEffect(() => {
    if (selectedAccountId) return;
    let cancelled = false;
    (async () => {
      const q = debouncedContactSearch.trim();
      if (q.length < 2) {
        setContactPickerRows([]);
        return;
      }
      setAccountContactsLoading(true);
      try {
        const rows = await searchContacts(q, 60);
        if (!cancelled) setContactPickerRows(rows);
      } catch {
        if (!cancelled) setContactPickerRows([]);
      } finally {
        if (!cancelled) setAccountContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedContactSearch, selectedAccountId]);

  const mergedAccountsForLookup = useMemo(() => {
    const a = Array.isArray(accounts) ? accounts : [];
    const byId = new Map();
    [...a, ...accountPickerRows].forEach((row) => {
      const id = row?.AccountId ?? row?.accountId ?? row?.Id ?? row?.id;
      if (id != null && id !== "") byId.set(String(id), row);
    });
    return Array.from(byId.values());
  }, [accounts, accountPickerRows]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target)
      ) {
        setShowAccounts(false);
      }

      if (
        contactRef.current &&
        !contactRef.current.contains(event.target)
      ) {
        setShowContacts(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset contact selection when account changes
  useEffect(() => {
    setSelectedContactId("");
    setContactSearch("");
  }, [selectedAccountId]);
  // ============ BUSINESS CARD UPLOAD STATE (Now handled by BusinessCardUpload component) ============
  // Kept for component prop callbacks below - use these to set form state from BusinessCardUpload

  // State callbacks are passed to BusinessCardUpload component for field population

  const previousAccountId = useRef("");
useEffect(() => {
  // Ignore initial load/prefill
  if (previousAccountId.current === "") {
    previousAccountId.current = selectedAccountId;
    return;
  }
 
  // Only clear when user actually changes account
  if (previousAccountId.current !== selectedAccountId) {
    setSelectedContactId("");
    setContactSearch("");
    previousAccountId.current = selectedAccountId;
  }
}, [selectedAccountId]);

  if (type === "contacts") {
    const toggleSectionContact = (section) => {
      setExpandedSectionsContact(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Prevent multiple submissions
          if (isSaving) return;
          setIsSaving(true);

          // Helper to convert PascalCase to camelCase
          function toCamelCase(str) {
            return str.charAt(0).toLowerCase() + str.slice(1);
          }
          // Only include user-editable fields for insert (do NOT send ContactId or system-managed fields)
          const fields = [
            "FirstName", "LastName", "JobTitle", "WorkEmail", "Email", "WorkPhone", "Mobile", "LinkedIn", "Facebook", "Twitter", "Phone", "Address", "Country", "State", "City", "Zipcode", "TimeZone", "Locale", "SalesOwner", "Status", "LifeCycleStage", "Territory", "Source", "Campaign", "CustomerFit", "Score", "SubscriptionStatus", "UnsubscribeReason", "OtherUnsubscribeReasons", "WhatsAppSubscriptionStatus", "SMSSubscriptionStatus", "Tags", "Medium", "Keyword", "LostReason", "OriginalCampaign", "OriginalMedium", "OriginalSource", "CreatedThroughCampaign", "CreatedFromMedium", "CreatedFromSource", "MostRecentCampaign", "MostRecentMedium", "MostRecentSource", "ExternalID", "WebForms", "ImportID"
          ];
          // Numeric fields that need type conversion
          const numericFields = ["Score", "TotalChatSessions", "ActiveSalesSequences", "CompletedSalesSequences"];
          const newContact = {};
          const dateFields = []; // All system-managed date fields handled by backend
          fields.forEach((key) => {
            // Read from contactFormData state instead of DOM elements
            let val = contactFormData[key] || "";

            // Skip empty values to keep payload clean
            if (!val || (typeof val === 'string' && val.trim() === "")) return;

            // If this is a date field and empty, omit it so DB default applies
            if (dateFields.includes(key)) {
              return;
            }

            // Convert numeric fields to actual numbers
            if (numericFields.includes(key)) {
              val = Number(val);
              if (isNaN(val)) return; // Skip if conversion fails
            }

            newContact[toCamelCase(key)] = val;
          });
          // Account: persist both ID and name (DB FK + display). Send PascalCase + camelCase so binding always works.
          const accIdVal = selectedAccountId ? Number(selectedAccountId) : NaN;
          const hasValidAccountId = Number.isFinite(accIdVal) && accIdVal > 0;
          const accObj =
            hasValidAccountId && mergedAccountsForLookup.length
              ? mergedAccountsForLookup.find((a) => {
                  const id = a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
                  return String(id) === String(selectedAccountId);
                })
              : null;
          const accName =
            (accObj && (accObj.Name ?? accObj.name ?? "")) ||
            (contactFormData.Account && String(contactFormData.Account).trim()) ||
            "";
          if (hasValidAccountId) {
            newContact.AccountId = accIdVal;
            newContact.accountId = accIdVal;
            if (accName) {
              newContact.Account = accName;
              newContact.account = accName;
            }
          } else if (accName) {
            newContact.Account = accName;
            newContact.account = accName;
          }
          // Set audit fields to logged-in user
          newContact.createdBy = savedUserName || "Unknown";
          newContact.updatedBy = savedUserName || "Unknown";
          try {
            await apiClient.post(`/Contact`, newContact, {
              headers: { "Content-Type": "application/json" },
            });
            // Dispatch event to notify other components to refetch
            window.dispatchEvent(new CustomEvent('contactAdded'));
            if (onSuccess) onSuccess();
            // Reset form state instead of form element
            setContactFormData({
              FirstName: "",
              LastName: "",
              JobTitle: "",
              WorkEmail: "",
              Email: "",
              WorkPhone: "",
              Mobile: "",
              LinkedIn: "",
              Facebook: "",
              Twitter: "",
              Phone: "",
              Address: "",
              Country: "",
              State: "",
              City: "",
              Zipcode: "",
              TimeZone: "",
              Locale: "",
              SalesOwner: "",
              Status: "",
              LifeCycleStage: "",
              Territory: "",
              Source: "",
              Campaign: "",
              CustomerFit: "",
              Score: "",
              SubscriptionStatus: "",
              UnsubscribeReason: "",
              OtherUnsubscribeReasons: "",
              WhatsAppSubscriptionStatus: "",
              SMSSubscriptionStatus: "",
              Tags: "",
              Medium: "",
              Keyword: "",
              LostReason: "",
              OriginalCampaign: "",
              OriginalMedium: "",
              OriginalSource: "",
              CreatedThroughCampaign: "",
              CreatedFromMedium: "",
              CreatedFromSource: "",
              MostRecentCampaign: "",
              MostRecentMedium: "",
              MostRecentSource: "",
              ExternalID: "",
              WebForms: "",
              ImportID: "",
              Account: "",
            });
            setContactCountry("");
            setContactState("");
            setAccountSearch("");
            setSelectedAccountId("");
            setAccountPickerRows([]);
            setContactPickerRows([]);
            // Try to refetch dashboard state
            try {
              if (window.refetchContacts) {
                window.refetchContacts();
              }
            } catch (refetchErr) {
              console.warn("Contact added, but failed to refetch dashboard state:", refetchErr);
            }
          } catch (err) {
            let msg = "Failed to add contact.";
            if (err.response) {
              msg += `\nStatus: ${err.response.status}`;
              if (err.response.data) {
                if (typeof err.response.data === "string") {
                  msg += `\nResponse: ${err.response.data}`;
                } else if (typeof err.response.data === "object") {
                  msg += `\nResponse: ${JSON.stringify(err.response.data)}`;
                }
              }
            } else if (err.message) {
              msg += `\nError: ${err.message}`;
            }
            alert(msg);
            if (onError) onError(msg);
          } finally {
            setIsSaving(false);
          }
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {(() => {
            const renderField = (col) => {
              if (col.key === "Address" || col.key === "Tags" || col.key === "WebForms" || col.key === "OtherUnsubscribeReasons") {
                return (
                  <FormTextarea
                    name={col.key}
                    label={col.label}
                    placeholder={col.label}
                    rows={3}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "Score" || col.key === "TotalChatSessions" || col.key === "ActiveSalesSequences" || col.key === "CompletedSalesSequences") {
                return (
                  <FormInput
                    name={col.key}
                    type="number"
                    label={col.label}
                    placeholder={col.label}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "WorkPhone" || col.key === "Mobile" || col.key === "Phone") {
                return (
                  <FormInput
                    name={col.key}
                    type="tel"
                    label={col.label}
                    placeholder={col.label}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "WorkEmail" || col.key === "Email") {
                return (
                  <FormInput
                    name={col.key}
                    type="email"
                    label={col.label}
                    placeholder={col.label}
                    required={true}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "Facebook" || col.key === "Twitter" || col.key === "LinkedIn") {
                return (
                  <FormInput
                    name={col.key}
                    type="url"
                    label={col.label}
                    placeholder={col.label}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "Country") {
                return (
                  <FormSelect
                    name={col.key}
                    label={col.label}
                    value={contactCountry}
                    onChange={(e) => {
                      setContactCountry(e.target.value);
                      updateContactField(col.key, e.target.value);
                    }}
                  >
                    <option value="">Select country</option>
                    {allCountries.map((c) => (
                      <option key={c.isoCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </FormSelect>
                );
              } else if (col.key === "State") {
                const countryIso = allCountries.find((c) => c.name === contactCountry)?.isoCode;
                const states = countryIso ? State.getStatesOfCountry(countryIso) : [];
                return (
                  <FormSelect
                    name={col.key}
                    label={col.label}
                    value={contactState}
                    onChange={(e) => {
                      setContactState(e.target.value);
                      updateContactField(col.key, e.target.value);
                    }}
                    disabled={!countryIso}
                  >
                    <option value="">Select state</option>
                    {states.map((s) => (
                      <option key={s.isoCode} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </FormSelect>
                );
              } else if (col.key === "City") {
                const countryIso = allCountries.find((c) => c.name === contactCountry)?.isoCode;
                const states = countryIso ? State.getStatesOfCountry(countryIso) : [];
                const stateIso = states.find((s) => s.name === contactState)?.isoCode;
                const cities = countryIso && stateIso ? City.getCitiesOfState(countryIso, stateIso) : [];
                return (
                  <FormSelect
                    name={col.key}
                    label={col.label}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                    disabled={!stateIso}
                  >
                    <option value="">Select city</option>
                    {cities.map((c) => (
                      <option key={`${c.name}-${c.latitude}`} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </FormSelect>
                );
              } else if (col.key === "Account") {
                // Searchable account dropdown
                return (
                  <div ref={accountRef} className="relative space-y-1.5">
                    <label className="text-label block">{col.label}</label>
                    <input
                      type="text"
                      value={accountSearch}
                      placeholder="Search account..."
                      onChange={(e) => {
                        setAccountSearch(e.target.value);
                        setSelectedAccountId("");
                        setShowAccounts(true);
                      }}
                      onFocus={() => setShowAccounts(true)}
                      className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input type="hidden" name="Account" value={selectedAccountId} />
                    {showAccounts && (
                      <div className="absolute z-[9999] w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1">
                        {accountPickerLoading ? (
                          <div className="px-4 py-3 text-sm text-gray-500">Searching accounts…</div>
                        ) : accountSearch.trim().length < 2 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">Type at least 2 characters to search all accounts.</div>
                        ) : accountPickerRows.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400">No accounts found.</div>
                        ) : (
                          accountPickerRows.map((a) => {
                            const id = a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
                            const name = a?.Name ?? a?.name ?? String(id);
                            return (
                              <div
                                key={String(id)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedAccountId(String(id));
                                  setAccountSearch(name);
                                  updateContactField("Account", name);
                                  setShowAccounts(false);
                                }}
                                className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700"
                              >
                                {name}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <FormInput
                    name={col.key}
                    type={col.type || "text"}
                    label={col.label}
                    placeholder={col.label}
                    required={col.key === "FirstName" || col.key === "WorkEmail"}
                    value={contactFormData[col.key]}
                    onChange={(e) => updateContactField(col.key, e.target.value)}
                  />
                );
              }
            };

            return (
              <>
                {/* SECTION 1: Personal Information */}
                <FormSection
                  title="Personal Information"
                  id="personal"
                  isExpanded={expandedSectionsContact.personal}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: "FirstName", label: "First Name" },
                      { key: "LastName", label: "Last Name" },
                      { key: "JobTitle", label: "Job Title" },

                    ].map(field => (
                      <div key={field.key}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </FormSection>

                {/* SECTION 2: Contact Details */}
                <FormSection
                  title="Contact Details"
                  id="contact"
                  isExpanded={expandedSectionsContact.contact}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: "Email", label: "Email", type: "email" },
                      { key: "WorkPhone", label: "Work Phone", type: "tel" },
                      { key: "Mobile", label: "Mobile", type: "tel" },
                      { key: "LinkedIn", label: "LinkedIn", type: "url" },
                      { key: "Facebook", label: "Facebook", type: "url" },
                      { key: "Twitter", label: "Twitter", type: "url" },
                      { key: "WorkEmail", label: "Work Email", type: "email" },


                    ].map(field => (
                      <div key={field.key}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </FormSection>

                {/* SECTION 3: Location */}
                <FormSection
                  title="Location"
                  id="location"
                  isExpanded={expandedSectionsContact.location}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: "Address", label: "Address" },
                      { key: "Country", label: "Country" },
                      { key: "State", label: "State" },
                      { key: "City", label: "City" },
                      { key: "Zipcode", label: "Zipcode" },
                      { key: "TimeZone", label: "Time Zone" },
                      { key: "Locale", label: "Locale" },
                    ].map(field => (
                      <div key={field.key}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </FormSection>

                {/* SECTION 4: Organization */}
                <FormSection
                  title="Organization"
                  id="organization"
                  isExpanded={expandedSectionsContact.organization}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: "Account", label: "Account Name" },
                      { key: "SalesOwner", label: "Sales Owner" },
                      { key: "Status", label: "Status" },
                    ].map(field => (
                      <div key={field.key}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </FormSection>

                {/* SECTION 5: Marketing & Campaign */}
                <FormSection
                  title="Marketing & Campaign"
                  id="marketing"
                  isExpanded={expandedSectionsContact.marketing}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: "LifeCycleStage", label: "Life Cycle Stage" },
                      { key: "Territory", label: "Territory" },
                      { key: "Source", label: "Source" },
                      { key: "Campaign", label: "Campaign" },
                      { key: "CustomerFit", label: "Customer Fit" },
                      { key: "Score", label: "Score", type: "number" },
                      { key: "SubscriptionStatus", label: "Subscription Status" },
                      { key: "UnsubscribeReason", label: "Unsubscribe Reason" },
                      { key: "OtherUnsubscribeReasons", label: "Other Unsubscribe Reasons" },
                      { key: "WhatsAppSubscriptionStatus", label: "WhatsApp Subscription Status" },
                      { key: "SMSSubscriptionStatus", label: "SMS Subscription Status" },
                      { key: "Medium", label: "Medium" },
                      { key: "Keyword", label: "Keyword" },
                      { key: "LostReason", label: "Lost Reason" },
                      { key: "OriginalCampaign", label: "Original Campaign" },
                      { key: "OriginalMedium", label: "Original Medium" },
                      { key: "OriginalSource", label: "Original Source" },
                      { key: "CreatedThroughCampaign", label: "Created Through Campaign" },
                      { key: "CreatedFromMedium", label: "Created From Medium" },
                      { key: "CreatedFromSource", label: "Created From Source" },
                      { key: "MostRecentCampaign", label: "Most Recent Campaign" },
                      { key: "MostRecentMedium", label: "Most Recent Medium" },
                      { key: "MostRecentSource", label: "Most Recent Source" },
                    ].map(field => (
                      <div key={field.key}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </FormSection>

                {/* SECTION 6: Additional Fields */}
                <FormSection
                  title="Additional Fields"
                  id="additional"
                  isExpanded={expandedSectionsContact.additional}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: "Tags", label: "Tags" },
                      { key: "ExternalID", label: "External ID" },
                      { key: "WebForms", label: "Web Forms" },
                      { key: "ImportID", label: "Import ID" },
                    ].map(field => (
                      <div key={field.key}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </FormSection>

                {/* SECTION: Audit Trail */}
                <FormSection
                  title="Audit Trail"
                  id="audit"
                  isExpanded={expandedSectionsContact.audit || false}
                  onToggle={toggleSectionContact}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput
                      name="CreatedBy"
                      label="Created By"
                      type="text"
                      disabled={true}
                      value={savedUserName}
                    />
                    <FormInput
                      name="UpdatedBy"
                      label="Updated By"
                      type="text"
                      disabled={true}
                      value={savedUserName}
                    />
                  </div>
                </FormSection>
              </>
            );
          })()}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
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
                d="M5 13l4 4L19 7"
              />
            </svg>
  
            {isSaving ? "Saving..." : "Save Contact"}
          </button>
        </div>
      </form>

    );
  }
  if (type === "accounts") {
    const toggleSection = (section) => {
      setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Prevent multiple submissions
          if (isSaving) return;
          setIsSaving(true);

          // Normalize Website URL (add protocol if missing)
          let normalizedWebsite = (accountFormData.Website || "").trim();
          if (normalizedWebsite && !/^https?:\/\//i.test(normalizedWebsite)) {
            normalizedWebsite = "http://" + normalizedWebsite;
          }
          const newAccount = {
            // ✅ DO NOT SEND AccountId for new records - backend generates via database identity
            Name: accountFormData.Name,
            IndustryType: accountFormData.IndustryType,
            BusinessType: accountFormData.BusinessType,
            Territory: accountFormData.Territory,
            Website: normalizedWebsite,
            Phone: accountFormData.Phone,
            DisplayPhone: accountFormData.DisplayPhone,
            Country: accountFormData.Country,
            State: accountFormData.State,
            City: accountFormData.City,
            Zipcode: accountFormData.Zipcode,
            Address: accountFormData.Address,
            NumberOfEmployees: accountFormData.NumberOfEmployees ? Number(accountFormData.NumberOfEmployees) : null,
            AnnualRevenue: accountFormData.AnnualRevenue ? Number(accountFormData.AnnualRevenue) : null,
            SalesOwner: accountFormData.SalesOwner,
            ParentAccount: accountFormData.ParentAccount,
            Facebook: accountFormData.Facebook,
            Twitter: accountFormData.Twitter,
            LinkedIn: accountFormData.LinkedIn,
            LastContactedMode: accountFormData.LastContactedMode,
            LastActivityType: accountFormData.LastActivityType,
            RecentNote: accountFormData.RecentNote,
            ActiveSalesSequences: accountFormData.ActiveSalesSequences ? Number(accountFormData.ActiveSalesSequences) : null,
            CompletedSalesSequences: accountFormData.CompletedSalesSequences ? Number(accountFormData.CompletedSalesSequences) : null,
            Tags: accountFormData.Tags,
            ImportID: accountFormData.ImportID,
            CreatedBy: savedUserName || "Unknown", // Set createdBy to logged-in user's name or "Unknown" if not available
            UpdatedBy: savedUserName || "Unknown", // Set updatedBy to logged-in user's name or "Unknown" if not available
            // ❌ DO NOT SEND system-managed fields (backend auto-generates these):
            // - AccountId (database identity)
            // - SalesOwnerId, ParentAccountId (lookup IDs - derive from names if needed)
            // - CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, LastActivityDate, LastAssignedAt
          };
          try {
            await apiClient.post(`/Account`, newAccount, {
              headers: { "Content-Type": "application/json" },
            });
            // Dispatch event to notify other components to refetch
            window.dispatchEvent(new CustomEvent('accountAdded'));
            if (onSuccess) onSuccess();
            // Reset form state instead of form element
            setAccountFormData({
              Name: "",
              IndustryType: "",
              BusinessType: "",
              Territory: "",
              Website: "",
              Phone: "",
              DisplayPhone: "",
              Country: "",
              State: "",
              City: "",
              Zipcode: "",
              Address: "",
              NumberOfEmployees: "",
              AnnualRevenue: "",
              SalesOwner: "",
              ParentAccount: "",
              Facebook: "",
              Twitter: "",
              LinkedIn: "",
              LastContactedMode: "",
              LastActivityType: "",
              RecentNote: "",
              ActiveSalesSequences: "",
              CompletedSalesSequences: "",
              Tags: "",
              ImportID: "",
            });
            setAccountCountry("");
            setAccountState("");
            // Try to refetch dashboard state
            try {
              if (window.refetchAccounts) {
                window.refetchAccounts();
              }
            } catch (refetchErr) {
              console.warn("Account added, but failed to refetch dashboard state:", refetchErr);
            }
          } catch (err) {
            // surface backend error details to help diagnose 400 responses
            let msg = "Failed to add account.";
            if (err?.response) {
              msg += `\nStatus: ${err.response.status}`;
              try {
                const data = err.response.data;
                if (data) {
                  msg += `\nResponse: ${typeof data === 'string' ? data : JSON.stringify(data)}`;
                }
              } catch (e) {
                // ignore
              }
            } else if (err?.message) {
              msg += `\nError: ${err.message}`;
            }
            alert(msg);
            if (onError) onError(msg);
          }
          finally {
            setIsSaving(false);
          }
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
          {/* ============ BUSINESS CARD UPLOAD COMPONENT ============ */}
          {/* <BusinessCardUpload
            onSuccess={(data) => {
              // Optional: Handle post-scan success
              // Component handles field mapping automatically
            }}
            onError={(err) => {
              // Optional: Handle post-scan error
            }}
            onSetCountry={setAccountCountry}
            onSetState={setAccountState}
          /> */}

          {/* ============ HELPER FUNCTION TO RENDER FIELD ============ */}
          {(() => {
            const renderField = (col) => {
              if (col.key === "Address" || col.key === "RecentNote" || col.key === "Tags" || col.key === "ImportID") {
                return (
                  <AutoGrowTextarea
                    key={col.key}
                    name={col.key}
                    placeholder={col.label}
                    className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    value={accountFormData[col.key]}
                    onChange={(e) => updateAccountField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "NumberOfEmployees" || col.key === "AnnualRevenue" || col.key === "ActiveSalesSequences" || col.key === "CompletedSalesSequences") {
                return (
                  <input
                    key={col.key}
                    name={col.key}
                    type="number"
                    placeholder={col.label}
                    className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    value={accountFormData[col.key]}
                    onChange={(e) => updateAccountField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "DisplayPhone" || col.key === "Phone") {
                return (
                  <input
                    key={col.key}
                    name={col.key}
                    type="tel"
                    placeholder={col.label}
                    className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    value={accountFormData[col.key]}
                    onChange={(e) => updateAccountField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "Facebook" || col.key === "Twitter" || col.key === "LinkedIn" || col.key === "Website") {
                return (
                  <input
                    key={col.key}
                    name={col.key}
                    type="text"
                    placeholder={col.label}
                    className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    value={accountFormData[col.key]}
                    onChange={(e) => updateAccountField(col.key, e.target.value)}
                  />
                );
              } else if (col.key === "Country") {
                return (
                  <div key={col.key} className="space-y-2">
                    <select
                      name={col.key}
                      value={accountCountry}
                      onChange={(e) => {
                        setAccountCountry(e.target.value);
                        updateAccountField(col.key, e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    >
                      <option value="">Select country</option>
                      {allCountries.map((c) => (
                        <option key={c.isoCode} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              } else if (col.key === "State") {
                const countryIso = allCountries.find((c) => c.name === accountCountry)?.isoCode;
                const states = countryIso ? State.getStatesOfCountry(countryIso) : [];
                return (
                  <select
                    key={col.key}
                    name={col.key}
                    value={accountState}
                    onChange={(e) => {
                      setAccountState(e.target.value);
                      updateAccountField(col.key, e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    disabled={!countryIso}
                  >
                    <option value="">Select state</option>
                    {states.map((s) => (
                      <option key={s.isoCode} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                );
              } else if (col.key === "City") {
                const countryIso = allCountries.find((c) => c.name === accountCountry)?.isoCode;
                const states = countryIso ? State.getStatesOfCountry(countryIso) : [];
                const stateIso = states.find((s) => s.name === accountState)?.isoCode;
                const cities = countryIso && stateIso ? City.getCitiesOfState(countryIso, stateIso) : [];
                return (
                  <select
                    key={col.key}
                    name={col.key}
                    value={accountFormData[col.key]}
                    onChange={(e) => updateAccountField(col.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-white text-sm"
                    disabled={!stateIso}
                  >
                    <option value="">Select city</option>
                    {cities.map((c) => (
                      <option key={`${c.name}-${c.latitude}`} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                );
              } else {
                return (
                  <input
                    key={col.key}
                    name={col.key}
                    type={col.type || "text"}
                    placeholder={col.label}
                    required={col.key === "Name"}
                    value={accountFormData[col.key]}
                    onChange={(e) => updateAccountField(col.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 text-sm ${col.key === "Name" ? "border-blue-200 bg-white" : "border-gray-200 bg-white"}`}
                  />
                );
              }
            };

            return (
              <>
                {/* SECTION 1: Basic Information */}
                <FormSection title="Basic Information" id="basic" isExpanded={expandedSections.basic} onToggle={toggleSection}>
                  {[
                    { key: "Name", label: "Company Name" },
                    { key: "IndustryType", label: "Industry Type" },
                    { key: "BusinessType", label: "Business Type" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {field.label}
                        {field.key === "Name" && <span className="text-red-500">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 2: Location */}
                <FormSection title="Location" id="location" isExpanded={expandedSections.location} onToggle={toggleSection}>
                  {[
                    { key: "Country", label: "Country" },
                    { key: "State", label: "State" },
                    { key: "City", label: "City" },
                    { key: "Zipcode", label: "Zipcode" },
                    { key: "Address", label: "Address" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 3: Business Details */}
                <FormSection title="Business Details" id="business" isExpanded={expandedSections.business} onToggle={toggleSection}>
                  {[
                    { key: "Website", label: "Website", type: "url" },
                    { key: "Phone", label: "Phone", type: "tel" },
                    { key: "DisplayPhone", label: "Display Phone", type: "tel" },
                    { key: "Territory", label: "Territory" },
                    { key: "NumberOfEmployees", label: "Number of Employees", type: "number" },
                    { key: "AnnualRevenue", label: "Annual Revenue", type: "number" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {field.label}
                        {field.key === "Website" && <span className="text-red-500">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 4: Social Media */}
                <FormSection title="Social Media" id="social" isExpanded={expandedSections.social} onToggle={toggleSection}>
                  {[
                    { key: "Facebook", label: "Facebook", type: "url" },
                    { key: "Twitter", label: "Twitter", type: "url" },
                    { key: "LinkedIn", label: "LinkedIn", type: "url" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 5: Ownership & Assignment */}
                <FormSection title="Ownership & Assignment" id="ownership" isExpanded={expandedSections.ownership} onToggle={toggleSection}>
                  {[
                    { key: "SalesOwner", label: "Sales Owner" },
                    { key: "ParentAccount", label: "Parent Account" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 6: Activity Tracking */}
                <FormSection title="Activity Tracking" id="activity" isExpanded={expandedSections.activity} onToggle={toggleSection}>
                  {[
                    { key: "LastContactedMode", label: "Last Contacted Mode" },
                    { key: "LastActivityType", label: "Last Activity Type" },
                    { key: "RecentNote", label: "Recent Note" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 7: Sales Sequences */}
                <FormSection title="Sales Sequences" id="sequences" isExpanded={expandedSections.sequences} onToggle={toggleSection}>
                  {[
                    { key: "ActiveSalesSequences", label: "Active Sales Sequences", type: "number" },
                    { key: "CompletedSalesSequences", label: "Completed Sales Sequences", type: "number" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 8: Metadata & Tracking */}
                <FormSection title="Metadata & Tracking" id="metadata" isExpanded={expandedSections.metadata} onToggle={toggleSection}>
                  {[
                    { key: "Tags", label: "Tags" },
                    { key: "ImportID", label: "Import ID" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))}
                </FormSection>

                {/* SECTION 9: Audit Trail */}
                <FormSection title="Audit Trail" id="audit" isExpanded={expandedSections.audit || false} onToggle={toggleSection}>
                  {[
                    { key: "CreatedBy", label: "Created By" },
                    { key: "UpdatedBy", label: "Updated By" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{field.label}</label>
                      <input type="text" disabled value={savedUserName} className="w-full px-3 py-2 border border-gray-200 rounded transition-colors focus:outline-none focus:border-gray-300 hover:border-gray-300 bg-gray-100 text-sm" />
                    </div>
                  ))}
                </FormSection>
              </>
            );
          })()}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
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
                d="M5 13l4 4L19 7"
              />
            </svg>

            {isSaving ? "Saving..." : "Save Account"}
          </button>
        </div>
      </form>

    );
  }
  if (type === "products") {
    return (

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Prevent multiple submissions
          if (isSaving) return;
          setIsSaving(true);

          // compute numeric INR value for baseCurrencyAmount
          const rawAmt = parseFloat(productFormData.BaseCurrencyAmount || productAmount) || 0;
          const rawCurrency = productCurrency || "INR";
          const numericINR = Math.round(rawAmt * (currencyRatesToINR[rawCurrency] || 1) * 100) / 100;

          const newProduct = {
            name: productFormData.Name,
            active: productFormData.Active,
            baseCurrencyAmount: numericINR,
            category: productFormData.Category,
            createdBy: savedUserName || "Unknown",
            updatedBy: savedUserName || "Unknown",
          };
          try {
            await apiClient.post(`/Products`, newProduct, {
              headers: { "Content-Type": "application/json" },
            });
            // Fetch updated products and update state if products is a function
            // if (typeof products === "function") {
            //   const res = await apiClient.get(`/Products`);
            //   products(Array.isArray(res.data) ? res.data : []);
            // }

            window.dispatchEvent(new CustomEvent("productAdded"));


            if (onSuccess) onSuccess();
            // Reset form state instead of form element
            setProductFormData({
              Name: "",
              Category: "",
              Active: "Yes",
              BaseCurrencyAmount: "",
            });
            // reset local product amount state
            setProductAmount("");
            setProductCurrency("INR");
          } catch (err) {
            if (onError) onError();
          }
          finally {
            setIsSaving(false);
          }
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput
              name="Name"
              label="Product Name"
              type="text"
              placeholder="Enter product name"
              required={true}
              value={productFormData.Name}
              onChange={(e) => updateProductField("Name", e.target.value)}
            />
            <FormSelect
              name="Category"
              label="Category"
              required={true}
              value={productFormData.Category}
              onChange={(e) => updateProductField("Category", e.target.value)}
            >
              <option value="">Select Category</option>
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Service">Service</option>
              <option value="Software/Hardware">Software/Hardware</option>
            </FormSelect>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormSelect
              name="Active"
              label="Active"
              value={productFormData.Active}
              onChange={(e) => updateProductField("Active", e.target.value)}
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </FormSelect>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Base Currency Amount<span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex items-end gap-3">
              <FormSelect
                name="baseCurrency"
                label="Currency"
                value={productCurrency}
                onChange={(e) => setProductCurrency(e.target.value)}
                className="w-32"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </FormSelect>
              <div className="flex-1">
                <input
                  name="BaseCurrencyAmount"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-300"
                  value={productFormData.BaseCurrencyAmount}
                  onChange={(e) => {
                    updateProductField("BaseCurrencyAmount", e.target.value);
                    setProductAmount(e.target.value);
                  }}
                  required
                />
              </div>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {(() => {
                const amt = parseFloat(productFormData.BaseCurrencyAmount) || 0;
                const inr = Math.round((amt * (currencyRatesToINR[productCurrency] || 1)) * 100) / 100;
                const usd = Math.round((inr / (currencyRatesToINR["USD"] || 1)) * 100) / 100;
                return (
                  <>
                    <span className="font-semibold">INR:</span> ₹{inr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} • <span className="font-semibold">USD:</span> ${usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
            <FormInput
              name="CreatedBy"
              label="Created By"
              type="text"
              disabled={true}
              defaultValue={savedUserName}
            />
            <FormInput
              name="UpdatedBy"
              label="Updated By"
              type="text"
              disabled={true}
              defaultValue={savedUserName}
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            {isSaving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </form>

    );
  }

  if (type === "deals") {
    const toggleSectionDeal = (section) => {
      setExpandedSectionsDeal(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Prevent multiple submissions
          if (isSaving) return;
          setIsSaving(true);

          // Store original entered price and selected currency
          const enteredPrice = parseFloat(dealFormData.DealAmount || dealAmount) || 0;
          const selectedCurrency = (dealCurrency || "INR").toString().toUpperCase();
          // Compute INR base value using latest exchange rates (cached by utility)
          let priceInINR = 0;
          try {
            const rates = await fetchExchangeRates();
            if (selectedCurrency === 'INR') {
              priceInINR = round2(enteredPrice);
            } else {
              const rate = rates[selectedCurrency] || 1; // rates[c] = 1 INR in that currency
              priceInINR = round2(enteredPrice / (rate || 1));
            }
          } catch (e) {
            // fallback to existing client-side map if rates fail
            const rate = currencyRatesToINR[selectedCurrency] || 1;
            priceInINR = selectedCurrency === 'INR' ? enteredPrice : Math.round(enteredPrice * rate * 100) / 100;
          }

          // Client-side validation — only DealName is truly required
          const validationErrors = {};
          const dealNameVal = dealFormData.DealName || "";
          const totalPriceVal = dealFormData.DealAmount || dealAmount;

          if (!isRequired(dealNameVal)) validationErrors.DealName = "Deal Name is required";
          if (totalPriceVal && !isNumber(totalPriceVal)) validationErrors.totalPriceInBaseCurrencyWithoutTax = "Total Price must be a valid number";
          if (!["INR", "USD"].includes(selectedCurrency)) validationErrors.Currency = "Currency must be INR or USD";

          if (Object.keys(validationErrors).length > 0) {
            setDealErrors(validationErrors);
            // scroll to top of form if needed
            if (e.target && e.target.scrollIntoView) e.target.scrollIntoView({ behavior: 'smooth' });
            setIsSaving(false);
            return;
          }
          setDealErrors({});

          // If products were added, include their combined base amount into the total
          let finalTotal = priceInINR;
          try {
            if (selectedProducts && selectedProducts.length > 0) {
              const totalProductAmount = selectedProducts.reduce((sum, prod) => {
                const product = (Array.isArray(products) ? products : []).find(
                  (p) => (p?.name || p?.Name) === prod.name
                );
                const prodAmt = parseFloat(product?.baseCurrencyAmount ?? product?.BaseCurrencyAmount) || 0;
                return sum + prodAmt;
              }, 0);
              finalTotal = Math.round((finalTotal + totalProductAmount) * 100) / 100;
            }
          } catch (ex) {
            // ignore lookup errors and proceed with entered price only
          }

          if (
            !selectedAccountId ||
            String(selectedAccountId).trim() === "" ||
            !Number.isFinite(Number(selectedAccountId)) ||
            Number(selectedAccountId) <= 0
          ) {
            alert("Account is required");
            setIsSaving(false);
            return;
          }

          const validSelectedContactIds = selectedContactIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0);

          if (validSelectedContactIds.length === 0) {
            alert("Contact is required");
            setIsSaving(false);
            return;
          }

          const selectedAccount = mergedAccountsForLookup.find((a) => {
            const id = a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
            return String(id) === String(selectedAccountId);
          });
          const normalizedAccountId =
            selectedAccount?.AccountId ??
            selectedAccount?.accountId ??
            Number(selectedAccountId);
          const selectedAccountName =
            selectedAccount?.Name ??
            selectedAccount?.name ??
            accountSearch;

          const selectedContactNameList = validSelectedContactIds.map((contactId, index) => {
            const selectedContact = contactPickerRows.find((c) => {
              const id = c?.ContactId ?? c?.contactId ?? c?.Id ?? c?.id;
              return String(id) === String(contactId);
            });
            return getContactDisplayName(selectedContact) || selectedContactNames[index] || `Contact ${contactId}`;
          });

          // Validate and clean currency
          const cleanedCurrency = cleanCurrencyValue(selectedCurrency);

          const newDeal = {
            accountId: normalizedAccountId,
            contactId: validSelectedContactIds[0],
            contactName: selectedContactNameList.join(", ") || null,
            contactIds: validSelectedContactIds,
            contactNames: selectedContactNameList,
            name: dealFormData.DealName || "",
            type: dealFormData.DealType || "",
            dealPipeline: dealFormData.DealPipeline || "",
            dealStage: dealFormData.DealStage || "",
            dealValue: enteredPrice,
            dealValueInBaseCurrency: finalTotal,
            DealValueInINR: priceInINR || finalTotal,
            dealValueInINR: priceInINR || finalTotal,
            Currency: cleanedCurrency,
            expectedDealValue: dealFormData.ExpectedDealValue ? Number(dealFormData.ExpectedDealValue) : null,
            currency: cleanedCurrency,
            source: dealFormData.DealSource || "",
            territory: dealFormData.Territory || "",
            ageInDays: dealFormData.DealAgeInDays ? Number(dealFormData.DealAgeInDays) : 0,
            salesOwner: dealFormData.SalesOwner || savedUserName || "",
            salesOwnerId: dealFormData.SalesOwnerId ? Number(dealFormData.SalesOwnerId) : null,
            createdBy: savedUserName || null,
            tags: dealFormData.Tags || "",
            recentNote: dealFormData.RecentNote || "",
            campaign: dealFormData.Campaign || "",
            probability: dealFormData.Probability ? Number(dealFormData.Probability) : null,
            expectedCloseDate: dealFormData.ExpectedCloseDate || null,
            closedDate: dealFormData.ClosedDate || null,
            paymentStatus: dealFormData.PaymentStatus || "",
            lostReason: dealFormData.LostReason || "",
            forecastCategory: dealFormData.ForecastCategory || "",
            lastActivityType: dealFormData.LastActivityType || "",
            lastActivityDate: dealFormData.LastActivityDate || null,
            webForm: dealFormData.WebForm || "",
            upcomingActivities: dealFormData.UpcomingActivities || "",
            accountName: selectedAccountName,
          };

          try {
            await apiClient.post(`/Deal`, newDeal, {
              headers: { "Content-Type": "application/json" },
            });

            // Dispatch event to notify other components to refetch
            window.dispatchEvent(new CustomEvent('dealAdded'));
            if (onSuccess) onSuccess();
            // Try to refetch dashboard state
            try {
              if (typeof deals === "function") {
                const res = await apiClient.get(`/Deal`);
                deals(Array.isArray(res.data) ? res.data : []);
              }
            } catch (refetchErr) {
              console.warn("Deal added, but failed to refetch dashboard state:", refetchErr);
            }

            // Reset form state instead of form element
            setDealFormData({
              DealName: "",
              DealType: "",
              DealPipeline: "",
              DealStage: "",
              ExpectedDealValue: "",
              DealSource: "",
              Territory: "",
              Campaign: "",
              Probability: "",
              ForecastCategory: "",
              ExpectedCloseDate: "",
              ClosedDate: "",
              PaymentStatus: "",
              SalesOwner: "",
              SalesOwnerId: "",
              Tags: "",
              RecentNote: "",
              LostReason: "",
              ImportID: "",
              WebForm: "",
              UpcomingActivities: "",
              DealAgeInDays: "",
              LastActivityType: "",
              LastActivityDate: "",
              LastContactedMode: "",
              LastContactedTime: "",
            });
            setDealCurrency("INR");
            setDealAmount("");
            setSelectedProducts([]); // Reset products array
            setShowProductFields(false);
            setAccountSearch("");
            setContactSearch("");
            setSelectedAccountId("");
            setSelectedContactId("");
            setSelectedContactIds([]);
            setSelectedContactNames([]);
            setContactPickerRows([]);
            setAccountPickerRows([]);
          } catch (err) {
            let msg = "Failed to add deal.";
            if (err?.status) {
              msg += `\nStatus: ${err.status}`;
            }
            const responseData =
              err?.details ||
              err?.inner ||
              err?.error ||
              err?.title ||
              (typeof err === "string" ? err : null);
            if (responseData) {
              msg += `\nResponse: ${responseData}`;
            } else if (err?.message) {
              msg += `\nError: ${err.message}`;
            }
            alert(msg);
            if (onError) onError(msg);
          }
          finally {
            setIsSaving(false);
          }
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* SECTION 1: Account & Contact Selection */}
          <FormSection
            title="Account & Contact"
            id="account"
            isExpanded={expandedSectionsDeal.account}
            onToggle={toggleSectionDeal}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 overflow-visible gap-6" style={{ position: 'relative', zIndex: 10 }}>

              {/* Account */}
              <div ref={accountRef} className="relative overflow-visible">
                <label className="block text-sm font-semibold text-gray-700">
                  Account<span className="text-red-500 ml-1">*</span>
                </label>

                <input
                  type="text"
                  value={accountSearch}
                  placeholder="Search account..."
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setSelectedAccountId("");
                    setSelectedContactId("");
                    setSelectedContactIds([]);
                    setSelectedContactNames([]);
                    setContactSearch("");
                    setShowAccounts(true);
                  }}
                  onFocus={() => setShowAccounts(true)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200"
                  required
                />

                <input type="hidden" name="AccountId" value={selectedAccountId} />

                {showAccounts && (
                  <div className="absolute z-[9999] w-full bg-white border-2 border-blue-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto mt-1" style={{ top: '100%' }}>
                    {accountPickerLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Searching accounts…</div>
                    ) : accountSearch.trim().length < 2 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Type at least 2 characters to search all accounts.</div>
                    ) : accountPickerRows.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">No accounts found.</div>
                    ) : (
                      accountPickerRows.map((a) => {
                        const id =
                          a?.AccountId ?? a?.accountId ?? a?.Id ?? a?.id;
                        const name = a?.Name ?? a?.name ?? String(id);

                        return (
                          <div
                            key={id}
                            onClick={() => {
                              setSelectedAccountId(String(id));
                              setAccountSearch(name);
                              setSelectedContactId("");
                              setSelectedContactIds([]);
                              setSelectedContactNames([]);
                              setContactSearch("");
                              setShowAccounts(false);
                            }}
                            className="px-4 py-2.5 cursor-pointer hover:bg-blue-100 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                          >
                            <p className="text-sm font-medium text-gray-800">{name}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div ref={contactRef} className="relative overflow-visible">
                <label className="block text-sm font-semibold text-gray-700">
                  Contact<span className="text-red-500 ml-1">*</span>
                </label>

                <input
                  type="text"
                  value={contactSearch}
                  placeholder={
                    !selectedAccountId
                      ? "Select an account first…"
                      : accountContactsLoading
                        ? "Loading contacts…"
                        : "Search contact…"
                  }
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContacts(true);
                  }}
                  onFocus={() => selectedAccountId && setShowContacts(true)}
                  disabled={!selectedAccountId || accountContactsLoading}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
                  required
                />

                <input type="hidden" name="ContactId" value={selectedContactId} />

                {selectedContactIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedContactIds.map((id, index) => {
                      const name = selectedContactNames[index] || `Contact ${id}`;
                      return (
                        <span key={id} className="inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-700">
                          {name}
                          <button
                            type="button"
                            onClick={() => {
                              const next = selectedContactIds
                                .map((itemId, itemIndex) => ({
                                  id: itemId,
                                  name: selectedContactNames[itemIndex] || `Contact ${itemId}`,
                                }))
                                .filter((item) => String(item.id) !== String(id));
                              syncSelectedContactState(next);
                            }}
                            className="text-blue-500 hover:text-blue-800"
                          >
                            x
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {showContacts &&
                  selectedAccountId &&
                  (accountContactsLoading ? (
                    <div className="absolute z-[9999] w-full bg-white border-2 border-blue-200 rounded-lg shadow-xl mt-1 px-4 py-3 text-sm text-gray-600" style={{ top: "100%" }}>
                      Loading contacts…
                    </div>
                  ) : contactPickerRows.length > 0 ? (
                      <div className="absolute z-[9999] w-full bg-white border-2 border-blue-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto mt-1" style={{ top: "100%" }}>
                        {contactPickerRows.map((c) => {
                          const id =
                            c?.ContactId ?? c?.contactId ?? c?.Id ?? c?.id;

                          const first = c?.FirstName ?? c?.firstName ?? "";
                          const last = c?.LastName ?? c?.lastName ?? "";
                          const name = `${first} ${last}`.trim() || getContactDisplayName(c);
                          const isSelected = selectedContactIds.some((contactId) => String(contactId) === String(id));

                          return (
                            <div
                              key={id}
                              onClick={() => {
                                const current = selectedContactIds.map((itemId, index) => ({
                                  id: itemId,
                                  name: selectedContactNames[index] || `Contact ${itemId}`,
                                }));
                                const next = isSelected
                                  ? current.filter((item) => String(item.id) !== String(id))
                                  : [...current, { id, name: name || `Contact ${id}` }];
                                syncSelectedContactState(next);
                                setContactSearch("");
                                setShowContacts(true);
                              }}
                              className={`px-4 py-2.5 cursor-pointer hover:bg-blue-100 border-b border-gray-100 last:border-b-0 transition-colors duration-150 flex items-center justify-between gap-3 ${isSelected ? "bg-blue-50 text-blue-700" : ""}`}
                            >
                              <p className="text-sm font-medium text-gray-800">{name || `Contact ${id}`}</p>
                              {isSelected && <span className="text-xs font-medium">Selected</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                    <div className="absolute z-[9999] w-full bg-white border-2 border-blue-200 rounded-lg shadow-xl mt-1 px-4 py-3 text-sm text-gray-500" style={{ top: "100%" }}>
                      {contactSearch.trim().length >= 1
                        ? "No contacts match this search for the selected account."
                        : "No contacts for this account (or narrow with search)."}
                    </div>
                  ))}
              </div>

            </div>
          </FormSection>

          {/* SECTION 2: Deal Information */}
          <FormSection title="Deal Information" id="dealinfo" isExpanded={expandedSectionsDeal.dealinfo} onToggle={toggleSectionDeal}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                name="DealName"
                label="Deal Name"
                type="text"
                placeholder="Enter deal name"
                required={true}
                value={dealFormData.DealName}
                onChange={(e) => updateDealField("DealName", e.target.value)}
              />
              {dealErrors.DealName && <div className="text-red-500 text-sm mt-1">{dealErrors.DealName}</div>}

              <FormSelect
                name="DealType"
                label="Deal Type"
                value={dealFormData.DealType}
                onChange={(e) => updateDealField("DealType", e.target.value)}
              >
                <option value="">Select Deal Type</option>
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Software/Hardware">Software/Hardware</option>

              </FormSelect>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormSelect
                name="DealPipeline"
                label="Deal Pipeline"
                value={dealFormData.DealPipeline}
                onChange={(e) =>
                  updateDealField("DealPipeline", e.target.value)
                }
              >
                <option value="">Select Pipeline</option>
                <option value="Default Pipeline">Default Pipeline</option>
                <option value="Hardware Product Sale">
                  Hardware Product Sale
                </option>
                <option value="Software Product Sale">
                  Software Product Sale
                </option>
                <option value="Software/Hardware Pipeline">
                  Software/Hardware Pipeline
                </option>
              </FormSelect>

              <FormSelect
                name="DealStage"
                label="Deal Stage"
                value={dealFormData.DealStage}
                onChange={(e) => updateDealField("DealStage", e.target.value)}
              >
                <option value="">Select Deal Stage</option>
                <option>New Lead</option>
                <option>Need Analysis</option>
                <option>Under Review</option>
                <option>Demo</option>
                <option>Proposal/Price Quote</option>
                <option>Hold</option>
                <option>Negotiation/Review</option>
                <option>Follow Up</option>
                <option>PO Received</option>
                <option>Won</option>
                <option>Lost</option>
              </FormSelect>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Deal Value<span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex items-end gap-3">
                <FormSelect
                  name="Currency"
                  label="Currency"
                  value={dealCurrency}
                  onChange={(e) => setDealCurrency(e.target.value)}
                  className="w-40"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </FormSelect>
                <div className="flex-1">
                  <input
                    name="totalPriceInBaseCurrencyWithoutTax"
                    type="number"
                    step="0.01"
                    placeholder="Total Price"
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-300"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {(() => {
                  const amt = parseFloat(dealAmount) || 0;
                  const rate = currencyRatesToINR[dealCurrency] || 1;
                  const inrVal = Math.round((amt * rate) * 100) / 100;
                  const usdVal = Math.round((inrVal / (currencyRatesToINR["USD"] || 1)) * 100) / 100;
                  return <>
                    <span className="font-semibold">INR:</span> ₹{inrVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} • <span className="font-semibold">USD:</span> ${usdVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </>;
                })()}
              </div>
              {dealErrors.totalPriceInBaseCurrencyWithoutTax && <div className="text-red-500 text-sm mt-1">{dealErrors.totalPriceInBaseCurrencyWithoutTax}</div>}
              {dealErrors.Currency && <div className="text-red-500 text-sm mt-1">{dealErrors.Currency}</div>}
            </div>

            <FormInput
              name="ExpectedDealValue"
              label="Expected Deal Value"
              type="number"
              step="0.01"
              placeholder="Enter expected deal value"
              value={dealFormData.ExpectedDealValue}
              onChange={(e) => updateDealField("ExpectedDealValue", e.target.value)}
            />
          </FormSection>

          {/* SECTION 3: Products */}
          <FormSection title="Products" id="products" isExpanded={expandedSectionsDeal.products} onToggle={toggleSectionDeal}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => {
                  setShowProductFields((s) => !s);
                  if (showProductFields) {
                    setSelectedProducts([]);
                  }
                }} className="px-4 py-2 text-sm font-medium rounded-lg border-2 border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200">
                  {showProductFields ? "✕ Remove Products" : "+ Add Products"}
                </button>
                {selectedProducts.length > 0 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
                    {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} added
                  </span>
                )}
              </div>

              {showProductFields && (
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 space-y-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200 space-y-3">
                    <label className="block text-sm font-semibold text-gray-700">Add Product</label>
                    <select id="productSelect" className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-300" defaultValue="">
                      <option value="">Select product to add</option>
                      {(Array.isArray(products) ? products : []).map((p) => {
                        const name = p?.name || p?.Name || "";
                        const isSelected = selectedProducts.some(sp => sp.name === name);
                        return (
                          <option key={name} value={name} disabled={isSelected}>
                            {name} {isSelected ? "(already added)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button type="button" onClick={() => {
                      const select = document.getElementById("productSelect");
                      const name = select.value;
                      if (!name || selectedProducts.some(sp => sp.name === name)) {
                        return;
                      }
                      const prod = (Array.isArray(products) ? products : []).find((p) => (p?.name || p?.Name) === name);
                      const cat = prod ? (prod?.category || prod?.Category || "") : "";
                      setSelectedProducts([...selectedProducts, { name, category: cat }]);
                      select.value = "";
                    }} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200">
                      Add Product
                    </button>
                  </div>

                  {selectedProducts.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Selected Products</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedProducts.map((prod, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 group hover:bg-blue-100 transition-colors">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{prod.name}</p>
                              <p className="text-xs text-gray-600">{prod.category || "No category"}</p>
                            </div>
                            <button type="button" onClick={() => {
                              setSelectedProducts(selectedProducts.filter((_, i) => i !== idx));
                            }} className="ml-2 px-3 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormSection>

          {/* SECTION 4: Business & Pipeline */}
          <FormSection title="Business & Pipeline" id="business" isExpanded={expandedSectionsDeal.business} onToggle={toggleSectionDeal}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0">
              <FormInput
                name="DealSource"
                label="Deal Source"
                type="text"
                placeholder="Enter deal source"
                value={dealFormData.DealSource}
                onChange={(e) => updateDealField("DealSource", e.target.value)}
              />
              <FormInput
                name="Territory"
                label="Territory"
                type="text"
                placeholder="Enter territory"
                value={dealFormData.Territory}
                onChange={(e) => updateDealField("Territory", e.target.value)}
              />
              <FormInput
                name="Campaign"
                label="Campaign"
                type="text"
                placeholder="Enter campaign"
                value={dealFormData.Campaign}
                onChange={(e) => updateDealField("Campaign", e.target.value)}
              />
              <FormInput
                name="Probability"
                label="Win Probability (%)"
                type="number"
                min="0"
                max="100"
                placeholder="0-100"
                value={dealFormData.Probability}
                onChange={(e) => updateDealField("Probability", e.target.value)}
              />
              <FormSelect
                name="ForecastCategory"
                label="Forecast Category"
                value={dealFormData.ForecastCategory}
                onChange={(e) => updateDealField("ForecastCategory", e.target.value)}
              >
                <option value="">Select Forecast Category</option>
                <option value="Pipeline">Pipeline</option>
                <option value="BestCase">Best Case</option>
                <option value="Likely">Likely</option>
                <option value="Commit">Commit</option>
              </FormSelect>
              <FormInput
                name="ExpectedCloseDate"
                label="Expected Close Date"
                type="date"
                value={dealFormData.ExpectedCloseDate}
                onChange={(e) => updateDealField("ExpectedCloseDate", e.target.value)}
              />
              <FormInput
                name="ClosedDate"
                label="Closed Date"
                type="date"
                value={dealFormData.ClosedDate}
                onChange={(e) => updateDealField("ClosedDate", e.target.value)}
              />
              <FormSelect
                name="PaymentStatus"
                label="Payment Status"
                value={dealFormData.PaymentStatus}
                onChange={(e) => updateDealField("PaymentStatus", e.target.value)}
              >
                <option value="">Select Payment Status</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </FormSelect>
            </div>
          </FormSection>

          {/* SECTION 5: Additional Information */}
          <FormSection title="Additional Information" id="additional" isExpanded={expandedSectionsDeal.additional} onToggle={toggleSectionDeal}>
            <div className="space-y-4">
              <FormInput
                name="SalesOwner"
                label="Sales Owner"
                type="text"
                placeholder="Enter sales owner name"
                value={dealFormData.SalesOwner}
                onChange={(e) => updateDealField("SalesOwner", e.target.value)}
              />
              <FormTextarea
                name="Tags"
                label="Tags"
                placeholder="Enter tags (comma-separated)"
                rows="2"
                value={dealFormData.Tags}
                onChange={(e) => updateDealField("Tags", e.target.value)}
              />
              <FormTextarea
                name="RecentNote"
                label="Recent Note"
                placeholder="Enter recent note"
                rows="2"
                value={dealFormData.RecentNote}
                onChange={(e) => updateDealField("RecentNote", e.target.value)}
              />
              <FormInput
                name="LostReason"
                label="Lost Reason"
                type="text"
                placeholder="Enter reason if deal was lost"
                value={dealFormData.LostReason}
                onChange={(e) => updateDealField("LostReason", e.target.value)}
              />
              <FormInput
                name="ImportID"
                label="Import ID"
                type="text"
                placeholder="Enter import ID"
                value={dealFormData.ImportID}
                onChange={(e) => updateDealField("ImportID", e.target.value)}
              />
              <FormInput
                name="WebForm"
                label="Web Form"
                type="text"
                placeholder="Enter web form reference"
                value={dealFormData.WebForm}
                onChange={(e) => updateDealField("WebForm", e.target.value)}
              />
              <FormTextarea
                name="UpcomingActivities"
                label="Upcoming Activities"
                placeholder="Enter upcoming activities"
                rows="2"
                value={dealFormData.UpcomingActivities}
                onChange={(e) => updateDealField("UpcomingActivities", e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  name="DealAgeInDays"
                  label="Deal Age (Days)"
                  type="number"
                  placeholder="Enter deal age in days"
                  value={dealFormData.DealAgeInDays}
                  onChange={(e) => updateDealField("DealAgeInDays", e.target.value)}
                />
                <FormInput
                  name="LastActivityType"
                  label="Last Activity Type"
                  type="text"
                  placeholder="Enter last activity type"
                  value={dealFormData.LastActivityType}
                  onChange={(e) => updateDealField("LastActivityType", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  name="LastActivityDate"
                  label="Last Activity Date"
                  type="date"
                  value={dealFormData.LastActivityDate}
                  onChange={(e) => updateDealField("LastActivityDate", e.target.value)}
                />
                <FormInput
                  name="LastContactedMode"
                  label="Last Contacted Mode"
                  type="text"
                  placeholder="Enter contact mode (Call, Email, etc.)"
                  value={dealFormData.LastContactedMode}
                  onChange={(e) => updateDealField("LastContactedMode", e.target.value)}
                />
              </div>
              <FormInput
                name="LastContactedTime"
                label="Last Contacted Time"
                type="datetime-local"
                value={dealFormData.LastContactedTime}
                onChange={(e) => updateDealField("LastContactedTime", e.target.value)}
              />
            </div>
          </FormSection>
        </div>

        <div className="border-t border-[#e2e5ea] px-[20px] py-[12px] flex justify-end gap-[10px] bg-[#f9fafb]">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
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
                d="M5 13l4 4L19 7"
              />
            </svg>

            {isSaving ? "Saving..." : "Save Deal"}
          </button>
        </div>
      </form>

    );
  }
  return null;
}

export default AddForms;
