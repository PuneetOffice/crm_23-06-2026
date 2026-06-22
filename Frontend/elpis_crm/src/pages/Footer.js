import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import WindowLogo from "../assets/Window.png";

/* ── Icons ─────────────────────────────────────────────────────── */
const HomeIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
);

const AccountsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

const ContactsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const ProductsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const DealsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

const OutlookIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M14 3H4a2 2 0 00-2 2v14a2 2 0 002 2h10V3z" fill="#0078D4"/>
    <path d="M14 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6V3z" fill="#28A8E8"/>
    <path d="M14 3l3.5 5.5L22 3" fill="none" stroke="white" strokeWidth="0.7" strokeLinecap="round"/>
    <line x1="14" y1="3" x2="14" y2="21" stroke="white" strokeWidth="0.6"/>
    <circle cx="8" cy="12" r="4" fill="white"/>
    <circle cx="8" cy="12" r="2.2" fill="#0078D4"/>
  </svg>
);

const TeamsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="17" cy="5.5" r="2.8" fill="#7B83EB"/>
    <path d="M12.5 10h9a1 1 0 011 1v5.5a1 1 0 01-1 1h-9V10z" fill="#7B83EB"/>
    <circle cx="8" cy="5" r="3.8" fill="#5059C9"/>
    <rect x="1" y="9" width="14" height="13" rx="2.5" fill="#5059C9"/>
    <rect x="4.5" y="12.5" width="7" height="1.8" rx="0.9" fill="white"/>
    <rect x="7" y="12.5" width="2" height="7" rx="1" fill="white"/>
  </svg>
);

