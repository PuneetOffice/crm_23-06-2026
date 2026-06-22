// Header component
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  FiUpload,
  FiUserPlus,
  FiUsers,
  FiBriefcase,
  FiDollarSign,
  FiBox,
  FiPlus,
  FiSearch,
  FiBell,
  FiClock,
  FiRefreshCw,
  FiPhone,
  FiMessageSquare,
  FiMail,
  FiCheckCircle,
} from "react-icons/fi";
import { useMsal } from "@azure/msal-react";
import { useContext } from "react";
import AuthContext from "../auth/AuthContext";
import apiClient from "../api/client";
import SignupPanel from "./SignupPanel";
import Email from "./Email";
import logo from "../assets/Logo_2.png";
import AddForms from "./add";
import { HiOutlineMail } from "react-icons/hi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, query) {
  const str = String(text ?? "");
  const term = String(query ?? "").trim();
  if (!str || !term) return str;
  const parts = str.split(new RegExp(`(${escapeRegExp(term)})`, "gi"));
  if (parts.length === 1) return str;
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="bg-yellow-200 text-yellow-900 font-semibold rounded px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ search, setSearch, setShowPanel, setActiveContent, onSearchSelect }) {
  const { instance, accounts } = useMsal();
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchItem, setSelectedSearchItem] = useState(null);
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDropdownRef = useRef(null);

  // ── Mobile search overlay (search bar hidden on mobile, opens as full-width overlay) ──
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const mobileSearchInputRef = useRef(null);

  useEffect(() => {
    if (showMobileSearch) {
      // focus shortly after mount so the slide/fade transition has started
      const t = setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showMobileSearch]);

  // ── Add-popup state ───────────────────────────────────────────────────────────
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState("contacts");
  const [addDealPrefill, setAddDealPrefill] = useState(null);
  const addPopupRef = useRef(null);

  const openAddDealForm = useCallback((prefill = {}) => {
    setFormType("deals");
    setAddDealPrefill({
      contactId: prefill.contactId || "",
      contactName: prefill.contactName || "",
      accountId: prefill.accountId || "",
      accountName: prefill.accountName || "",
    });
    setShowAddForm(true);
  }, []);

  useEffect(() => {
    window.openAddDealForm = openAddDealForm;
    return () => {
      if (window.openAddDealForm === openAddDealForm) {
        window.openAddDealForm = undefined;
      }
    };
  }, [openAddDealForm]);

  useEffect(() => {
    if (!showAddForm) {
      setAddDealPrefill(null);
    }
  }, [showAddForm]);

  // ── User state ────────────────────────────────────────────────────────────────
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState(() => {
    try { return sessionStorage.getItem("userName") || localStorage.getItem("userName") || ""; } catch { return ""; }
  });
  const [userRole, setUserRole] = useState(() => {
    try { return sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || ""; } catch { return ""; }
  });
  const [showSignupPanel, setShowSignupPanel] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);

  // Stable ref so fetchNotifications doesn't need accounts/instance in deps
  const msalRef = useRef({ accounts, instance });
  useEffect(() => { msalRef.current = { accounts, instance }; }, [accounts, instance]);

  // ── 🔔 Notifications state ────────────────────────────────────────────────────
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("_crm_notif_read") || "[]")); } catch { return new Set(); }
  });

  // ── 🕐 Recents state ──────────────────────────────────────────────────────────
  const [showRecentsPanel, setShowRecentsPanel] = useState(false);
  const recentsBtnRef = useRef(null);
  const recentsPanelRef = useRef(null);
  const [recents, setRecents] = useState([]);
  const [recentsLoading, setRecentsLoading] = useState(false);

  // ── Live search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      setSelectedSearchItem(null);
      setActiveSearchTerm("");
      return;
    }
    const trimmedSearch = search.trim();
    const timer = setTimeout(() => {
      apiClient
        .get(`/Search`, { params: { query: search } })
        .then((res) => {
          setSearchResults(Array.isArray(res.data) ? res.data : []);
          setSelectedSearchItem(null);
          setActiveSearchTerm(trimmedSearch);
          setShowSearchDropdown(true);
        })
        .catch(() => {
          setSearchResults([]);
          setShowSearchDropdown(false);
          setSelectedSearchItem(null);
          setActiveSearchTerm("");
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target))
        setShowSearchDropdown(false);
    };
    if (showSearchDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchDropdown]);

  // ── Add popup outside click ───────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (addPopupRef.current && !addPopupRef.current.contains(e.target))
        setShowAddPopup(false);
    };
    if (showAddPopup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAddPopup]);

  // ── User info sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const email = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "";
    setUserEmail(email);
  }, []);

  useEffect(() => {
    try {
      const role = auth?.getRole?.() || sessionStorage.getItem("userRole") || localStorage.getItem("userRole") || "";
      if (role) setUserRole(role);
    } catch {}
  }, [auth]);

  useEffect(() => {
    if (!userEmail) return;
    const storedName = sessionStorage.getItem("userName") || localStorage.getItem("userName");
    if (storedName) { setUserName(storedName); return; }
    setUserName(userEmail.split("@")[0]);
  }, [userEmail]);

  // ── User dropdown outside click ───────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const displayName = userName || (userEmail ? userEmail.split("@")[0] : "User");

  // ── Sign out ──────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userName");
    localStorage.removeItem("msal.account.keys");
    localStorage.removeItem("msal.idtoken");
    localStorage.removeItem("msal.accesstoken");
    if (accounts.length > 0) {
      try {
        await instance.logoutRedirect({ postLogoutRedirectUri: "/" });
        navigate("/");
      } catch {
        try { await instance.clearCache(); } catch {}
        navigate("/");
      }
    } else {
      try { auth?.logout(); } catch { navigate("/"); }
    }
  };

  // ── 🔔 fetchNotifications ─────────────────────────────────────────────────────
  // NOTE: reads accounts/instance from msalRef so this function never changes
  // reference, preventing the useEffect interval from constantly restarting.
  const fetchNotifications = useCallback(async () => {
    const { accounts: accs, instance: inst } = msalRef.current;
    setNotifLoading(true);
    const items = [];

    if (accs.length > 0) {
      // Emails (unread, last 20)
      try {
        const tok = await inst.acquireTokenSilent({
          scopes: ["https://graph.microsoft.com/User.Read", "https://graph.microsoft.com/Mail.Read"],
          account: accs[0],
        });
        const res = await window.fetch(
          "https://graph.microsoft.com/v1.0/me/messages?$filter=isRead eq false&$top=20&$select=id,subject,from,receivedDateTime,bodyPreview,isRead&$orderby=receivedDateTime desc",
          { headers: { Authorization: `Bearer ${tok.accessToken}` } }
        );
        const data = await res.json();
        (data.value || []).forEach((m) =>
          items.push({
            id: m.id,
            source: "email",
            title: m.subject || "(No subject)",
            from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Unknown",
            preview: m.bodyPreview || "",
            time: m.receivedDateTime,
          })
        );
      } catch {}

      // Teams messages (graceful fallback if scope not consented)
      try {
        const tok = await inst.acquireTokenSilent({
          scopes: ["https://graph.microsoft.com/User.Read", "https://graph.microsoft.com/Chat.Read"],
          account: accs[0],
        });
        const chatsRes = await window.fetch(
          "https://graph.microsoft.com/v1.0/me/chats?$top=6",
          { headers: { Authorization: `Bearer ${tok.accessToken}` } }
        );
        const chatsData = await chatsRes.json();
        for (const chat of (chatsData.value || []).slice(0, 6)) {
          try {
            const msgRes = await window.fetch(
              `https://graph.microsoft.com/v1.0/me/chats/${chat.id}/messages?$top=2`,
              { headers: { Authorization: `Bearer ${tok.accessToken}` } }
            );
            const msgData = await msgRes.json();
            (msgData.value || []).forEach((msg) => {
              const body = msg.body?.content?.replace(/<[^>]*>/g, "").trim() || "";
              if (!body || msg.messageType === "unknownFutureValue") return;
              items.push({
                id: `teams-${msg.id}`,
                source: "teams",
                title: chat.topic || "Teams Chat",
                from: msg.from?.user?.displayName || "Someone",
                preview: body.slice(0, 120),
                time: msg.createdDateTime,
              });
            });
          } catch {}
        }
      } catch {}
    }

    items.sort((a, b) => new Date(b.time) - new Date(a.time));
    setNotifications(items);
    setNotifLoading(false);
  }, []); // stable — reads from msalRef, never needs to change

  // ── 🕐 fetchRecents ───────────────────────────────────────────────────────────
  const fetchRecents = useCallback(async () => {
    setRecentsLoading(true);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const items = [];

    // Notes (contact notes + deal notes) from the dedicated Notes endpoint
    try {
      const res = await apiClient.get("/Notes");
      const list = Array.isArray(res.data) ? res.data : [];
      list.forEach((n) => {
        const ts = n.CreatedAt || n.createdAt;
        const desc = n.Description || n.description || "";
        if (!ts || new Date(ts) < cutoff || !desc.trim()) return;

        const hasContact = !!(n.ContactId || n.contactId);
        const hasDeal    = !!(n.DealId    || n.dealId);

        items.push({
          id: `note-${n.Id || n.id}`,
          entityId: hasContact ? (n.ContactId || n.contactId) : (n.DealId || n.dealId),
          source: hasDeal ? "deal" : "contact",
          title: desc.length > 60 ? desc.slice(0, 60) + "…" : desc,
          preview: null,
          time: ts,
          extra: hasDeal ? "Deal Note" : "Contact Note",
        });
      });
    } catch {}

    // Call logs
    try {
      const res = await apiClient.get("/CallLog");
      const list = Array.isArray(res.data) ? res.data : [];
      list.forEach((l) => {
        const ts = l.CreatedAt || l.createdAt;
        if (!ts || new Date(ts) < cutoff) return;

        const dir      = l.CallDirection || l.callDirection || "";
        const duration = l.CallDuration  || l.callDuration  || "";
        const assoc    = l.AssociatedWithCall || l.associatedWithCall || "";
        const owner    = l.CallOwner     || l.callOwner     || "";
        const notes    = l.Notes         || l.notes         || "";

        items.push({
          id: `calllog-${l.CallLogId || l.callLogId}`,
          entityId: l.ContactId || l.contactId,
          source: "calllog",
          title: assoc || owner || "Call Log",
          preview: notes || null,
          time: ts,
          extra: [dir, duration ? String(duration).replace("00:", "").replace(/^0/, "") : ""].filter(Boolean).join(" · ") || "Call",
        });
      });
    } catch {}

    items.sort((a, b) => new Date(b.time) - new Date(a.time));
    setRecents(items);
    setRecentsLoading(false);
  }, []);

  // Auto-fetch notifications on mount + poll every 2 min
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 120_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Fetch recents when panel opens
  useEffect(() => {
    if (showRecentsPanel) fetchRecents();
  }, [showRecentsPanel, fetchRecents]);

  // Click-outside: notifications panel
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e) => {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target) &&
        notifBtnRef.current && !notifBtnRef.current.contains(e.target)
      ) setShowNotifPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifPanel]);

  // Click-outside: recents panel
  useEffect(() => {
    if (!showRecentsPanel) return;
    const handler = (e) => {
      if (
        recentsPanelRef.current && !recentsPanelRef.current.contains(e.target) &&
        recentsBtnRef.current && !recentsBtnRef.current.contains(e.target)
      ) setShowRecentsPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRecentsPanel]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !readNotifIds.has(n.id)).length;

  const markAllRead = () => {
    const all = new Set(notifications.map((n) => n.id));
    setReadNotifIds(all);
    try { localStorage.setItem("_crm_notif_read", JSON.stringify([...all])); } catch {}
  };

  const markOneRead = (id) => {
    const next = new Set(readNotifIds);
    next.add(id);
    setReadNotifIds(next);
    try { localStorage.setItem("_crm_notif_read", JSON.stringify([...next])); } catch {}
  };

  // Navigate from recents
  const handleRecentClick = (item) => {
    setShowRecentsPanel(false);
    if (item.source === "contact" && item.entityId) {
      window.dispatchEvent(new CustomEvent("showContact", { detail: { contactId: item.entityId } }));
    } else if (item.source === "deal") {
      if (typeof setActiveContent === "function") setActiveContent("deals");
      navigate("/dashboard/Deals");
    } else if (item.source === "calllog") {
      if (item.entityId) {
        window.dispatchEvent(new CustomEvent("showContact", { detail: { contactId: item.entityId } }));
      } else {
        if (typeof setActiveContent === "function") setActiveContent("contacts");
        navigate("/dashboard/contacts");
      }
    }
  };

  // Source configs
  const sourceConfig = {
    email:   { color: "bg-blue-500",   light: "bg-blue-50",   text: "text-blue-600",   label: "Email",    Icon: FiMail },
    teams:   { color: "bg-purple-500", light: "bg-purple-50", text: "text-purple-600", label: "Teams",    Icon: FiMessageSquare },
    contact: { color: "bg-sky-500",    light: "bg-sky-50",    text: "text-sky-600",    label: "Contact",  Icon: FiUsers },
    deal:    { color: "bg-violet-500", light: "bg-violet-50", text: "text-violet-600", label: "Deal",     Icon: FiDollarSign },
    calllog: { color: "bg-teal-500",   light: "bg-teal-50",   text: "text-teal-600",   label: "Call Log", Icon: FiPhone },
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <header className="fixed inset-x-0 top-0 backdrop-blur-sm h-14 font-[poppins,sans-serif] flex items-center justify-between gap-2 px-2 sm:px-4 lg:px-8 bg-gray-800/95 border-b border-gray-200 shadow-sm z-40">

      {/* CSS animations */}
      <style>{`
        @keyframes hdrDropIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes hdrItemIn {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes hdrPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0);  }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes mobileSearchIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .hdr-drop-in { animation: hdrDropIn 0.18s cubic-bezier(0.16,1,0.3,1) forwards; }
        .hdr-item-in { animation: hdrItemIn 0.15s ease forwards; }
        .notif-badge-pulse { animation: hdrPulse 1.8s ease-in-out infinite; }
        .mobile-search-in { animation: mobileSearchIn 0.16s ease forwards; }
        .shimmer-line {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 4px;
        }
        /* Reserve space on the far left for the Sidebar's fixed hamburger button
           (fixed at left-3 top-3, ~24px icon + 16px padding ≈ 44px) so the Header's
           own logo/content never sits underneath it on small screens. */
        .hdr-mobile-gutter { padding-left: 44px; }
        @media (min-width: 1024px) {
          .hdr-mobile-gutter { padding-left: 0; }
        }
      `}</style>

      {/* Logo — shifted right on mobile/tablet to clear the Sidebar's hamburger
          button (fixed top-left, lg:hidden), sits at the normal far-left position
          on desktop (lg:) where the hamburger is hidden and the sidebar is static. */}
      <div className="flex items-center gap-2 flex-shrink-0 hdr-mobile-gutter min-w-0">
        <img src={logo} alt="Logo" className="h-5 sm:h-6 lg:h-7 w-auto object-contain" />
      </div>

      {/* Search bar — desktop/tablet: inline bar. Mobile: collapses to just an icon
          that opens a full-width overlay (see below), so it never competes for
          space with the logo + action icons on narrow screens. */}
      <div className="hidden sm:flex flex-1 max-w-md mx-2 lg:mx-4 min-w-0">
        <div className="relative font-thin w-full">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
            <FiSearch size={18} />
          </span>
          <input
            type="text"
            placeholder="Search accounts, contacts, deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 py-1.5 bg-gray-700/95 text-gray-400 border-none placeholder-gray-300 rounded-lg focus:outline-none focus:ring-0 focus:ring-transparent focus:border-transparent transition-all duration-200 text-sm"
            onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setSelectedSearchItem(null); setActiveSearchTerm(""); }}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <span className="text-lg">×</span>
            </button>
          )}

          {/* Search dropdown */}
          {showSearchDropdown && (
            <div ref={searchDropdownRef} className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[560px] overflow-y-auto">
              {searchResults.length > 0 ? (
                <>
                  {["contact","account","deal","product","calllog","task","meeting"].map((type) => {
                    const group = searchResults.filter((r) => r.type === type);
                    if (!group.length) return null;
                    const cm = {
                      contact: { badge: "bg-blue-100 text-blue-700",    hdr: "bg-blue-50 text-blue-700",    dot: "bg-blue-500",    icon: "👤" },
                      account: { badge: "bg-green-100 text-green-700",  hdr: "bg-green-50 text-green-700",  dot: "bg-green-500",  icon: "🏢" },
                      deal:    { badge: "bg-purple-100 text-purple-700",hdr: "bg-purple-50 text-purple-700",dot: "bg-purple-500",icon: "💰" },
                      product: { badge: "bg-orange-100 text-orange-700",hdr: "bg-orange-50 text-orange-700",dot: "bg-orange-500",icon: "📦" },
                      calllog: { badge: "bg-teal-100 text-teal-700",    hdr: "bg-teal-50 text-teal-700",    dot: "bg-teal-500",    icon: "📞" },
                      task:    { badge: "bg-yellow-100 text-yellow-700",hdr: "bg-yellow-50 text-yellow-700",dot: "bg-yellow-500",icon: "✅" },
                      meeting: { badge: "bg-pink-100 text-pink-700",    hdr: "bg-pink-50 text-pink-700",    dot: "bg-pink-500",    icon: "📅" },
                    };
                    const c = cm[type] || { badge: "bg-gray-100 text-gray-700", hdr: "bg-gray-50 text-gray-700", dot: "bg-gray-400", icon: "🔍" };
                    const tabMap = { contact: "contacts", account: "accounts", deal: "deals", product: "products" };
                    return (
                      <div key={type}>
                        <div className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${c.hdr} border-b border-gray-100 sticky top-0 z-10 flex items-center gap-2`}>
                          <span>{c.icon}</span>
                          <span>{type}s</span>
                          <span className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>{group.length}</span>
                        </div>
                        {group.map((item, idx) => {
                          const key = `${type}-${item.id ?? idx}`;
                          const displayFields = item.allFields ? Object.entries(item.allFields) : [];
                          const matchedSet = new Set((item.matchedFields || []).map(mf => mf.field));
                          return (
                            <button
                              key={key}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors group"
                              onClick={() => {
                                setSelectedSearchItem(item);
                                setShowSearchDropdown(false);
                                setActiveSearchTerm(search.trim());
                                setSearch("");
                                const tab = tabMap[item.type];
                                if (tab && typeof setActiveContent === "function") setActiveContent(tab);
                                if (typeof onSearchSelect === "function") onSearchSelect({ type: item.type, id: item.id });
                              }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                                <span className="font-semibold text-gray-900 text-sm">
                                  {highlightText(item.name, activeSearchTerm) || "(No name)"}
                                </span>
                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.badge}`}>{type}</span>
                              </div>
                              {displayFields.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                  {displayFields.map(([field, value]) => {
                                    const isMatched = matchedSet.has(field);
                                    const strVal = String(value);
                                    return (
                                      <div key={field} className={`flex items-start gap-1 text-xs rounded px-1 py-0.5 ${isMatched ? "bg-yellow-50 border border-yellow-200" : ""}`}>
                                        <span className={`flex-shrink-0 font-medium min-w-[70px] truncate ${isMatched ? "text-yellow-700" : "text-gray-400"}`}>{field}:</span>
                                        <span className={`truncate max-w-[120px] ${isMatched ? "text-yellow-900 font-medium" : "text-gray-600"}`}>
                                          {isMatched ? highlightText(strVal, activeSearchTerm) : strVal}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100 bg-gray-50">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} across all pages
                  </div>
                </>
              ) : (
                <div className="px-4 py-10 text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <p className="text-sm text-gray-500">No results for <span className="font-semibold text-gray-700">"{search}"</span></p>
                </div>
              )}
            </div>
          )}

          {/* Inline detail card */}
          {selectedSearchItem && (() => {
            const item = selectedSearchItem;
            const cm = {
              contact: { badge: "bg-blue-100 text-blue-700",    hdr: "from-blue-600 to-blue-700",    icon: "👤" },
              account: { badge: "bg-green-100 text-green-700",  hdr: "from-green-600 to-green-700",  icon: "🏢" },
              deal:    { badge: "bg-purple-100 text-purple-700",hdr: "from-purple-600 to-purple-700",icon: "💰" },
              product: { badge: "bg-orange-100 text-orange-700",hdr: "from-orange-500 to-orange-600",icon: "📦" },
              calllog: { badge: "bg-teal-100 text-teal-700",    hdr: "from-teal-600 to-teal-700",    icon: "📞" },
              task:    { badge: "bg-yellow-100 text-yellow-700",hdr: "from-yellow-500 to-yellow-600",icon: "✅" },
              meeting: { badge: "bg-pink-100 text-pink-700",    hdr: "from-pink-600 to-pink-700",    icon: "📅" },
            };
            const c = cm[item.type] || { badge: "bg-gray-100 text-gray-700", hdr: "from-gray-600 to-gray-700", icon: "🔍" };
            const matchedSet = new Set((item.matchedFields || []).map(mf => mf.field));
            const allFields = item.allFields ? Object.entries(item.allFields) : [];
            return (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className={`bg-gradient-to-r ${c.hdr} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white text-base">{c.icon}</span>
                    <span className="text-white font-semibold text-sm truncate">{item.name || "(No name)"}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white flex-shrink-0">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
                      onClick={() => { setSelectedSearchItem(null); setShowSearchDropdown(true); }}>← Back</button>
                    <button className="text-white/70 hover:text-white transition-colors text-lg leading-none px-1"
                      onClick={() => { setSelectedSearchItem(null); setSearch(""); setActiveSearchTerm(""); }}>×</button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {allFields.map(([field, value]) => {
                      const isMatched = matchedSet.has(field);
                      const strVal = String(value);
                      return (
                        <div key={field} className={`flex items-start gap-1 text-xs rounded px-1.5 py-1 ${isMatched ? "bg-yellow-50 border border-yellow-200" : "hover:bg-gray-50"}`}>
                          <span className={`flex-shrink-0 font-semibold min-w-[80px] truncate ${isMatched ? "text-yellow-700" : "text-gray-400"}`}>{field}:</span>
                          <span className={`truncate ${isMatched ? "text-yellow-900 font-medium" : "text-gray-700"}`}>
                            {isMatched ? highlightText(strVal, activeSearchTerm) : strVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* spacer pushes the right-side icon cluster to the edge on mobile,
          where the search bar above is hidden and would otherwise leave a gap */}
      <div className="flex-1 sm:hidden" />

      {/* ── Right section ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 lg:gap-2 flex-shrink-0">

        {/* 🔍 Mobile search icon — only visible below sm, opens full-width overlay */}
        <button
          onClick={() => setShowMobileSearch(true)}
          className="sm:hidden p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Search"
          aria-label="Search"
        >
          <FiSearch size={18} />
        </button>

        {/* 🔔 Notifications button */}
        <div className="relative">
          <button
            ref={notifBtnRef}
            onClick={() => { setShowNotifPanel((v) => !v); setShowRecentsPanel(false); }}
            className={`relative p-1.5 rounded-lg transition-all duration-200 ${showNotifPanel ? "bg-white/15 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
            title="Notifications"
            aria-label="Notifications"
          >
            <FiBell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center notif-badge-pulse leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications panel — full-width sheet on mobile, floating card on larger screens */}
          {showNotifPanel && (
            <div
              ref={notifPanelRef}
              className="hdr-drop-in fixed sm:absolute left-2 right-2 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-[360px] w-auto max-h-[70vh] sm:max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <FiBell size={16} className="text-gray-700" />
                  <span className="text-sm font-semibold text-gray-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">{unreadCount} new</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                      <FiCheckCircle size={12} /> Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => { fetchNotifications(); }}
                    className={`p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${notifLoading ? "animate-spin" : ""}`}
                    title="Refresh"
                  >
                    <FiRefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="overflow-y-auto flex-1">
                {notifLoading && notifications.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex gap-3 items-start" style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="shimmer-line w-9 h-9 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="shimmer-line h-3 w-3/4" />
                          <div className="shimmer-line h-2.5 w-full" />
                          <div className="shimmer-line h-2.5 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <FiBell size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">All caught up!</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {accounts.length === 0 ? "Sign in with Microsoft to see emails & Teams messages." : "No new notifications right now."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Group by source */}
                    {["email", "teams"].map((src) => {
                      const group = notifications.filter((n) => n.source === src);
                      if (!group.length) return null;
                      const cfg = sourceConfig[src];
                      const Icon = cfg.Icon;
                      return (
                        <div key={src}>
                          <div className="px-4 py-2 flex items-center gap-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                            <div className={`w-5 h-5 rounded-md ${cfg.color} flex items-center justify-center`}>
                              <Icon size={11} className="text-white" />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{cfg.label}</span>
                            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.light} ${cfg.text}`}>{group.length}</span>
                          </div>
                          {group.map((n, i) => {
                            const isRead = readNotifIds.has(n.id);
                            return (
                              <button
                                key={n.id}
                                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50/80 border-b border-gray-50 transition-all duration-150 hdr-item-in group`}
                                style={{ animationDelay: `${i * 40}ms` }}
                                onClick={() => markOneRead(n.id)}
                              >
                                {/* Avatar */}
                                <div className={`w-9 h-9 rounded-xl ${cfg.color} flex items-center justify-center flex-shrink-0 text-white font-bold text-sm`}>
                                  {n.from?.[0]?.toUpperCase() || "?"}
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm font-semibold truncate ${isRead ? "text-gray-500" : "text-gray-900"}`}>{n.from}</p>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.time)}</span>
                                  </div>
                                  <p className={`text-xs truncate mt-0.5 ${isRead ? "text-gray-400" : "text-gray-700"}`}>{n.title}</p>
                                  {n.preview && (
                                    <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">{n.preview}</p>
                                  )}
                                </div>
                                {/* Unread dot */}
                                {!isRead && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Panel footer */}
              {!notifLoading && notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 text-center">
                  <span className="text-xs text-gray-400">Showing {notifications.length} notification{notifications.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🕐 Recents button */}
        <div className="relative">
          <button
            ref={recentsBtnRef}
            onClick={() => { setShowRecentsPanel((v) => !v); setShowNotifPanel(false); }}
            className={`p-1.5 rounded-lg transition-all duration-200 ${showRecentsPanel ? "bg-white/15 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
            title="Recent Activity"
            aria-label="Recent Activity"
          >
            <FiClock size={18} />
          </button>

          {/* Recents panel — full-width sheet on mobile, floating card on larger screens */}
          {showRecentsPanel && (
            <div
              ref={recentsPanelRef}
              className="hdr-drop-in fixed sm:absolute left-2 right-2 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-[380px] w-auto max-h-[70vh] sm:max-h-[540px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <FiClock size={16} className="text-gray-700" />
                  <span className="text-sm font-semibold text-gray-900">Recent Activity</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Last 24 hours</span>
                </div>
                <button
                  onClick={fetchRecents}
                  className={`p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${recentsLoading ? "animate-spin" : ""}`}
                  title="Refresh"
                >
                  <FiRefreshCw size={13} />
                </button>
              </div>

              {/* Panel body */}
              <div className="overflow-y-auto flex-1">
                {recentsLoading && recents.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="shimmer-line w-9 h-9 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="shimmer-line h-3 w-2/3" />
                          <div className="shimmer-line h-2.5 w-full" />
                          <div className="shimmer-line h-2 w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <FiClock size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">Notes and call logs from the last 24 hours will appear here.</p>
                  </div>
                ) : (
                  <>
                    {["calllog", "contact", "deal"].map((src) => {
                      const group = recents.filter((r) => r.source === src);
                      if (!group.length) return null;
                      const cfg = sourceConfig[src];
                      const Icon = cfg.Icon;
                      return (
                        <div key={src}>
                          <div className="px-4 py-2 flex items-center gap-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                            <div className={`w-5 h-5 rounded-md ${cfg.color} flex items-center justify-center`}>
                              <Icon size={11} className="text-white" />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{cfg.label}s</span>
                            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.light} ${cfg.text}`}>{group.length}</span>
                          </div>
                          {group.map((item, i) => {
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleRecentClick(item)}
                                className="w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50/80 border-b border-gray-50 transition-all duration-150 hdr-item-in group"
                                style={{ animationDelay: `${i * 35}ms` }}
                                title={`Open ${cfg.label}`}
                              >
                                {/* Icon circle */}
                                <div className={`w-9 h-9 rounded-xl ${cfg.light} border border-current/10 flex items-center justify-center flex-shrink-0`}>
                                  <Icon size={16} className={cfg.text} />
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{item.title}</p>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(item.time)}</span>
                                  </div>
                                  {item.extra && (
                                    <p className={`text-[11px] font-medium mt-0.5 ${cfg.text}`}>{item.extra}</p>
                                  )}
                                  {item.preview && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-tight">{item.preview}</p>
                                  )}
                                </div>
                                {/* Arrow on hover */}
                                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Panel footer */}
              {!recentsLoading && recents.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 text-center">
                  <span className="text-xs text-gray-400">{recents.length} item{recents.length !== 1 ? "s" : ""} in the last 24 hours</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email button — hidden on the smallest screens (lives in the Add popup there instead, see below) */}
        <button
          onClick={async () => {
            if (accounts.length === 0) {
              try {
                await instance.loginRedirect({
                  scopes: [
                    "https://graph.microsoft.com/User.Read",
                    "https://graph.microsoft.com/Mail.Read",
                    "https://graph.microsoft.com/Mail.ReadWrite",
                    "https://graph.microsoft.com/Mail.Send",
                  ],
                });
                setShowEmailPanel(true);
              } catch (error) {
                console.error("Login failed:", error);
              }
            } else {
              setShowEmailPanel(true);
            }
          }}
          className="hidden sm:inline-flex p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Send Mail"
          aria-label="Send Mail"
        >
          <HiOutlineMail size={18} />
        </button>

        {/* Add button */}
        {(auth?.getRole?.() === "Admin" || auth?.getRole?.() === "admin" || auth?.getRole?.() === "Manager" || auth?.getRole?.() === "manager" || auth?.getRole?.() === "User" || auth?.getRole?.() === "user") && (
          <button
            onClick={() => setShowAddPopup((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Add new item"
            aria-label="Add new item"
          >
            <FiPlus size={18} />
          </button>
        )}

        {/* Add popup */}
        {showAddPopup && createPortal(
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowAddPopup(false)} />
            <div
              ref={addPopupRef}
              className="fixed top-14 right-2 sm:right-4 bg-white rounded-xl shadow-2xl z-50 w-[calc(100vw-1rem)] sm:w-[280px] max-w-[280px] overflow-y-auto"
            >
              <div className="p-2">
                <div className="space-y-1">
                  {(auth?.getRole?.() === "Admin" || auth?.getRole?.() === "admin") && (
                    <button onClick={() => { setShowSignupPanel(true); setShowAddPopup(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                      <FiUserPlus size={18} className="text-blue-500" />
                      <span className="font-medium">Add User</span>
                    </button>
                  )}
                  <a href="/dashboard/Accounts" onClick={(e) => { e.preventDefault(); setFormType("accounts"); setShowAddForm(true); setShowAddPopup(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                    <FiBriefcase size={18} className="text-blue-500" />
                    <span className="font-medium">Add Account</span>
                  </a>
                  <a href="/dashboard/contacts" onClick={(e) => { e.preventDefault(); setFormType("contacts"); setShowAddForm(true); setShowAddPopup(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                    <FiUsers size={18} className="text-green-500" />
                    <span className="font-medium">Add Contact</span>
                  </a>
                  <a href="/dashboard/Products" onClick={(e) => { e.preventDefault(); setFormType("products"); setShowAddForm(true); setShowAddPopup(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                    <FiBox size={18} className="text-orange-500" />
                    <span className="font-medium">Add Product</span>
                  </a>
                  <a href="/dashboard/Deals" onClick={(e) => { e.preventDefault(); setFormType("deals"); setShowAddForm(true); setShowAddPopup(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                    <FiDollarSign size={18} className="text-purple-500" />
                    <span className="font-medium">Add Deal</span>
                  </a>
                  {/* Send Mail — surfaced here too on the smallest screens, where the
                      standalone mail icon in the header is hidden for space */}
                  <button
                    onClick={async () => {
                      setShowAddPopup(false);
                      if (accounts.length === 0) {
                        try {
                          await instance.loginRedirect({
                            scopes: [
                              "https://graph.microsoft.com/User.Read",
                              "https://graph.microsoft.com/Mail.Read",
                              "https://graph.microsoft.com/Mail.ReadWrite",
                              "https://graph.microsoft.com/Mail.Send",
                            ],
                          });
                          setShowEmailPanel(true);
                        } catch (error) {
                          console.error("Login failed:", error);
                        }
                      } else {
                        setShowEmailPanel(true);
                      }
                    }}
                    className="sm:hidden w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <HiOutlineMail size={18} className="text-sky-500" />
                    <span className="font-medium">Send Mail</span>
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

        {showSignupPanel && createPortal(<SignupPanel onClose={() => setShowSignupPanel(false)} />, document.body)}

        {/* User avatar */}
        <div className="relative">
          <button
            title="User Menu"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-green-600 hover:bg-green-700 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
            onClick={() => setShowDropdown((v) => !v)}
            aria-label="User menu"
          >
            {userEmail ? userEmail[0].toUpperCase() : "U"}
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
              <div className="fixed sm:absolute top-16 sm:top-full right-2 sm:right-0 left-2 sm:left-auto sm:mt-2 w-auto sm:w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden" ref={dropdownRef}>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {userEmail ? userEmail[0].toUpperCase() : "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{displayName || "User"}</div>
                      <div className="text-xs text-gray-500 truncate">{userEmail || "user@example.com"}</div>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                    onClick={() => { navigate("/Dashboard/profile"); setShowDropdown(false); }}>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>View Profile</span>
                  </button>
                  {(userRole?.toLowerCase() === "admin" || auth?.getRole?.()?.toLowerCase() === "admin") && (
                    <button className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                      onClick={() => { navigate("/Dashboard/Import"); setShowDropdown(false); }}>
                      <FiUpload size={16} className="text-gray-500" />
                      <span>Import Data</span>
                    </button>
                  )}
                  {(userRole?.toLowerCase() === "admin" || auth?.getRole?.()?.toLowerCase() === "admin") && (
                    <>
                      <button className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                        onClick={() => { setActiveContent("users"); navigate("/dashboard/users"); setShowDropdown(false); }}>
                        <FiUsers size={16} className="text-gray-500" />
                        <span>Manage Users</span>
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                    </>
                  )}
                  <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-medium"
                    onClick={handleSignOut}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile search overlay — full-width search bar that takes over the header
          on small screens when the search icon is tapped. Keeps all the same
          search/dropdown logic as the desktop bar so behavior stays consistent. */}
      {showMobileSearch && (
        <div className="mobile-search-in sm:hidden fixed inset-x-0 top-0 h-14 bg-gray-800 flex items-center gap-2 px-2 z-50">
          <span className="flex items-center pointer-events-none text-gray-400 pl-1">
            <FiSearch size={18} />
          </span>
          <input
            type="text"
            autoFocus
            ref={mobileSearchInputRef}
            placeholder="Search accounts, contacts, deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 py-1.5 bg-transparent text-white border-none placeholder-gray-400 focus:outline-none focus:ring-0 text-sm"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setSelectedSearchItem(null); setActiveSearchTerm(""); }}
              className="flex items-center text-gray-400 hover:text-white transition-colors px-1"
              aria-label="Clear search"
            >
              <span className="text-lg">×</span>
            </button>
          )}
          <button
            onClick={() => { setShowMobileSearch(false); setShowSearchDropdown(false); }}
            className="flex items-center text-gray-300 hover:text-white transition-colors text-sm font-medium px-2 flex-shrink-0"
          >
            Cancel
          </button>

          {/* Mobile search results — full screen below the bar */}
          {showSearchDropdown && (
            <div className="fixed inset-x-0 top-14 bottom-0 bg-white overflow-y-auto z-50">
              {searchResults.length > 0 ? (
                <>
                  {["contact","account","deal","product","calllog","task","meeting"].map((type) => {
                    const group = searchResults.filter((r) => r.type === type);
                    if (!group.length) return null;
                    const cm = {
                      contact: { badge: "bg-blue-100 text-blue-700",    hdr: "bg-blue-50 text-blue-700",    dot: "bg-blue-500",    icon: "👤" },
                      account: { badge: "bg-green-100 text-green-700",  hdr: "bg-green-50 text-green-700",  dot: "bg-green-500",  icon: "🏢" },
                      deal:    { badge: "bg-purple-100 text-purple-700",hdr: "bg-purple-50 text-purple-700",dot: "bg-purple-500",icon: "💰" },
                      product: { badge: "bg-orange-100 text-orange-700",hdr: "bg-orange-50 text-orange-700",dot: "bg-orange-500",icon: "📦" },
                      calllog: { badge: "bg-teal-100 text-teal-700",    hdr: "bg-teal-50 text-teal-700",    dot: "bg-teal-500",    icon: "📞" },
                      task:    { badge: "bg-yellow-100 text-yellow-700",hdr: "bg-yellow-50 text-yellow-700",dot: "bg-yellow-500",icon: "✅" },
                      meeting: { badge: "bg-pink-100 text-pink-700",    hdr: "bg-pink-50 text-pink-700",    dot: "bg-pink-500",    icon: "📅" },
                    };
                    const c = cm[type] || { badge: "bg-gray-100 text-gray-700", hdr: "bg-gray-50 text-gray-700", dot: "bg-gray-400", icon: "🔍" };
                    const tabMap = { contact: "contacts", account: "accounts", deal: "deals", product: "products" };
                    return (
                      <div key={type}>
                        <div className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${c.hdr} border-b border-gray-100 sticky top-0 z-10 flex items-center gap-2`}>
                          <span>{c.icon}</span>
                          <span>{type}s</span>
                          <span className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>{group.length}</span>
                        </div>
                        {group.map((item, idx) => {
                          const key = `${type}-${item.id ?? idx}`;
                          return (
                            <button
                              key={key}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                              onClick={() => {
                                setShowMobileSearch(false);
                                setShowSearchDropdown(false);
                                setActiveSearchTerm(search.trim());
                                setSearch("");
                                const tab = tabMap[item.type];
                                if (tab && typeof setActiveContent === "function") setActiveContent(tab);
                                if (typeof onSearchSelect === "function") onSearchSelect({ type: item.type, id: item.id });
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                                <span className="font-semibold text-gray-900 text-sm">
                                  {highlightText(item.name, activeSearchTerm) || "(No name)"}
                                </span>
                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.badge}`}>{type}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="px-4 py-10 text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <p className="text-sm text-gray-500">No results for <span className="font-semibold text-gray-700">"{search}"</span></p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Form Side Panel */}
      {showAddForm && createPortal(
        <>
          <div className="fixed inset-0 bg-black/50 z-[3000] flex items-stretch justify-end animate-in fade-in duration-300">
          <div className="bg-white shadow-2xl w-full sm:w-[85%] md:w-[70%] lg:w-[60%] h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {formType === "contacts" ? "Add New Contact" : formType === "accounts" ? "Add New Account" : formType === "products" ? "Add New Product" : "Add New Deal"}
              </h3>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => setShowAddForm(false)} aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <AddForms
                type={formType}
                accounts={[]}
                contacts={[]}
                products={[]}
                deals={[]}
                dealPrefill={formType === "deals" ? addDealPrefill : null}
                onSuccess={() => {
                  setShowAddForm(false);
                  try {
                    if (typeof window.addToast === "function") {
                      window.addToast(
                        formType === "contacts" ? "Contact added successfully!" :
                        formType === "accounts" ? "Account added successfully!" :
                        formType === "products" ? "Product added successfully!" :
                        "Deal added successfully!"
                      );
                    }
                  } catch {}
                  try {
                    if (formType === "deals" && typeof window.refetchDeals === "function") window.refetchDeals();
                    if (formType === "contacts" && typeof window.refetchContacts === "function") window.refetchContacts();
                    if (formType === "accounts" && typeof window.refetchAccounts === "function") window.refetchAccounts();
                    if (formType === "products" && typeof window.refetchProducts === "function") window.refetchProducts();
                  } catch {}
                }}
                onError={() => {
                  try {
                    if (typeof window.addToast === "function") {
                      window.addToast(
                        formType === "contacts" ? "Failed to add contact" :
                        formType === "accounts" ? "Failed to add account" :
                        formType === "products" ? "Failed to add product" :
                        "Failed to add deal",
                        "error"
                      );
                    } else {
                      alert("Error saving data");
                    }
                  } catch { alert("Error saving data"); }
                }}
              />
            </div>
          </div>
          </div>
        </>,
        document.body
      )}

      {/* Email panel via portal */}
      {showEmailPanel && createPortal(<Email onClose={() => setShowEmailPanel(false)} />, document.body)}
    </header>
  );
}

export default Header;