import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import WindowLogo from "../assets/Window.png";

/* ── UI SVG icons ───────────────────────────────────────────── */
const FiMenu = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

/* ── Custom branded SVG icons ───────────────────────────────── */
const HomeIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
);

const AccountsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

const ContactsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const ProductsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const DealsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

const OutlookIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polyline points="2,4 12,13 22,4"/>
  </svg>
);

const TeamsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

function Sidebar({ activeContent, openOrActivateTab, setShowPanel }) {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef(null);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setSidebarOpen(false);
      }
    }

    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarOpen]);

  const handleNavClick = (tabId, path) => {
    openOrActivateTab(tabId);
    setShowPanel(false);
    navigate(path);
    setSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  const navItems = [
    { id: "home", label: "Home", icon: HomeIcon, path: "/dashboard" },
    { id: "accounts", label: "Accounts", icon: AccountsIcon, path: "/dashboard/Accounts" },
    { id: "contacts", label: "Contacts", icon: ContactsIcon, path: "/dashboard/contacts" },
    { id: "products", label: "Products", icon: ProductsIcon, path: "/dashboard/Products" },
    { id: "deals", label: "Deals", icon: DealsIcon, path: "/dashboard/Deals" },
    {
      id: "outlookEmail",
      label: "Email",
      icon: OutlookIcon,
      path: "/dashboard/OutlookEmail",
      onClick: async () => {
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
            handleNavClick("outlookEmail", "/dashboard/OutlookEmail");
          } catch (error) {
            console.error("Login failed:", error);
          }
        } else {
          handleNavClick("outlookEmail", "/dashboard/OutlookEmail");
        }
      },
    },
    { id: "teams", label: "Teams", icon: TeamsIcon, path: "/dashboard/Teams" },
  ];

  return (
    <>

      {/* Mobile Hamburger Button - visible only on mobile */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed left-1/2 bottom-4 z-[120] -translate-x-1/2 bg-transparent p-0 text-slate-500 hover:text-slate-700"
        aria-label="Toggle navigation menu"
      >
        <FiMenu size={26} />
      </button>

      {/* Mobile Sidebar Overlay - visible only on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 lg:hidden z-[90]" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <nav
        ref={sidebarRef}
        className={`
          fixed lg:relative
          left-0 top-14 lg:top-0
          h-[calc(125vh-3.5rem)] lg:h-full
          bg-white backdrop-blur-sm
          border-r border-slate-200
          z-[100] lg:z-10
          transform transition-all duration-300 ease-in-out
          flex flex-col
          ${sidebarOpen ? "translate-x-0 w-44" : "-translate-x-full lg:translate-x-0"}
          ${sidebarCollapsed ? "lg:w-16" : "lg:w-44"}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-[70px] px-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "lg:justify-center lg:w-full" : ""}`}>
            <img
              src={WindowLogo}
              alt="ELPIS CRM"
              className="h-6 w-6 object-contain flex-shrink-0"
            />
            {/* {!sidebarCollapsed && (
              // <h2 className="text-sm font-semibold text-slate-900 hidden lg:block">ELPIS</h2>
            )} */}
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeContent === item.id;
            return (
              <a
                key={item.id}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    handleNavClick(item.id, item.path);
                  }
                }}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 cursor-pointer
                  ${isActive
                    ? "bg-blue-100 text-black/65 border border-gray-300 font-medium"
                    : "text-slate-600 hover:bg-slate-100 transition-colors"
                  }
                `}
                title={item.label}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-xs font-medium truncate">{item.label}</span>
                )}
              </a>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-3 my-3 border-t border-slate-200" />

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="mb-4 hidden items-center justify-center self-center bg-transparent p-0 text-slate-500 hover:text-slate-700 lg:flex"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <FiMenu size={24} />
        </button>
      </nav>
    </>
  );
}

export default Sidebar;