const PinIcon = ({ size = 13, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3 7h4l-3.5 5 1.5 7L12 18l-5 3 1.5-7L5 9h4l3-7z"/>
  </svg>
);

/* ── All possible nav items (full sidebar set) ──────────────────── */
const ALL_ITEMS = [
  { id: "home",         label: "Home",     Icon: HomeIcon,     path: "/dashboard" },
  { id: "accounts",    label: "Accounts", Icon: AccountsIcon, path: "/dashboard/Accounts" },
  { id: "contacts",    label: "Contacts", Icon: ContactsIcon, path: "/dashboard/contacts" },
  { id: "products",    label: "Products", Icon: ProductsIcon, path: "/dashboard/Products" },
  { id: "deals",       label: "Deals",    Icon: DealsIcon,    path: "/dashboard/Deals" },
  { id: "outlookEmail",label: "Email",    Icon: OutlookIcon,  path: "/dashboard/OutlookEmail" },
  { id: "teams",       label: "Teams",    Icon: TeamsIcon,    path: "/dashboard/Teams" },
];

/* Default: only Email + Teams pinned to footer */
const DEFAULT_PINNED = ["outlookEmail", "teams"];

function Footer({ activeContent, openOrActivateTab, setShowPanel, onPinChange }) {
  const navigate    = useNavigate();
  const menuRef     = useRef(null);

  const [pinned,       setPinned]       = useState(true);
  const [hovered,      setHovered]      = useState(false);
  const [clock,        setClock]        = useState(new Date());
  /* ids of items currently pinned to the footer */
  const [visibleIds,   setVisibleIds]   = useState(DEFAULT_PINNED);
  /* context menu: { id, x, y } | null */
  const [contextMenu,  setContextMenu]  = useState(null);
  /* pin-to-taskbar picker menu */
  const [showPinMenu,  setShowPinMenu]  = useState(false);
  const pinMenuRef = useRef(null);

  /* live clock */
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  /* close context menu on outside click */
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [contextMenu]);

  /* close pin menu on outside click */
  useEffect(() => {
    if (!showPinMenu) return;
    const close = (e) => {
      if (pinMenuRef.current && !pinMenuRef.current.contains(e.target)) {
        setShowPinMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showPinMenu]);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    onPinChange(next);
  };

  const handleNav = (item) => {
    openOrActivateTab(item.id);
    setShowPanel(false);
    navigate(item.path);
  };

  const handleRightClick = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const handleUnpin = (id) => {
    setVisibleIds(prev => prev.filter(v => v !== id));
    setContextMenu(null);
  };

  const handlePinBack = (id) => {
    setVisibleIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setShowPinMenu(false);
  };

  const hiddenItems = ALL_ITEMS.filter(i => !visibleIds.includes(i.id));

  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });

  const translateY = !pinned && !hovered ? "calc(100% - 5px)" : "0%";
  const visibleItems = ALL_ITEMS.filter(i => visibleIds.includes(i.id));

  return (
    <>
      {/* ── Context Menu ─────────────────────────────────────────── */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top:  contextMenu.y - 40,
            left: contextMenu.x,
            zIndex: 9999,
            background: "#1e2330",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
            minWidth: "190px",
            overflow: "hidden",
          }}
        >
          {/* Context menu header — icon name */}
          <div style={{
            padding: "8px 14px 6px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.4)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            {ALL_ITEMS.find(i => i.id === contextMenu.id)?.label}
          </div>

          {/* Unpin from taskbar */}
          <button
            onClick={() => handleUnpin(contextMenu.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "9px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.85)",
              fontSize: "12px",
              textAlign: "left",
              minHeight: "unset",
              minWidth: "unset",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {/* unpin icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="20" y2="20"/>
              <path d="M12 2l3 7h4l-3.5 5 1.5 7L12 18l-5 3 1.5-7L5 9h4l3-7z"/>
            </svg>
            Unpin from taskbar
          </button>
        </div>
      )}

      {/* ── Footer bar ───────────────────────────────────────────── */}
      <footer
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "52px",
          zIndex: 50,
          transform: `translateY(${translateY})`,
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          background: "linear-gradient(to bottom, #1e2330, #161b27)",
          borderTop: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 -6px 28px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: "12px",
        }}
      >
        {/* Left — logo + copyright */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "200px", flexShrink: 0 }}>
          <img src={WindowLogo} alt="Elpis" style={{ height: "20px", width: "20px", objectFit: "contain", opacity: 0.85 }} />
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
            © {new Date().getFullYear()} Elpis IT Solutions. All rights reserved.
          </span>
        </div>

        {/* Center — nav icons */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
          {/* Pin-to-taskbar "+" button — only shown when items are hidden */}
          {hiddenItems.length > 0 && (
            <div style={{ position: "relative" }} ref={pinMenuRef}>
              <button
                onClick={() => setShowPinMenu(v => !v)}
                title="Pin to taskbar"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  background: showPinMenu ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                  border: "1px dashed rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  minWidth: "40px",
                  minHeight: "unset",
                  color: "rgba(255,255,255,0.5)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseLeave={e => e.currentTarget.style.background = showPinMenu ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span style={{ fontSize: "9px", lineHeight: 1, letterSpacing: "0.03em" }}>Add</span>
              </button>

              {/* Dropdown: Pin to taskbar options */}
              {showPinMenu && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#1e2330",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
                  minWidth: "190px",
                  overflow: "hidden",
                  zIndex: 9999,
                }}>
                  <div style={{
                    padding: "8px 14px 6px",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.4)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    Pin to taskbar
                  </div>
                  {hiddenItems.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => handlePinBack(id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "9px 14px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "rgba(255,255,255,0.85)",
                        fontSize: "12px",
                        textAlign: "left",
                        minHeight: "unset",
                        minWidth: "unset",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Icon size={16} />
                      Pin {label} to taskbar
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {visibleItems.map(({ id, label, Icon, path }) => {
            const isActive = activeContent === id;
            return (
              <button
                key={id}
                onClick={() => handleNav({ id, path })}
                onContextMenu={(e) => handleRightClick(e, id)}
                title={`${label} — right-click for options`}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  padding: "4px 14px",
                  borderRadius: "8px",
                  background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  minWidth: "60px",
                  transition: "background 0.15s",
                  minHeight: "unset",
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.14)" : "transparent";
                }}
              >
                <span style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.75)", display: "flex" }}>
                  <Icon size={22} />
                </span>
                <span style={{
                  fontSize: "9px",
                  color: isActive ? "#e2e8f0" : "rgba(255,255,255,0.5)",
                  letterSpacing: "0.03em",
                  lineHeight: 1,
                }}>
                  {label}
                </span>
                {isActive && (
                  <span style={{
                    position: "absolute",
                    bottom: "2px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "18px",
                    height: "3px",
                    borderRadius: "9999px",
                    background: "#60a5fa",
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Right — pin + clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "120px", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            onClick={togglePin}
            title={pinned ? "Unpin footer (auto-hide)" : "Pin footer"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "6px",
              background: pinned ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.07)",
              border: pinned ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
              color: pinned ? "#93c5fd" : "rgba(255,255,255,0.5)",
              transition: "all 0.15s",
              minHeight: "unset",
              minWidth: "unset",
            }}
          >
            <PinIcon size={13} filled={pinned} />
            <span style={{ fontSize: "10px", lineHeight: 1 }}>{pinned ? "Pinned" : "Pin"}</span>
          </button>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", fontWeight: 500, lineHeight: 1.3 }}>
              {timeStr}
            </span>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>
              {dateStr}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Footer;
