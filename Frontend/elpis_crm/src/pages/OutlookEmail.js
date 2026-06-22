import React, { useState, useEffect, useRef } from "react";
import {
  Inbox, Send, Trash2, Edit2, Reply, ReplyAll, Forward, ArrowLeft,
  Mail, MailOpen, Paperclip, Plus, Pencil, FileText, Archive,
  AlertTriangle, Flag, Tag, Bell, Settings, Search, Sun, Moon,
  ChevronDown, ChevronRight, ChevronLeft, Star, Clock, Calendar,
  Users, CheckSquare, Download, Filter, Sparkles,
  X, Printer, RefreshCw, Link, UserPlus, Eye,
  Check, Pin, Activity, User,
  MessageSquare, LogOut, HelpCircle, FolderOpen, AlertCircle,
  AtSign, ArrowUpDown,
  MapPin, Video, Link2, Smile, Copy, Globe, Mic, ExternalLink, Bookmark, Lock, Menu,
} from "lucide-react";
import { FiTrash2 } from "react-icons/fi";
import Email from "./Email";
import apiClient from "../api/client";
import { useMsal } from "@azure/msal-react";
import DOMPurify from "dompurify";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// 1x1 transparent GIF used as fallback for cid: images that have no contentBytes
const TRANSPARENT_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function replaceCidImages(html, attachments = []) {
  if (!html) return html;
  let result = html;
  attachments.forEach(att => {
    if (!att.contentId) return;
    const cleanCid = att.contentId.replace(/[<>]/g, "");
    if (!att.contentBytes || !att.contentType) {
      // No data available — replace with transparent placeholder to avoid ERR_UNKNOWN_URL_SCHEME
      [
        `cid:${cleanCid}`, `cid:${cleanCid}:1`, `cid:${cleanCid}:2`,
        `cid:${cleanCid}@`, att.contentId, `cid:${att.contentId}`,
      ].forEach(p => { result = result.split(p).join(TRANSPARENT_GIF); });
      return;
    }
    const base64Src = `data:${att.contentType};base64,${att.contentBytes}`;
    [
      `cid:${cleanCid}`, `cid:${cleanCid}:1`, `cid:${cleanCid}:2`,
      `cid:${cleanCid}@`, att.contentId, `cid:${att.contentId}`,
      `<${cleanCid}>`, `"cid:${cleanCid}"`, `'cid:${cleanCid}'`, cleanCid,
    ].forEach(p => { result = result.split(p).join(base64Src); });
  });
  // Strip any remaining cid: references that didn't match any attachment
  result = result.replace(/src\s*=\s*["']cid:[^"']*["']/gi, `src="${TRANSPARENT_GIF}"`);
  return result;
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

// Splits an email HTML body at Outlook reply/forward dividers into sections
function splitEmailBody(html) {
  if (!html) return [html];
  // Mark split points: <div id="divRplyFwdMsg"...> and standalone <hr> that Outlook inserts
  const marked = html
    .replace(/<div[^>]*id\s*=\s*["']divRplyFwdMsg["'][^>]*>/gi, "<!--SPLIT--><div id=\"divRplyFwdMsg\">")
    .replace(/<hr\s*[^>]*>/gi, (m) => `<!--SPLIT-->${m}`);
  const parts = marked.split("<!--SPLIT-->").map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return [html];
  // Re-close any unclosed tags in the first part by appending remaining as-is
  return parts;
}

function fmtDateTime(d) {
  if (!d) return "";
  const date = new Date(d), now = new Date();
  const diff = now - date, h = Math.floor(diff / 3600000);
  if (h < 24) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (h < 48) return "Yesterday";
  if (h < 168) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTimeAgo(d) {
  if (!d) return "";
  const date = new Date(d), now = new Date();
  const diff = now - date;
  if (diff < 0) {
    const mins = Math.round(-diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.round(-diff / 3600000);
    return hrs < 24 ? `in ${hrs}h` : `in ${Math.round(-diff / 86400000)}d`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return days < 7 ? `${days}d ago` : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────
function calDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function calAddDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sunday
  const days = [];
  for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), curr: false });
  for (let d = 1; d <= lastDay.getDate(); d++) days.push({ date: new Date(year, month, d), curr: true });
  while (days.length < 42) days.push({ date: new Date(year, month + 1, days.length - startDow - lastDay.getDate() + 1), curr: false });
  return days;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-rose-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-pink-500",
];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

const CATEGORY_COLORS = {
  red: { bg: "bg-red-100", dot: "bg-red-500", text: "text-red-700", label: "Red category" },
  orange: { bg: "bg-orange-100", dot: "bg-orange-500", text: "text-orange-700", label: "Orange category" },
  yellow: { bg: "bg-yellow-100", dot: "bg-yellow-400", text: "text-yellow-700", label: "Yellow category" },
  green: { bg: "bg-green-100", dot: "bg-green-500", text: "text-green-700", label: "Green category" },
  blue: { bg: "bg-blue-100", dot: "bg-blue-500", text: "text-blue-700", label: "Blue category" },
  purple: { bg: "bg-purple-100", dot: "bg-purple-500", text: "text-purple-700", label: "Purple category" },
};

// ─── Isolated email body renderer ────────────────────────────────────────────
function EmailBodyFrame({ html, isDark }) {
  const frameId = useRef("ef-" + Math.random().toString(36).slice(2));
  const [frameHeight, setFrameHeight] = useState(120);

  // Listen for height updates sent via postMessage from inside the iframe
  useEffect(() => {
    const id = frameId.current;
    const handler = (e) => {
      if (e.data?.type === "email-frame-resize" && e.data?.id === id) {
        setFrameHeight(Math.max(120, (e.data.height || 0) + 16));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // DOMPurify strips all email-sourced scripts; our own resize script is injected below
  const sanitized = DOMPurify.sanitize(html || "", {
    ADD_DATA_URI_TAGS: ["img"],
    FORBID_TAGS: ["script", "noscript", "object", "embed", "applet", "form"],
    FORBID_ATTR: [
      "onerror","onload","onclick","ondblclick","onmousedown","onmouseup","onmouseover",
      "onmouseout","onmousemove","onkeydown","onkeyup","onkeypress","onchange","onsubmit",
      "onreset","onselect","onblur","onfocus","onabort","onscroll","onresize","onunload",
      "onbeforeunload","ondragstart","ondrop","oncontextmenu","onwheel","oninput","oninvalid",
    ],
  });

  const id = frameId.current;
  const darkCss = isDark
    ? "html,body,body *{background-color:transparent!important;color:#ffffff!important;}"
    : "";

  // Resize script: re-sends height after every image load and on mutations,
  // so the iframe grows correctly once images finish loading.
  const resizeScript = `
(function(){
  var ID="${id}";
  function send(){
    var h=document.body?document.body.scrollHeight:0;
    window.parent.postMessage({type:"email-frame-resize",id:ID,height:h},"*");
  }
  send();
  window.addEventListener("load",send);
  document.querySelectorAll("img").forEach(function(img){
    if(!img.complete){img.addEventListener("load",send);img.addEventListener("error",send);}
  });
  new MutationObserver(send).observe(document.documentElement,{subtree:true,childList:true,attributes:true});
  [200,600,1200].forEach(function(t){setTimeout(send,t);});
})();`;

  const srcdoc = [
    "<!DOCTYPE html><html><head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "<style>",
    "html,body{margin:0;padding:8px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;word-wrap:break-word;overflow-x:hidden;}",
    "img{max-width:100%;height:auto;display:inline-block;}",
    "table{border-collapse:collapse;max-width:100%;}",
    "a{color:inherit;word-break:break-all;}",
    darkCss,
    "</style></head><body>",
    sanitized,
    "<script>", resizeScript, "<\/script>",
    "</body></html>",
  ].join("");

  return (
    <iframe
      srcDoc={srcdoc}
      title="email-body"
      sandbox="allow-scripts"
      style={{ width: "100%", border: "none", height: frameHeight + "px", display: "block" }}
    />
  );
}

// ─── File type icon helper ────────────────────────────────────────────────────
function FileIcon({ name, size = 14 }) {
  const ext = (name || "").split(".").pop().toLowerCase();
  const colorMap = {
    pdf: "text-red-500", doc: "text-blue-600", docx: "text-blue-600",
    xls: "text-green-600", xlsx: "text-green-600", ppt: "text-orange-500",
    pptx: "text-orange-500", jpg: "text-purple-500", jpeg: "text-purple-500",
    png: "text-purple-500", gif: "text-pink-500", zip: "text-yellow-600",
    txt: "text-gray-500",
  };
  return <FileText size={size} className={colorMap[ext] || "text-gray-400"} />;
}

// ─── App-rail item ────────────────────────────────────────────────────────────
function RailItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
        active ? "bg-white/20 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={20} />
      {badge > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

// ─── Folder row in sidebar ────────────────────────────────────────────────────
function FolderRow({ icon: Icon, label, active, count, pinned, onPin, onClick, isDark }) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition ${
        active
          ? isDark ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
          : isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && (
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${active ? "bg-white/20 text-white" : isDark ? "bg-gray-600 text-gray-200" : "bg-blue-100 text-blue-700"}`}>
          {count}
        </span>
      )}
      {onPin && (
        <Pin
          size={12}
          onClick={e => { e.stopPropagation(); onPin(); }}
          className={`hidden group-hover:block flex-shrink-0 ${pinned ? "text-blue-500" : "text-gray-400"}`}
        />
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function OutlookEmail({ onToast }) {
  const { instance, accounts } = useMsal();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [accessToken, setAccessToken] = useState("");

  // ── App Shell ─────────────────────────────────────────────────────────────
  const [activeApp, setActiveApp] = useState("Mail");
  const [isDark, setIsDark] = useState(false);

  // ── Mail Sidebar ──────────────────────────────────────────────────────────
  const [activeFolder, setActiveFolder] = useState("Inbox");
  const [expandedSections, setExpandedSections] = useState({ favorites: true, folders: true, groups: false });
  const [pinnedFolders, setPinnedFolders] = useState(["Inbox", "Sent Items"]);

  // ── Email Data ────────────────────────────────────────────────────────────
  const [inboxEmails, setInboxEmails] = useState([]);
  const [sentMails, setSentMails] = useState([]);
  const [trashMails, setTrashMails] = useState([]);
  const [draftMails, setDraftMails] = useState([]);
  const [junkMails, setJunkMails] = useState([]);
  const [archiveMails, setArchiveMails] = useState([]);
  const [apiTemplates, setApiTemplates] = useState([]);

  // ── Email List UI ─────────────────────────────────────────────────────────
  const [emailSearch, setEmailSearch] = useState("");
  const [inboxTab, setInboxTab] = useState("Focused");
  const [sortBy, setSortBy] = useState("date");
  const [filterBy, setFilterBy] = useState("all");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // ── Responsive / Mobile ───────────────────────────────────────────────────
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // "list" | "email"

  // ── Email Actions ─────────────────────────────────────────────────────────
  const [openedMailId, setOpenedMailId] = useState(null);
  const [selectedMailIds, setSelectedMailIds] = useState([]);
  const [flaggedIds, setFlaggedIds] = useState({});
  const [readOverrides, setReadOverrides] = useState({});
  const [mailCategories, setMailCategories] = useState({});
  const [showCategoryMenu, setShowCategoryMenu] = useState(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(null);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCandidateIds, setDeleteCandidateIds] = useState([]);

  // ── Reading Pane ──────────────────────────────────────────────────────────
  const [toExpanded, setToExpanded] = useState(false);
  const [ccExpanded, setCcExpanded] = useState(false);
  const [showCrmPanel, setShowCrmPanel] = useState(false);
  const [crmTab, setCrmTab] = useState("actions");

  // ── Thread / Conversation ─────────────────────────────────────────────────
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadExpandedIds, setThreadExpandedIds] = useState(new Set());
  const [threadBodies, setThreadBodies] = useState({});

  // ── Compose ───────────────────────────────────────────────────────────────
  const [showCompose, setShowCompose] = useState(false);
  const [replyData, setReplyData] = useState(null);

  // ── Inline reply (shown inside the reading pane, no popup) ────────────────
  const [inlineReply, setInlineReply]     = useState(null); // {type,toEmail,ccEmail,subject,originalBody}
  const [inlineToInput, setInlineToInput]           = useState("");
  const [inlineBody, setInlineBody]                 = useState("");
  const [inlineSending, setInlineSending]           = useState(false);
  const [inlineError, setInlineError]               = useState("");
  const [inlineSendDropdown, setInlineSendDropdown] = useState(false);
  const [scheduleModal, setScheduleModal]           = useState(false);
  const [scheduleDateTime, setScheduleDateTime]     = useState("");
  const [schedulingInProgress, setSchedulingInProgress] = useState(false);

  // ── Side Panels ───────────────────────────────────────────────────────────
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── Templates ─────────────────────────────────────────────────────────────
  const [openedTemplateIdx, setOpenedTemplateIdx] = useState(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", body: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editTemplateIdx, setEditTemplateIdx] = useState(null);
  const [editTemplate, setEditTemplate] = useState({ subject: "", body: "" });

  // ── Settings ──────────────────────────────────────────────────────────────
  const [settingsTab, setSettingsTab] = useState("account");
  const [signature, setSignature] = useState("");
  const [autoReply, setAutoReply] = useState({ enabled: false, message: "" });

  // ── Copilot ───────────────────────────────────────────────────────────────
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotHistory, setCopilotHistory] = useState([
    { role: "assistant", text: "Hi! I can summarize emails, draft replies, extract tasks, and more. Select an email to get started." },
  ]);

  // ── Calendar ──────────────────────────────────────────────────────────────
  const _today = new Date();
  const [calView, setCalView] = useState("Month");
  const [calDate, setCalDate] = useState(new Date(_today.getFullYear(), _today.getMonth(), 1));
  const [miniCalDate, setMiniCalDate] = useState(new Date(_today.getFullYear(), _today.getMonth(), 1));
  const [selectedCalDay, setSelectedCalDay] = useState(new Date(_today));
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormDate, setEventFormDate] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStart, setNewEventStart] = useState("12:00");
  const [newEventEnd, setNewEventEnd] = useState("12:30");
  const [newEventColor, setNewEventColor] = useState("blue");
  const [, setNewEventAttendees] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [outlookPeople, setOutlookPeople]         = useState([]);
  const [evSelectedAttendees, setEvSelectedAttendees] = useState([]);
  const [evAttendeeSearch, setEvAttendeeSearch]   = useState("");
  const [showEvAttendeePicker, setShowEvAttendeePicker] = useState(false);
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventOnline, setNewEventOnline] = useState(false);
  const [newEventAgenda, setNewEventAgenda] = useState("");
  const [evBusyStatus, setEvBusyStatus] = useState("Busy");
  const [showEvBusyDd, setShowEvBusyDd] = useState(false);
  const [evReminder, setEvReminder] = useState("15 minutes before");
  const [showEvReminderDd, setShowEvReminderDd] = useState(false);
  const [evCategory, setEvCategory] = useState(null);
  const [showEvCategoryDd, setShowEvCategoryDd] = useState(false);
  const [evPrivacy, setEvPrivacy] = useState("Not private");
  const [showEvPrivacyDd, setShowEvPrivacyDd] = useState(false);
  const [calEvents, setCalEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  // ─── Reset on folder change ───────────────────────────────────────────────
  useEffect(() => {
    setEmailSearch("");
    setOpenedMailId(null);
    setSelectedMailIds([]);
    setShowAddTemplate(false);
    setShowCrmPanel(false);
    setShowCategoryMenu(null);
    setShowSnoozeMenu(null);
  }, [activeFolder]);

  useEffect(() => {
    setToExpanded(false);
    setCcExpanded(false);
    setShowCategoryMenu(null);
  }, [openedMailId]);

  // ─── Close menus on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setShowSortMenu(false);
      setShowFilterMenu(false);
      setShowCategoryMenu(null);
      setShowSnoozeMenu(null);
      setShowUserMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ─── Auth token ───────────────────────────────────────────────────────────
  // Use accountId (stable string) instead of accounts array to avoid re-runs
  // every time MSAL internally updates the accounts reference.
  const accountId = accounts[0]?.localAccountId ?? null;
  useEffect(() => {
    const getToken = async () => {
      if (!accountId) { setAccessToken(""); return; }
      try {
        const r = await instance.acquireTokenSilent({
          account: accounts[0],
          scopes: [
            "https://graph.microsoft.com/User.Read",
            "https://graph.microsoft.com/Mail.Read",
            "https://graph.microsoft.com/Mail.ReadWrite",
            "https://graph.microsoft.com/Mail.Send",
            "https://graph.microsoft.com/Contacts.Read",
            "https://graph.microsoft.com/Calendars.ReadWrite",
          ],
        });
        setAccessToken(r.accessToken);
      } catch (e) {
        if (e?.name === "InteractionRequiredAuthError") {
          setAccessToken(""); // needs re-login
        } else if (e?.errorCode !== "interaction_in_progress") {
          console.warn("[OutlookEmail] Silent token failed:", e?.errorCode || e?.name);
          setAccessToken("");
        }
      }
    };
    getToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]); // stable — only re-run when signed-in user changes

  // ─── Notifications fetch (uses existing accessToken — no extra silent calls) ──
  useEffect(() => {
    const fetchNotifs = async () => {
      if (!accessToken) return;
      setNotifLoading(true);
      const notifs = [];
      const h = { Authorization: `Bearer ${accessToken}` };

      // 1. Recent unread emails
      try {
        const r = await fetch(
          "https://graph.microsoft.com/v1.0/me/messages" +
          "?$filter=isRead eq false&$top=3&$orderby=receivedDateTime desc" +
          "&$select=id,subject,bodyPreview,from,receivedDateTime,isRead",
          { headers: h }
        );
        if (r.ok) {
          const d = await r.json();
          (d.value || []).forEach(msg => {
            const sender = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown";
            notifs.push({
              id: `email-${msg.id}`, type: "email",
              title: `New email from ${sender}`,
              body: (msg.bodyPreview || msg.subject || "").slice(0, 90),
              time: fmtTimeAgo(msg.receivedDateTime),
              read: !!msg.isRead, graphId: msg.id,
            });
          });
        }
      } catch {}

      // 2. Upcoming calendar events — Calendars.ReadWrite token already acquired above
      try {
        const now = new Date();
        const end24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const r = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarView` +
          `?startDateTime=${now.toISOString()}&endDateTime=${end24h.toISOString()}` +
          `&$select=id,subject,start,end&$top=3&$orderby=start/dateTime`,
          { headers: h }
        );
        if (r.ok) {
          const d = await r.json();
          (d.value || []).forEach(ev => {
            const startDt = new Date(ev.start.dateTime.endsWith("Z") ? ev.start.dateTime : ev.start.dateTime + "Z");
            const diffMin = Math.round((startDt - now) / 60000);
            notifs.push({
              id: `meeting-${ev.id}`, type: "meeting",
              title: ev.subject || "Upcoming meeting",
              body: diffMin <= 0 ? "Happening now" : diffMin < 60 ? `Starts in ${diffMin} min` : `Starts in ${Math.round(diffMin / 60)}h`,
              time: fmtTimeAgo(ev.start.dateTime.endsWith("Z") ? ev.start.dateTime : ev.start.dateTime + "Z"),
              read: diffMin > 30, graphId: ev.id,
            });
          });
        }
      } catch {}

      setNotifications(notifs);
      setNotifLoading(false);
    };
    fetchNotifs();
  }, [accessToken, notifRefreshKey]); // no accounts/instance — avoids MSAL re-run churn

  // ─── Outlook contacts fetch for event attendee picker ───────────────────────
  // NOTE: People.Read requires admin consent → skipped to avoid 400/403 errors.
  // Contacts.Read is user-delegated and works without admin consent.
  useEffect(() => {
    if (!accessToken || !accountId) return;
    const fetchOutlookPeople = async () => {
      try {
        const contactsRes = await fetch(
          "https://graph.microsoft.com/v1.0/me/contacts?$top=200&$select=displayName,emailAddresses,jobTitle,companyName&$orderby=displayName",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!contactsRes.ok) return;
        const d = await contactsRes.json();
        const seen = new Set();
        const merged = [];
        for (const c of (d.value || [])) {
          const email = c.emailAddresses?.[0]?.address;
          if (!email || seen.has(email.toLowerCase())) continue;
          seen.add(email.toLowerCase());
          merged.push({ name: c.displayName || email, email, title: c.jobTitle || c.companyName || "", source: "contact" });
        }
        setOutlookPeople(merged);
      } catch { /* network/permission errors — fail silently */ }
    };
    fetchOutlookPeople();
  }, [accessToken, accountId]); // accountId is stable string — no re-run churn

  // ─── Inbox fetch (no attachment expansion — loaded lazily on open) ──────────
  useEffect(() => {
    const load = async () => {
      if (!accessToken || activeFolder !== "Inbox") return;
      try {
        const res = await fetch(
          "https://graph.microsoft.com/v1.0/me/messages?" +
          "$top=50&$orderby=receivedDateTime desc" +
          "&$select=id,subject,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,hasAttachments,isRead,importance",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) { setInboxEmails([]); return; }
        const data = await res.json();
        setInboxEmails((data.value || []).map(msg => {
          const senderName = msg.from?.emailAddress?.name || msg.sender?.emailAddress?.name || msg.from?.emailAddress?.address || "";
          return {
            id: msg.id, subject: msg.subject,
            body: "", bodyPreview: msg.bodyPreview || "", attachments: [],
            hasAttachments: msg.hasAttachments, bodyLoaded: false,
            toEmail: msg.toRecipients?.map(r => r.emailAddress.address).join(", ") || "",
            ccEmail: msg.ccRecipients?.map(r => r.emailAddress.address).join(", ") || "",
            receivedDateTime: msg.receivedDateTime, sender: senderName, from: senderName,
            senderEmail: msg.from?.emailAddress?.address || msg.sender?.emailAddress?.address || "",
            isRead: msg.isRead, importance: msg.importance,
          };
        }));
      } catch (e) { console.error("Inbox fetch error:", e); setInboxEmails([]); }
    };
    load();
  }, [accessToken, activeFolder]);

  // ─── Sent fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (activeFolder !== "Sent" || !accessToken) return;
      try {
        const res = await fetch(
          "https://graph.microsoft.com/v1.0/me/mailfolders/sentitems/messages?" +
          "$top=50&$orderby=sentDateTime desc" +
          "&$select=id,subject,bodyPreview,from,toRecipients,ccRecipients,sentDateTime,hasAttachments",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) { setSentMails([]); return; }
        const data = await res.json();
        setSentMails((data.value || []).map(msg => {
          const senderName = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "";
          return {
            id: msg.id, subject: msg.subject,
            body: "", bodyPreview: msg.bodyPreview || "", attachments: [],
            hasAttachments: msg.hasAttachments, bodyLoaded: false,
            toEmail: msg.toRecipients?.map(r => r.emailAddress.address).join(", ") || "",
            ccEmail: msg.ccRecipients?.map(r => r.emailAddress.address).join(", ") || "",
            sentDateTime: msg.sentDateTime, sender: senderName, from: senderName,
            senderEmail: msg.from?.emailAddress?.address || "", isRead: true,
          };
        }));
      } catch (e) { console.error("Sent fetch error:", e); setSentMails([]); }
    };
    load();
  }, [activeFolder, accessToken]);

  // ─── Trash fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (activeFolder !== "Deleted" || !accessToken) return;
      try {
        const res = await fetch(
          "https://graph.microsoft.com/v1.0/me/mailfolders/deleteditems/messages?" +
          "$top=50&$orderby=receivedDateTime desc" +
          "&$select=id,subject,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,hasAttachments",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) { setTrashMails([]); return; }
        const data = await res.json();
        setTrashMails((data.value || []).map(msg => {
          const senderName = msg.from?.emailAddress?.name || msg.sender?.emailAddress?.name || msg.from?.emailAddress?.address || "";
          return {
            id: msg.id, subject: msg.subject,
            body: "", bodyPreview: msg.bodyPreview || "", attachments: [],
            hasAttachments: msg.hasAttachments, bodyLoaded: false,
            toEmail: msg.toRecipients?.map(r => r.emailAddress.address).join(", ") || "",
            ccEmail: msg.ccRecipients?.map(r => r.emailAddress.address).join(", ") || "",
            receivedDateTime: msg.receivedDateTime, sender: senderName, from: senderName,
            senderEmail: msg.from?.emailAddress?.address || msg.sender?.emailAddress?.address || "",
          };
        }));
      } catch (e) { console.error("Trash fetch error:", e); setTrashMails([]); }
    };
    load();
  }, [activeFolder, accessToken]);

  // ─── Drafts fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (activeFolder !== "Drafts" || !accessToken) return;
      const res = await fetch(
        "https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages?" +
        "$top=50&$orderby=lastModifiedDateTime desc" +
        "&$select=id,subject,body,bodyPreview,from,toRecipients,ccRecipients,lastModifiedDateTime",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) { setDraftMails([]); return; }
      const data = await res.json();
      setDraftMails((data.value || []).map(msg => ({
        id: msg.id, subject: msg.subject, body: msg.body?.content || "",
        attachments: [],
        toEmail: msg.toRecipients?.map(r => r.emailAddress.address).join(", ") || "",
        ccEmail: msg.ccRecipients?.map(r => r.emailAddress.address).join(", ") || "",
        receivedDateTime: msg.lastModifiedDateTime,
        sender: msg.from?.emailAddress?.name || "(Draft)",
        from: msg.from?.emailAddress?.name || "(Draft)",
        senderEmail: msg.from?.emailAddress?.address || "",
        isDraft: true,
      })));
    };
    load();
  }, [activeFolder, accessToken]);

  // ─── Junk fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (activeFolder !== "Junk" || !accessToken) return;
      const res = await fetch(
        "https://graph.microsoft.com/v1.0/me/mailfolders/junkemail/messages?" +
        "$top=50&$orderby=receivedDateTime desc" +
        "&$select=id,subject,body,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,hasAttachments&$expand=attachments",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) { setJunkMails([]); return; }
      const data = await res.json();
      setJunkMails((data.value || []).map(msg => ({
        id: msg.id, subject: msg.subject, body: msg.body?.content || "",
        attachments: msg.attachments || [],
        toEmail: msg.toRecipients?.map(r => r.emailAddress.address).join(", ") || "",
        ccEmail: msg.ccRecipients?.map(r => r.emailAddress.address).join(", ") || "",
        receivedDateTime: msg.receivedDateTime,
        sender: msg.from?.emailAddress?.name || msg.sender?.emailAddress?.name || msg.from?.emailAddress?.address || "",
        from: msg.from?.emailAddress?.name || msg.sender?.emailAddress?.name || "",
        senderEmail: msg.from?.emailAddress?.address || msg.sender?.emailAddress?.address || "",
      })));
    };
    load();
  }, [activeFolder, accessToken]);

  // ─── Archive fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (activeFolder !== "Archive" || !accessToken) return;
      const res = await fetch(
        "https://graph.microsoft.com/v1.0/me/mailfolders/archive/messages?" +
        "$top=50&$orderby=receivedDateTime desc" +
        "&$select=id,subject,body,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,hasAttachments&$expand=attachments",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) { setArchiveMails([]); return; }
      const data = await res.json();
      setArchiveMails((data.value || []).map(msg => ({
        id: msg.id, subject: msg.subject, body: msg.body?.content || "",
        attachments: msg.attachments || [],
        toEmail: msg.toRecipients?.map(r => r.emailAddress.address).join(", ") || "",
        ccEmail: msg.ccRecipients?.map(r => r.emailAddress.address).join(", ") || "",
        receivedDateTime: msg.receivedDateTime,
        sender: msg.from?.emailAddress?.name || msg.sender?.emailAddress?.name || msg.from?.emailAddress?.address || "",
        from: msg.from?.emailAddress?.name || msg.sender?.emailAddress?.name || "",
        senderEmail: msg.from?.emailAddress?.address || msg.sender?.emailAddress?.address || "",
      })));
    };
    load();
  }, [activeFolder, accessToken]);

  // ─── Templates fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeFolder === "Templates") {
      apiClient.get("/Template")
        .then(r => setApiTemplates(Array.isArray(r.data) ? r.data : []))
        .catch(() => setApiTemplates([]));
    }
  }, [activeFolder]);

  // ─── Calendar events fetch (reuses main accessToken — Calendars.ReadWrite already in scope) ──
  useEffect(() => {
    const fetchCalEvents = async () => {
      if (!accessToken || activeApp !== "Calendar") return;
      setCalLoading(true);
      try {
        const y = calDate.getFullYear(), mo = calDate.getMonth();
        // Use local-midnight boundaries so the window aligns with the displayed month
        // Format as YYYY-MM-DDTHH:mm:ss without a Z suffix — Graph interprets bare
        // ISO strings as the user's mailbox timezone, avoiding UTC-offset shift issues.
        const pad2 = n => String(n).padStart(2, "0");
        const fmtLocal = d =>
          `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
        const startISO = fmtLocal(new Date(y, mo, 1, 0, 0, 0));
        const endISO   = fmtLocal(new Date(y, mo + 1, 0, 23, 59, 59));
        // $orderby is NOT supported on calendarView — sort client-side instead
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarView` +
          `?startDateTime=${encodeURIComponent(startISO)}&endDateTime=${encodeURIComponent(endISO)}` +
          `&$select=id,subject,start,end,color,categories&$top=200`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) { setCalLoading(false); return; }
        const data = await res.json();
        const COLOR_MAP = {
          blue: "blue", green: "green", red: "red", orange: "orange",
          purple: "purple", teal: "teal", pink: "red", yellow: "orange",
          grape: "purple", cyan: "teal",
        };
        const mapped = (data.value || []).map(ev => {
          // Graph returns start.dateTime in the mailbox tz without Z; parse as local
          const toLocal = s => new Date(s.endsWith("Z") ? s : s + "Z");
          const st = toLocal(ev.start.dateTime);
          const en = toLocal(ev.end.dateTime);
          return {
            id: ev.id, graphId: ev.id,
            title: ev.subject || "(No title)",
            date: calDateKey(st),
            start: `${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}`,
            end: `${String(en.getHours()).padStart(2, "0")}:${String(en.getMinutes()).padStart(2, "0")}`,
            color: COLOR_MAP[ev.color] || (ev.categories?.length ? "purple" : "blue"),
            _sortKey: st.getTime(),
          };
        });
        // Sort ascending by start time (calendarView doesn't support $orderby)
        mapped.sort((a, b) => a._sortKey - b._sortKey);
        setCalEvents(mapped);
      } catch (e) { console.error("Calendar fetch error:", e); }
      setCalLoading(false);
    };
    fetchCalEvents();
  }, [accessToken, activeApp, calDate]); // no accounts/instance — avoids MSAL re-run churn

  // ─── Reset thread state when switching emails ─────────────────────────────
  useEffect(() => {
    setThreadMessages([]);
    setThreadExpandedIds(new Set());
    setThreadBodies({});
  }, [openedMailId]);

  // ─── Lazy-load full body + attachments, then fetch conversation thread ─────
  useEffect(() => {
    const load = async () => {
      if (!accessToken || !openedMailId) return;
      const folderMap = { Inbox: inboxEmails, Sent: sentMails, Deleted: trashMails, Drafts: draftMails, Junk: junkMails, Archive: archiveMails };
      const arr = folderMap[activeFolder] || [];
      const idx = arr.findIndex(m => m.id === openedMailId);
      if (idx === -1) return;
      const msg = arr[idx];
      if (msg.bodyLoaded) {
        // Body already loaded — still fetch thread if not done yet
        if (msg.conversationId && threadMessages.length === 0) fetchThread(msg.conversationId, openedMailId);
        return;
      }
      try {
        const r = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${msg.id}?$expand=attachments&$select=id,body,attachments,conversationId`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!r.ok) return;
        const data = await r.json();
        const htmlBody = data.body?.content || "";
        const attachments = data.attachments || [];
        const body = replaceCidImages(htmlBody, attachments);
        const convId = data.conversationId || "";
        const updatedMsg = { ...msg, body, attachments, bodyLoaded: true, conversationId: convId };
        const setters = { Inbox: setInboxEmails, Sent: setSentMails, Deleted: setTrashMails, Drafts: setDraftMails, Junk: setJunkMails, Archive: setArchiveMails };
        const setter = setters[activeFolder];
        if (setter) setter(prev => { const c = [...prev]; c[idx] = updatedMsg; return c; });
        if (convId) fetchThread(convId, openedMailId);
      } catch (e) { console.error("Body load error:", e); }
    };

    const fetchThread = async (convId, currentId) => {
      try {
        const r = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages` +
          `?$filter=conversationId eq '${encodeURIComponent(convId).replace(/%27/g, "'")}'` +
          `&$count=true&$select=id,subject,from,sender,toRecipients,ccRecipients,receivedDateTime,bodyPreview&$top=50`,
          { headers: { Authorization: `Bearer ${accessToken}`, "ConsistencyLevel": "eventual" } }
        );
        if (!r.ok) return;
        const data = await r.json();
        const msgs = (data.value || []).map(m => ({
          id: m.id, subject: m.subject,
          sender: m.from?.emailAddress?.name || m.sender?.emailAddress?.name || m.from?.emailAddress?.address || "",
          senderEmail: m.from?.emailAddress?.address || "",
          toEmail: (m.toRecipients || []).map(x => x.emailAddress.address).join(", "),
          ccEmail: (m.ccRecipients || []).map(x => x.emailAddress.address).join(", "),
          receivedDateTime: m.receivedDateTime, bodyPreview: m.bodyPreview || "",
        })).sort((a, b) => new Date(a.receivedDateTime) - new Date(b.receivedDateTime));
        if (msgs.length > 1) {
          setThreadMessages(msgs);
          setThreadExpandedIds(new Set([currentId]));
        }
      } catch {}
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedMailId, accessToken]);

  const loadThreadBody = async (msgId) => {
    if (threadBodies[msgId]) return;
    try {
      const r = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${msgId}?$select=id,body`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!r.ok) return;
      const data = await r.json();
      const html = replaceCidImages(data.body?.content || "", []);
      setThreadBodies(prev => ({ ...prev, [msgId]: html }));
    } catch {}
  };

  const toggleThreadMsg = (msgId) => {
    setThreadExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) { next.delete(msgId); }
      else { next.add(msgId); loadThreadBody(msgId); }
      return next;
    });
  };

  // ─── Computed ─────────────────────────────────────────────────────────────
  const getCurrentMails = () => {
    const map = { Inbox: inboxEmails, Sent: sentMails, Deleted: trashMails, Drafts: draftMails, Junk: junkMails, Archive: archiveMails };
    return map[activeFolder] || [];
  };

  const openedMail = getCurrentMails().find(m => m.id === openedMailId) || null;

  const getFilteredMails = () => {
    let mails = getCurrentMails();
    const q = emailSearch.trim().toLowerCase();
    if (q) {
      mails = mails.filter(m =>
        (m.subject || "").toLowerCase().includes(q) ||
        (m.sender || m.from || "").toLowerCase().includes(q) ||
        (m.senderEmail || "").toLowerCase().includes(q) ||
        stripHtml(m.body || "").toLowerCase().includes(q)
      );
    }
    if (filterBy === "unread") mails = mails.filter(m => {
      const isRead = readOverrides[m.id] !== undefined ? readOverrides[m.id] : m.isRead;
      return !isRead;
    });
    if (filterBy === "flagged") mails = mails.filter(m => flaggedIds[m.id]);
    if (filterBy === "attachments") mails = mails.filter(m => m.attachments?.length > 0);
    if (sortBy === "sender") mails = [...mails].sort((a, b) => (a.sender || "").localeCompare(b.sender || ""));
    if (sortBy === "subject") mails = [...mails].sort((a, b) => (a.subject || "").localeCompare(b.subject || ""));
    return mails;
  };

  const folderCounts = {
    Inbox: inboxEmails.filter(m => !m.isRead).length,
    Drafts: draftMails.length,
    Junk: junkMails.length,
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const confirmDelete = ids => {
    const arr = Array.isArray(ids) ? ids.filter(Boolean) : [ids];
    if (!arr.length) return;
    setDeleteCandidateIds(arr);
    setShowDeleteConfirm(true);
  };

  const performDelete = async () => {
    const ids = deleteCandidateIds;
    if (!ids.length) { setShowDeleteConfirm(false); return; }
    if (accessToken) {
      await Promise.all(ids.map(id =>
        fetch(`https://graph.microsoft.com/v1.0/me/messages/${id}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {})
      ));
    }
    const filter = prev => prev.filter(m => !ids.includes(m.id));
    setInboxEmails(filter); setSentMails(filter); setTrashMails(filter);
    setDraftMails(filter); setJunkMails(filter); setArchiveMails(filter);
    setSelectedMailIds(p => p.filter(id => !ids.includes(id)));
    setOpenedMailId(null);
    setDeleteCandidateIds([]);
    setShowDeleteConfirm(false);
    if (onToast) onToast(`${ids.length} message(s) deleted`, "success");
  };

  const archiveMail = async mailId => {
    if (!accessToken) return;
    try {
      await fetch(`https://graph.microsoft.com/v1.0/me/messages/${mailId}/move`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: "archive" }),
      });
      setInboxEmails(p => p.filter(m => m.id !== mailId));
      setOpenedMailId(null);
      if (onToast) onToast("Email archived", "success");
    } catch {}
  };

  const toggleFlag = mailId => setFlaggedIds(p => ({ ...p, [mailId]: !p[mailId] }));

  const markAsRead = async mail => {
    if (!mail) return;
    const cur = readOverrides[mail.id] !== undefined ? readOverrides[mail.id] : mail.isRead;
    if (cur) return; // already read — do nothing
    setReadOverrides(p => ({ ...p, [mail.id]: true }));
    if (accessToken) {
      fetch(`https://graph.microsoft.com/v1.0/me/messages/${mail.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      }).catch(() => {});
    }
  };

  const toggleRead = async mail => {
    if (!mail) return;
    const cur = readOverrides[mail.id] !== undefined ? readOverrides[mail.id] : mail.isRead;
    setReadOverrides(p => ({ ...p, [mail.id]: !cur }));
    if (accessToken) {
      fetch(`https://graph.microsoft.com/v1.0/me/messages/${mail.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: !cur }),
      }).catch(() => {});
    }
  };

  const setCategory = (mailId, color) => {
    setMailCategories(p => ({ ...p, [mailId]: color === p[mailId] ? null : color }));
    setShowCategoryMenu(null);
  };

  const openInlineReply = (type) => {
    if (!openedMail) return;
    let toEmail = "";
    let ccEmail = "";
    if (type === "reply") {
      toEmail = openedMail.senderEmail || openedMail.sender || "";
    } else if (type === "replyAll") {
      const toList = Array.from(new Set([
        openedMail.senderEmail,
        ...(openedMail.toEmail || "").split(/[,;]/).map(e => e.trim()).filter(Boolean),
      ]));
      toEmail = toList.join(", ");
      ccEmail = openedMail.ccEmail || "";
    }
    const subject = type === "forward"
      ? (openedMail.subject?.startsWith("Fwd:") ? openedMail.subject : `Fwd: ${openedMail.subject || ""}`)
      : (openedMail.subject?.startsWith("Re:") ? openedMail.subject : `Re: ${openedMail.subject || ""}`);
    setInlineReply({ type, subject, ccEmail, originalBody: openedMail.body });
    setInlineToInput(toEmail);
    setInlineBody("");
    setInlineError("");
  };

  const handleReply    = () => openInlineReply("reply");
  const handleReplyAll = () => openInlineReply("replyAll");
  const handleForward  = () => openInlineReply("forward");

  const handleInlineSend = async () => {
    const toEmails = inlineToInput.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    if (!toEmails.length) { setInlineError("Please enter at least one recipient."); return; }
    setInlineSending(true);
    setInlineError("");
    try {
      const userHtml = inlineBody.replace(/\n/g, "<br>").replace(/ {2}/g, "&nbsp;&nbsp;");
      const quoteBlock = inlineReply.originalBody
        ? `<br><br><div style="border-left:2px solid #e5e7eb;padding-left:12px;margin-top:8px;color:#6b7280;font-size:13px;">${inlineReply.originalBody}</div>`
        : "";
      const ccEmails = (inlineReply.ccEmail || "").split(/[,;]/).map(e => e.trim()).filter(Boolean);
      const payload = {
        message: {
          subject: inlineReply.subject,
          body: { contentType: "HTML", content: userHtml + quoteBlock },
          toRecipients: toEmails.map(a => ({ emailAddress: { address: a } })),
          ccRecipients: ccEmails.map(a => ({ emailAddress: { address: a } })),
        },
      };
      const res = await window.fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok || res.status === 202) {
        setInlineReply(null);
        setInlineBody("");
        setInlineToInput("");
        if (onToast) onToast("Reply sent!", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        setInlineError(err?.error?.message || "Failed to send.");
      }
    } catch (e) {
      setInlineError(e.message || "Failed to send.");
    } finally {
      setInlineSending(false);
    }
  };

  const buildInlinePayload = () => {
    const userHtml  = inlineBody.replace(/\n/g, "<br>").replace(/ {2}/g, "&nbsp;&nbsp;");
    const quoteBlock = inlineReply?.originalBody
      ? `<br><br><div style="border-left:2px solid #e5e7eb;padding-left:12px;margin-top:8px;color:#6b7280;font-size:13px;">${inlineReply.originalBody}</div>`
      : "";
    return { html: userHtml + quoteBlock, subject: inlineReply?.subject || "" };
  };

  const handleScheduleSend = async () => {
    if (!scheduleDateTime) return;
    const scheduledAt = new Date(scheduleDateTime);
    const delay = scheduledAt.getTime() - Date.now();
    if (delay <= 0) { setInlineError("Please select a future date and time."); return; }
    const toEmails = inlineToInput.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    if (!toEmails.length) { setInlineError("Please enter at least one recipient."); return; }
    setSchedulingInProgress(true);
    try {
      const { html, subject } = buildInlinePayload();
      const ccEmails = (inlineReply?.ccEmail || "").split(/[,;]/).map(e => e.trim()).filter(Boolean);
      const draftRes = await window.fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: toEmails.map(a => ({ emailAddress: { address: a } })),
          ccRecipients: ccEmails.map(a => ({ emailAddress: { address: a } })),
        }),
      });
      if (draftRes.ok) {
        const draft = await draftRes.json();
        setTimeout(async () => {
          await window.fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
            method: "POST", headers: { Authorization: `Bearer ${accessToken}` },
          }).catch(() => {});
        }, delay);
        setScheduleModal(false);
        setInlineReply(null); setInlineBody(""); setInlineToInput("");
        if (onToast) onToast(`Email scheduled for ${scheduledAt.toLocaleString()}`, "success");
      } else {
        const err = await draftRes.json().catch(() => ({}));
        setInlineError(err?.error?.message || "Failed to schedule email.");
      }
    } catch (e) {
      setInlineError(e.message || "Failed to schedule.");
    } finally {
      setSchedulingInProgress(false);
    }
  };

  const handleMailMerge = async () => {
    const toEmails = inlineToInput.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    if (!toEmails.length) { setInlineError("Please enter at least one recipient."); return; }
    setInlineSending(true); setInlineError("");
    const { html, subject } = buildInlinePayload();
    let sent = 0;
    for (const addr of toEmails) {
      try {
        const res = await window.fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: {
            subject, body: { contentType: "HTML", content: html },
            toRecipients: [{ emailAddress: { address: addr } }],
          }}),
        });
        if (res.ok || res.status === 202) sent++;
      } catch {}
    }
    setInlineSending(false);
    setInlineReply(null); setInlineBody(""); setInlineToInput("");
    if (onToast) onToast(`Mail merge sent to ${sent} of ${toEmails.length} recipient${toEmails.length > 1 ? "s" : ""}.`, "success");
  };

  const handleMailSent = mail => {
    const newMail = {
      id: Date.now().toString(), subject: mail.subject, body: mail.body,
      toEmail: mail.to?.join(", ") || "", ccEmail: mail.cc?.join(", ") || "",
      sentDateTime: new Date().toISOString(), sender: accounts[0]?.name || "Me",
      from: accounts[0]?.name || "Me", isRead: true,
    };
    setSentMails(p => [newMail, ...p]);
  };

  const handleAddTemplate = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const r = await apiClient.post("/Template", newTemplate);
      if (r.status >= 200 && r.status < 300) {
        setShowAddTemplate(false);
        setNewTemplate({ name: "", subject: "", body: "" });
        apiClient.get("/Template").then(r => setApiTemplates(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      }
    } catch {}
    setIsSubmitting(false);
  };

  const toggleSelectMail = id => setSelectedMailIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const selectAll = () => {
    const all = getFilteredMails().map(m => m.id);
    const allSel = all.every(id => selectedMailIds.includes(id));
    setSelectedMailIds(allSel ? [] : all);
  };

  const copilotSend = () => {
    if (!copilotInput.trim()) return;
    const userMsg = { role: "user", text: copilotInput };
    let reply = "";
    const q = copilotInput.toLowerCase();
    if (q.includes("summarize") || q.includes("summary")) {
      reply = openedMail
        ? `Summary of "${openedMail.subject}":\n\nThis email is from ${openedMail.sender} and discusses: ${stripHtml(openedMail.body).slice(0, 200)}...`
        : "Please select an email first so I can summarize it.";
    } else if (q.includes("reply") || q.includes("draft")) {
      reply = openedMail
        ? `Suggested reply to "${openedMail.subject}":\n\nThank you for your email. I have reviewed the information you provided and will respond in detail shortly.\n\nBest regards`
        : "Please select an email first so I can draft a reply.";
    } else if (q.includes("task") || q.includes("action")) {
      reply = openedMail
        ? `Extracted action items from "${openedMail.subject}":\n\n• Review and respond to this email\n• Follow up by end of week\n• Schedule meeting if needed`
        : "Please select an email first to extract tasks.";
    } else {
      reply = "I can help you summarize emails, draft replies, extract action items, and more. Try asking me to 'summarize this email' or 'draft a reply'.";
    }
    setCopilotHistory(p => [...p, userMsg, { role: "assistant", text: reply }]);
    setCopilotInput("");
  };

  // ─── Notification handlers ────────────────────────────────────────────────
  const markAllNotifsRead = () => setNotifications(p => p.map(n => ({ ...n, read: true })));

  const markNotifRead = id => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));

  // ─── Calendar API handlers ────────────────────────────────────────────────
  const handleSaveEvent = async () => {
    if (!newEventTitle.trim()) return;
    const date = eventFormDate || selectedCalDay;
    const pad = n => String(n).padStart(2, "0");
    const [sh, sm] = newEventStart.split(":").map(Number);
    const [eh, em] = newEventEnd.split(":").map(Number);
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const tempId = `local-${Date.now()}`;
    const newEv = {
      id: tempId, graphId: null,
      title: newEventTitle.trim(),
      date: calDateKey(date),
      start: newEventStart, end: newEventEnd,
      color: newEventColor,
    };
    setCalEvents(p => [...p, newEv]);
    // Reset all form fields
    setNewEventTitle(""); setNewEventColor("blue");
    setNewEventAttendees(""); setNewEventLocation(""); setNewEventDescription("");
    setNewEventAllDay(false); setNewEventOnline(false); setNewEventAgenda("");
    setEvBusyStatus("Busy"); setEvReminder("15 minutes before");
    setEvCategory(null); setEvPrivacy("Not private");
    setEvSelectedAttendees([]); setEvAttendeeSearch(""); setShowEvAttendeePicker(false);
    setShowEventForm(false);
    // Create via Graph API — reuse existing accessToken (Calendars.ReadWrite already in scope)
    if (accessToken) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const showAsMap = {"Free":"free","Working elsewhere":"workingElsewhere","Tentative":"tentative","Busy":"busy","Out of office":"oof"};
        const reminderMap = {"Don't remind me":-1,"At time of event":0,"5 minutes before":5,"15 minutes before":15,"30 minutes before":30,"1 hour before":60,"2 hours before":120,"12 hours before":720,"1 day before":1440,"1 week before":10080};
        const reminderMins = reminderMap[evReminder] ?? 15;
        const body = {
          subject: newEv.title,
          start: { dateTime: newEventAllDay ? `${dateStr}T00:00:00` : `${dateStr}T${pad(sh)}:${pad(sm)}:00`, timeZone: tz },
          end:   { dateTime: newEventAllDay ? `${dateStr}T23:59:00` : `${dateStr}T${pad(eh)}:${pad(em)}:00`, timeZone: tz },
          isOnlineMeeting: newEventOnline,
          showAs: showAsMap[evBusyStatus] || "busy",
          sensitivity: evPrivacy === "Private" ? "private" : "normal",
          isReminderOn: reminderMins >= 0,
          ...(reminderMins >= 0 ? { reminderMinutesBeforeStart: reminderMins } : {}),
          ...(evCategory ? { categories: [evCategory] } : {}),
          ...(newEventOnline ? { onlineMeetingProvider: "teamsForBusiness" } : {}),
          location: { displayName: newEventLocation || (newEventOnline ? "Microsoft Teams" : "") },
          ...(newEventDescription ? { body: { contentType: "text", content: newEventDescription } } : {}),
          ...(evSelectedAttendees.length ? { attendees: evSelectedAttendees.map(a => ({ emailAddress: { address: a.email, name: a.name }, type: "required" })) } : {}),
        };
        const r = await fetch("https://graph.microsoft.com/v1.0/me/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const created = await r.json();
          setCalEvents(p => p.map(e => e.id === tempId ? { ...e, id: created.id, graphId: created.id } : e));
        }
      } catch (e) { console.error("Create event error:", e); }
    }
  };

  const handleDeleteEvent = async ev => {
    setCalEvents(p => p.filter(e => e.id !== ev.id));
    setSelectedEvent(null);
    const gId = ev.graphId || ev.id;
    if (accessToken && gId && !String(gId).startsWith("local-")) {
      fetch(`https://graph.microsoft.com/v1.0/me/events/${gId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(e => console.error("Delete event error:", e));
    }
  };

  // ─── Theme helpers ────────────────────────────────────────────────────────
  const th = {
    bg: isDark ? "bg-gray-900" : "bg-white",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-white" : "text-gray-500",
    border: isDark ? "border-gray-600" : "border-gray-200",
    surface: isDark ? "bg-gray-800" : "bg-gray-50",
    hover: isDark ? "hover:bg-gray-700" : "hover:bg-gray-100",
    input: isDark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400",
    card: isDark ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200",
  };

  // ─── Highlight helper ─────────────────────────────────────────────────────
  const hl = text => {
    const q = emailSearch.trim().toLowerCase();
    if (!q || !text) return text;
    const str = String(text);
    const idx = str.toLowerCase().indexOf(q);
    if (idx === -1) return str;
    return <span>{str.slice(0, idx)}<mark className="bg-yellow-200 text-yellow-900 font-semibold rounded px-0.5">{str.slice(idx, idx + q.length)}</mark>{str.slice(idx + q.length)}</span>;
  };

  // ─── All folder definitions ───────────────────────────────────────────────
  const FOLDERS = [
    { key: "Inbox", label: "Inbox", icon: Inbox },
    { key: "Sent", label: "Sent Items", icon: Send },
    { key: "Drafts", label: "Drafts", icon: Edit2 },
    { key: "Deleted", label: "Deleted Items", icon: Trash2 },
    { key: "Junk", label: "Junk Email", icon: AlertTriangle },
    { key: "Archive", label: "Archive", icon: Archive },
    { key: "Outbox", label: "Outbox", icon: MailOpen },
    { key: "History", label: "Conversation History", icon: MessageSquare },
  ];

  const EMAIL_FOLDERS = ["Inbox", "Sent", "Drafts", "Deleted", "Junk", "Archive", "Outbox", "History"];
  const isEmailFolder = EMAIL_FOLDERS.includes(activeFolder);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full ${th.bg} ${th.text} overflow-hidden relative${isDark ? " outlook-dark" : ""}`}>
      {isDark && (
        <style>{`
          .outlook-dark * { color: #ffffff !important; }
          .outlook-dark input, .outlook-dark textarea, .outlook-dark select { color: #ffffff !important; }
          .outlook-dark input::placeholder, .outlook-dark textarea::placeholder { color: rgba(255,255,255,0.5) !important; }
          .outlook-dark .text-blue-600, .outlook-dark .text-blue-500, .outlook-dark .text-blue-400 { color: #93c5fd !important; }
          .outlook-dark .text-red-500, .outlook-dark .text-red-600 { color: #fca5a5 !important; }
          .outlook-dark .text-green-600, .outlook-dark .text-emerald-600 { color: #6ee7b7 !important; }
          .outlook-dark .text-orange-500, .outlook-dark .text-orange-400 { color: #fdba74 !important; }
          .outlook-dark .text-purple-500, .outlook-dark .text-purple-600 { color: #c4b5fd !important; }
          .outlook-dark .text-yellow-400, .outlook-dark .text-yellow-500 { color: #fde047 !important; }
          .outlook-dark .text-white { color: #ffffff !important; }
          .outlook-dark .outlook-email-body, .outlook-dark .outlook-email-body * { color: #ffffff !important; background-color: transparent !important; background: transparent !important; }
        `}</style>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${th.card} border w-[90vw] md:w-96 rounded-2xl shadow-2xl p-6`}>
            <h4 className="text-base font-semibold mb-2">Delete messages</h4>
            <p className={`text-sm ${th.textMuted} mb-5`}>
              Are you sure you want to permanently delete {deleteCandidateIds.length} message(s)?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteCandidateIds([]); }}
                className={`px-4 py-2 text-sm rounded-lg ${isDark ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                Cancel
              </button>
              <button onClick={performDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ───────────────────────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${th.card} border w-[95vw] md:w-[680px] max-h-[106vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${th.border}`}>
              <h2 className="text-lg font-semibold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`p-1.5 rounded-lg ${th.hover}`}><X size={18} /></button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Settings nav */}
              <nav className={`w-44 border-r ${th.border} p-3 space-y-1 shrink-0`}>
                {[
                  { key: "account", label: "Account", icon: User },
                  { key: "signature", label: "Signature", icon: Pencil },
                  { key: "theme", label: "Theme", icon: Sun },
                  { key: "notifications", label: "Notifications", icon: Bell },
                  { key: "rules", label: "Mail Rules", icon: Filter },
                  { key: "autoreply", label: "Auto Reply", icon: RefreshCw },
                ].map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setSettingsTab(key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${settingsTab === key ? "bg-blue-600 text-white" : `${th.hover} ${th.text}`}`}>
                    <Icon size={15} />{label}
                  </button>
                ))}
              </nav>
              {/* Settings content */}
              <div className="flex-1 overflow-y-auto p-6">
                {settingsTab === "account" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Account Settings</h3>
                    <div className={`flex items-center gap-4 p-4 rounded-xl border ${th.border}`}>
                      <div className={`w-14 h-14 rounded-full ${getAvatarColor(accounts[0]?.name || "")} flex items-center justify-center text-white text-xl font-bold`}>
                        {getInitials(accounts[0]?.name || accounts[0]?.username || "U")}
                      </div>
                      <div>
                        <p className="font-medium">{accounts[0]?.name || "User"}</p>
                        <p className={`text-sm ${th.textMuted}`}>{accounts[0]?.username || ""}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Connected</span>
                      </div>
                    </div>
                  </div>
                )}
                {settingsTab === "signature" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Email Signature</h3>
                    <textarea
                      value={signature}
                      onChange={e => setSignature(e.target.value)}
                      rows={8}
                      className={`w-full px-4 py-3 border rounded-xl text-sm ${th.input} resize-y focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      placeholder="Enter your email signature..."
                    />
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Signature</button>
                  </div>
                )}
                {settingsTab === "theme" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Theme</h3>
                    <div className="flex gap-4">
                      {[{ v: false, label: "Light", icon: Sun }, { v: true, label: "Dark", icon: Moon }].map(({ v, label, icon: Icon }) => (
                        <button key={label} onClick={() => setIsDark(v)}
                          className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${isDark === v ? "border-blue-500 bg-blue-50 text-blue-700" : `border-transparent ${th.border} ${th.hover}`}`}>
                          <Icon size={24} /><span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {settingsTab === "notifications" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Notifications</h3>
                    {[
                      { label: "New email alerts", desc: "Get notified for new emails" },
                      { label: "Meeting reminders", desc: "Reminders 15 min before meetings" },
                      { label: "Mentions", desc: "When you're @mentioned" },
                      { label: "Task alerts", desc: "Due date reminders" },
                    ].map(({ label, desc }) => (
                      <div key={label} className={`flex items-center justify-between p-3 rounded-lg border ${th.border}`}>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className={`text-xs ${th.textMuted}`}>{desc}</p>
                        </div>
                        <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end px-0.5 cursor-pointer">
                          <div className="w-5 h-5 bg-white rounded-full shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {settingsTab === "autoreply" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Automatic Replies</h3>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={autoReply.enabled} onChange={e => setAutoReply(p => ({ ...p, enabled: e.target.checked }))} className="w-4 h-4" />
                      <span className="text-sm">Send automatic replies</span>
                    </label>
                    {autoReply.enabled && (
                      <textarea
                        value={autoReply.message}
                        onChange={e => setAutoReply(p => ({ ...p, message: e.target.value }))}
                        rows={6}
                        className={`w-full px-4 py-3 border rounded-xl text-sm ${th.input} resize-y focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        placeholder="I'm currently out of office..."
                      />
                    )}
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
                  </div>
                )}
                {settingsTab === "rules" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Mail Rules</h3>
                    <p className={`text-sm ${th.textMuted}`}>Create rules to automatically organize your incoming mail.</p>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      <Plus size={14} /> New Rule
                    </button>
                    <div className={`p-8 rounded-xl border ${th.border} text-center`}>
                      <Filter size={32} className={`mx-auto mb-2 ${th.textMuted}`} />
                      <p className={`text-sm ${th.textMuted}`}>No rules yet. Create one to get started.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Panel ───────────────────────────────────────────── */}
      {showNotifications && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}>
          <div className={`absolute top-12 right-0 md:right-16 w-80 ${th.card} border-l border-b ${th.border} shadow-2xl rounded-bl-2xl overflow-hidden max-h-[75vh] flex flex-col`}
            onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${th.border}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Notifications</span>
                {notifLoading && <RefreshCw size={12} className="animate-spin text-blue-400" />}
              </div>
              <button onClick={() => setShowNotifications(false)} className={`p-1 rounded ${th.hover}`}><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifLoading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <RefreshCw size={20} className={`animate-spin ${th.textMuted}`} />
                  <p className={`text-xs ${th.textMuted}`}>Loading notifications…</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell size={28} className={`${th.textMuted} opacity-30`} />
                  <p className={`text-xs ${th.textMuted}`}>No notifications</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id}
                    onClick={() => markNotifRead(n.id)}
                    className={`px-4 py-3 border-b ${th.border} ${th.hover} cursor-pointer flex gap-3 ${!n.read ? isDark ? "bg-blue-900/20" : "bg-blue-50" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${n.type === "email" ? "bg-blue-100 text-blue-600" :
                        n.type === "meeting" ? "bg-green-100 text-green-600" :
                        n.type === "task" ? "bg-orange-100 text-orange-600" :
                        "bg-purple-100 text-purple-600"}`}>
                      {n.type === "email" ? <Mail size={14} /> :
                       n.type === "meeting" ? <Calendar size={14} /> :
                       n.type === "task" ? <CheckSquare size={14} /> :
                       <AtSign size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!n.read ? "text-blue-600" : th.text}`}>{n.title}</p>
                      <p className={`text-xs ${th.textMuted} truncate`}>{n.body}</p>
                      <p className={`text-xs ${th.textMuted} mt-0.5`}>{n.time}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                  </div>
                ))
              )}
            </div>
            <div className={`px-4 py-2 border-t ${th.border} flex items-center justify-between`}>
              <button onClick={markAllNotifsRead} className="text-xs text-blue-500 hover:underline">
                Mark all as read
              </button>
              <button
                onClick={() => setNotifRefreshKey(p => p + 1)}
                className={`text-xs ${th.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                <RefreshCw size={11} />Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Copilot Panel ────────────────────────────────────────────────── */}
      {showCopilot && (
        <div className="fixed inset-0 z-40" onClick={() => setShowCopilot(false)}>
          <div className={`absolute top-12 right-0 md:right-16 w-80 md:w-96 ${th.card} border-l border-b ${th.border} shadow-2xl rounded-bl-2xl overflow-hidden h-[94vh] flex flex-col`}
            onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${th.border} bg-gradient-to-r from-blue-600 to-purple-600`}>
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={16} /><span className="font-semibold text-sm">Copilot</span>
              </div>
              <button onClick={() => setShowCopilot(false)} className="text-white/80 hover:text-white p-1 rounded"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {copilotHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <Sparkles size={12} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : isDark ? "bg-gray-700 text-gray-100 rounded-bl-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            {/* Quick actions */}
            {openedMail && (
              <div className={`px-4 py-2 border-t ${th.border} flex gap-2 overflow-x-auto`}>
                {["Summarize", "Draft reply", "Extract tasks", "Meeting summary"].map(a => (
                  <button key={a} onClick={() => { setCopilotInput(a); }}
                    className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-full border ${th.border} ${th.hover} flex-shrink-0`}>
                    {a}
                  </button>
                ))}
              </div>
            )}
            <div className={`p-3 border-t ${th.border} flex gap-2`}>
              <input
                value={copilotInput}
                onChange={e => setCopilotInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && copilotSend()}
                placeholder="Ask Copilot..."
                className={`flex-1 px-3 py-2 rounded-xl text-sm border ${th.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button onClick={copilotSend} className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Header ───────────────────────────────────────────────────── */}
      <header className="h-12 bg-blue-700 flex items-center justify-between px-3 gap-3 shrink-0 z-20">
        {/* Left: Hamburger (mobile) + Logo */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Hamburger — mobile only */}
          <button onClick={() => setShowMobileSidebar(p => !p)}
            className="md:hidden p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition">
            <Menu size={18} />
          </button>
          <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center">
            <Mail size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">Outlook</span>
        </div>

        {/* Center: Global search */}
        <div className="flex-1 max-w-lg mx-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
            <input
              type="text"
              placeholder="Search emails, contacts, files..."
              value={emailSearch}
              onChange={e => { setEmailSearch(e.target.value); setOpenedMailId(null); }}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg focus:outline-none focus:bg-white/30 focus:border-white/60 transition"
            />
            {emailSearch && (
              <button onClick={() => setEmailSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Theme toggle */}
          <button onClick={() => setIsDark(p => !p)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition hidden md:flex">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {/* Help */}
          <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition hidden md:flex">
            <HelpCircle size={16} />
          </button>
          {/* Notifications */}
          <button onClick={e => { e.stopPropagation(); setShowNotifications(p => !p); }}
            className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition">
            <Bell size={16} />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {unreadNotifCount}
              </span>
            )}
          </button>
          {/* Settings */}
          <button onClick={e => { e.stopPropagation(); setShowSettings(true); }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition hidden md:flex">
            <Settings size={16} />
          </button>
          {/* User avatar */}
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowUserMenu(p => !p); }}
              className={`w-8 h-8 rounded-full ${getAvatarColor(accounts[0]?.name || "")} flex items-center justify-center text-white text-xs font-bold border-2 border-white/30`}>
              {getInitials(accounts[0]?.name || accounts[0]?.username || "U")}
            </button>
            {showUserMenu && (
              <div className={`absolute right-0 top-10 w-56 ${th.card} border ${th.border} rounded-xl shadow-xl z-50 overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${th.border}`}>
                  <p className="text-sm font-semibold">{accounts[0]?.name || "User"}</p>
                  <p className={`text-xs ${th.textMuted} truncate`}>{accounts[0]?.username || ""}</p>
                </div>
                {[
                  { label: "My profile", icon: User },
                  { label: "Settings", icon: Settings, action: () => setShowSettings(true) },
                  { label: "Sign out", icon: LogOut, danger: true },
                ].map(({ label, icon: Icon, action, danger }) => (
                  <button key={label} onClick={action}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${th.hover} transition ${danger ? "text-red-500" : th.text}`}>
                    <Icon size={15} />{label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile Sidebar Overlay ───────────────────────────────────────── */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setShowMobileSidebar(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className={`absolute left-0 top-0 bottom-0 w-72 ${th.surface} border-r ${th.border} flex flex-col overflow-hidden`}
            onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${th.border}`}>
              <span className="font-semibold text-sm">Folders</span>
              <button onClick={() => setShowMobileSidebar(false)} className={`p-1.5 rounded-lg ${th.hover}`}><X size={16} /></button>
            </div>
            <div className="p-3">
              <button onClick={() => { setShowCompose(true); setShowMobileSidebar(false); }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2.5 rounded-xl transition font-medium">
                <Plus size={16} />New email
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {[
                { key: "Inbox", label: "Inbox", icon: Mail, count: folderCounts.Inbox },
                { key: "Sent", label: "Sent", icon: Send },
                { key: "Drafts", label: "Drafts", icon: Pencil },
                { key: "Archive", label: "Archive", icon: Archive },
                { key: "Junk", label: "Junk", icon: AlertCircle },
                { key: "Trash", label: "Trash", icon: Trash2 },
              ].map(({ key, label, icon: Icon, count }) => (
                <button key={key} onClick={() => { setActiveFolder(key); setOpenedMailId(null); setMobileView("list"); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${activeFolder === key ? "bg-indigo-600 text-white" : `${th.hover} ${th.text}`}`}>
                  <Icon size={15} />{label}
                  {count > 0 && <span className="ml-auto text-xs font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{count}</span>}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ── Main Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left App Rail (desktop only) ────────────────────────────────── */}
        <nav className="hidden md:flex flex-col items-center py-3 gap-1 w-14 bg-blue-800 shrink-0">
          {[
            { key: "Mail", icon: Mail, badge: folderCounts.Inbox },
            { key: "Calendar", icon: Calendar },
            { key: "People", icon: Users },
            { key: "Tasks", icon: CheckSquare },
            { key: "Files", icon: FolderOpen },
          ].map(({ key, icon: Icon, badge }) => (
            <RailItem key={key} icon={Icon} label={key} active={activeApp === key}
              onClick={() => setActiveApp(key)} badge={badge || 0} />
          ))}
          <div className="flex-1" />
          <RailItem icon={Sparkles} label="Copilot" active={showCopilot}
            onClick={e => { e.stopPropagation(); setShowCopilot(p => !p); }} badge={0} />
        </nav>

        {/* ── Mail App ─────────────────────────────────────────────────── */}
        {activeApp === "Mail" && (
          <>
            {/* ── Mail Sidebar (desktop only) ──────────────────────────── */}
            <aside className={`hidden md:flex md:w-56 ${th.surface} border-r ${th.border} flex-col shrink-0`}>
              {/* New Email button */}
              <div className="p-3">
                <button onClick={() => setShowCompose(true)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2.5 rounded-xl transition shadow-sm font-medium">
                  <Plus size={16} />New email
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {/* Favorites section */}
                <div>
                  <button
                    onClick={() => setExpandedSections(p => ({ ...p, favorites: !p.favorites }))}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${th.textMuted} ${th.hover} rounded-lg`}>
                    {expandedSections.favorites ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Favorites
                  </button>
                  {expandedSections.favorites && pinnedFolders.map(f => {
                    const folder = FOLDERS.find(fd => fd.key === f || fd.label === f);
                    if (!folder) return null;
                    return (
                      <FolderRow key={f} icon={Star} label={folder.label} active={activeFolder === folder.key}
                        count={folderCounts[folder.key] || 0} pinned
                        onClick={() => { setActiveFolder(folder.key); setOpenedMailId(null); }}
                        isDark={isDark} />
                    );
                  })}
                </div>

                <div className={`my-2 border-t ${th.border}`} />

                {/* All folders */}
                <div>
                  <button
                    onClick={() => setExpandedSections(p => ({ ...p, folders: !p.folders }))}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${th.textMuted} ${th.hover} rounded-lg`}>
                    {expandedSections.folders ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Folders
                  </button>
                  {expandedSections.folders && FOLDERS.map(({ key, label, icon }) => (
                    <FolderRow key={key} icon={icon} label={label} active={activeFolder === key}
                      count={folderCounts[key] || 0}
                      onPin={() => setPinnedFolders(p => p.includes(label) ? p.filter(x => x !== label) : [...p, label])}
                      pinned={pinnedFolders.includes(label)}
                      onClick={() => { setActiveFolder(key); setOpenedMailId(null); }}
                      isDark={isDark} />
                  ))}
                  {/* Add folder */}
                  <button className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${th.textMuted} ${th.hover} transition`}>
                    <Plus size={14} /><span>Add folder</span>
                  </button>
                </div>

                <div className={`my-2 border-t ${th.border}`} />

                {/* Templates */}
                <FolderRow icon={FileText} label="Templates" active={activeFolder === "Templates"}
                  onClick={() => { setActiveFolder("Templates"); setOpenedMailId(null); }}
                  isDark={isDark} />

                <div className={`my-2 border-t ${th.border}`} />

                {/* Groups section */}
                <div>
                  <button
                    onClick={() => setExpandedSections(p => ({ ...p, groups: !p.groups }))}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${th.textMuted} ${th.hover} rounded-lg`}>
                    {expandedSections.groups ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Groups
                  </button>
                  {expandedSections.groups && (
                    <div className={`px-3 py-3 text-xs ${th.textMuted} text-center`}>No groups yet</div>
                  )}
                </div>
              </nav>
            </aside>

            {/* ── Mobile folder tabs ──────────────────────────────────── */}
            <div className={`md:hidden border-b ${th.border} ${th.surface} px-2 py-2 overflow-x-auto shrink-0`}>
              <div className="flex gap-1.5 min-w-max">
                {[...FOLDERS, { key: "Templates", label: "Templates", icon: FileText }].map(({ key, label }) => (
                  <button key={key} onClick={() => { setActiveFolder(key); setOpenedMailId(null); }}
                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap font-medium transition ${activeFolder === key ? "bg-blue-600 text-white" : isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                    {label}{folderCounts[key] ? ` (${folderCounts[key]})` : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Email Area ───────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

              {/* Email List + Reading Pane */}
              {isEmailFolder && (
                <>
                  {/* ── Email List Panel ─────────────────────────────── */}
                  <div className={`${openedMailId ? "hidden md:flex" : "flex"} w-full md:w-96 border-r ${th.border} flex-col ${th.bg} shrink-0`}>

                    {/* List header */}
                    <div className={`border-b ${th.border} ${th.surface}`}>
                      <div className="h-12 px-3 flex items-center gap-2">
                        <input type="checkbox" aria-label="Select all"
                          checked={(() => { const m = getFilteredMails(); return m.length > 0 && m.every(x => selectedMailIds.includes(x.id)); })()}
                          onChange={selectAll}
                          className="w-4 h-4 rounded border-gray-300 shrink-0" />
                        <h2 className={`flex-1 text-sm font-semibold truncate ${th.text}`}>
                          {activeFolder === "Deleted" ? "Deleted Items" : activeFolder}
                        </h2>
                        {/* Toolbar actions */}
                        <div className="flex items-center gap-0.5">
                          {selectedMailIds.length > 0 && (
                            <>
                              <button onClick={() => confirmDelete(selectedMailIds)} title="Delete"
                                className={`p-1.5 rounded-lg text-red-500 ${th.hover} transition`}><FiTrash2 size={14} /></button>
                              {activeFolder === "Inbox" && (
                                <button onClick={() => { selectedMailIds.forEach(id => archiveMail(id)); }} title="Archive"
                                  className={`p-1.5 rounded-lg ${th.textMuted} ${th.hover} transition`}><Archive size={14} /></button>
                              )}
                              <button onClick={() => selectedMailIds.forEach(id => toggleRead(getCurrentMails().find(m => m.id === id)))} title="Mark read/unread"
                                className={`p-1.5 rounded-lg ${th.textMuted} ${th.hover} transition`}><MailOpen size={14} /></button>
                              <button onClick={() => selectedMailIds.forEach(id => toggleFlag(id))} title="Flag"
                                className={`p-1.5 rounded-lg ${th.textMuted} ${th.hover} transition`}><Flag size={14} /></button>
                            </>
                          )}
                          {/* Sort */}
                          <div className="relative" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowSortMenu(p => !p)} title="Sort"
                              className={`p-1.5 rounded-lg ${th.textMuted} ${th.hover} transition`}><ArrowUpDown size={14} /></button>
                            {showSortMenu && (
                              <div className={`absolute right-0 top-8 w-40 ${th.card} border ${th.border} rounded-xl shadow-xl z-30 overflow-hidden`}>
                                {[["date", "Date"], ["sender", "Sender"], ["subject", "Subject"]].map(([v, l]) => (
                                  <button key={v} onClick={() => { setSortBy(v); setShowSortMenu(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${th.hover} ${sortBy === v ? "text-blue-500" : th.text}`}>
                                    {sortBy === v && <Check size={12} />}{l}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Filter */}
                          <div className="relative" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowFilterMenu(p => !p)} title="Filter"
                              className={`p-1.5 rounded-lg transition ${filterBy !== "all" ? "text-blue-500" : th.textMuted} ${th.hover}`}><Filter size={14} /></button>
                            {showFilterMenu && (
                              <div className={`absolute right-0 top-8 w-40 ${th.card} border ${th.border} rounded-xl shadow-xl z-30 overflow-hidden`}>
                                {[["all", "All"], ["unread", "Unread"], ["flagged", "Flagged"], ["attachments", "Has attachments"]].map(([v, l]) => (
                                  <button key={v} onClick={() => { setFilterBy(v); setShowFilterMenu(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${th.hover} ${filterBy === v ? "text-blue-500" : th.text}`}>
                                    {filterBy === v && <Check size={12} />}{l}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Focused / Other tabs for Inbox */}
                      {activeFolder === "Inbox" && (
                        <div className={`flex border-t ${th.border}`}>
                          {["Focused", "Other"].map(tab => (
                            <button key={tab} onClick={() => setInboxTab(tab)}
                              className={`flex-1 py-2 text-sm font-medium transition border-b-2 ${inboxTab === tab ? "border-blue-600 text-blue-600" : `border-transparent ${th.textMuted} ${th.hover}`}`}>
                              {tab}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Email list items */}
                    <div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#1b1a19]" : "bg-white"}`}>
                      {(() => {
                        const mails = getFilteredMails();
                        if (!mails.length) return (
                          <div className="flex flex-col items-center justify-center h-full py-12">
                            <Inbox size={40} className={`mb-3 ${th.textMuted} opacity-40`} />
                            <p className={`text-sm ${th.textMuted}`}>{emailSearch ? `No results for "${emailSearch}"` : "No messages"}</p>
                          </div>
                        );
                        return mails.map(mail => {
                          const isRead = readOverrides[mail.id] !== undefined ? readOverrides[mail.id] : mail.isRead;
                          const isFlagged = flaggedIds[mail.id];
                          const cat = mailCategories[mail.id];
                          const isSelected = selectedMailIds.includes(mail.id);
                          const isOpen = openedMailId === mail.id;
                          return (
                            <div key={mail.id} onClick={() => { setOpenedMailId(mail.id); markAsRead(mail); setInlineReply(null); setInlineBody(""); setInlineError(""); setMobileView("email"); }}
                              className={`relative px-3 py-2.5 cursor-pointer border-b transition ${isDark ? "border-[#3d3b39]" : "border-[#E1E1E1]"} ${isOpen ? isDark ? "bg-[#252423]" : "bg-[#EBF3FB]" : isDark ? "hover:bg-[#252423]" : "hover:bg-[#F3F2F1]"} ${isSelected ? isDark ? "bg-[#3d3b39]" : "bg-[#EBF3FB]" : ""}`}>
                              {/* Category bar */}
                              {cat && <div className={`absolute left-0 top-0 bottom-0 w-1 ${CATEGORY_COLORS[cat].dot}`} />}
                              <div className="flex items-start gap-2.5">
                                {/* Checkbox */}
                                <input type="checkbox" checked={isSelected}
                                  onChange={e => { e.stopPropagation(); toggleSelectMail(mail.id); }}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 mt-0.5 rounded border-gray-300 shrink-0" />
                                {/* Avatar */}
                                <div className={`w-9 h-9 rounded-full ${getAvatarColor(mail.sender || mail.from || "")} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                  {getInitials(mail.sender || mail.from || "?")}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className={`text-sm truncate ${!isRead ? "font-semibold" : ""} ${th.text}`}>
                                      {hl(mail.sender || mail.from || mail.toEmail || "No sender")}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {mail.importance === "high" && <AlertCircle size={12} className="text-red-500" />}
                                      {isFlagged && <Flag size={12} className="text-orange-400 fill-orange-400" />}
                                      {mail.attachments?.length > 0 && <Paperclip size={12} className={th.textMuted} />}
                                      <span className={`text-xs ${th.textMuted}`}>{fmtDateTime(mail.receivedDateTime || mail.sentDateTime)}</span>
                                    </div>
                                  </div>
                                  <div className={`flex items-center gap-1.5 mb-0.5`}>
                                    {!isRead && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                                    <span className={`text-sm truncate ${!isRead ? "font-semibold" : ""} ${th.text}`}>
                                      {hl(mail.subject || "(No subject)")}
                                    </span>
                                  </div>
                                  <p className={`text-xs ${th.textMuted} truncate`}>
                                    {hl(stripHtml(mail.body || "").slice(0, 100))}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* ── Reading Pane ─────────────────────────────────── */}
                  <div className={`${openedMailId ? "flex" : "hidden md:flex"} flex-1 overflow-hidden`}>
                    <div className={`flex flex-1 flex-col ${isDark ? "bg-[#1b1a19]" : "bg-[#F3F2F1]"} overflow-hidden min-w-0`}>
                      {openedMail ? (
                        <>
                          {/* Mobile back button */}
                          <div className="md:hidden px-4 pt-3">
                            <button onClick={() => { setOpenedMailId(null); setMobileView("list"); }}
                              className="flex items-center gap-1.5 text-sm text-blue-600 font-medium">
                              <ArrowLeft size={15} />Back to Inbox
                            </button>
                          </div>

                          {/* ── Outlook-style Conversation Header ── */}
                          <div className={`${isDark ? "bg-[#252423] border-[#3d3b39]" : "bg-white border-[#E1E1E1]"} border-b px-4 md:px-5 pt-3 pb-0 shrink-0`}>
                            {/* Subject row */}
                            <div className="flex items-start gap-2 mb-2">
                              <h2 className={`flex-1 text-[15px] font-semibold leading-snug ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                                {openedMail.subject || "(No subject)"}
                              </h2>
                              {mailCategories[openedMail.id] && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${CATEGORY_COLORS[mailCategories[openedMail.id]].bg} ${CATEGORY_COLORS[mailCategories[openedMail.id]].text}`}>
                                  {CATEGORY_COLORS[mailCategories[openedMail.id]].label}
                                </span>
                              )}
                              <button onClick={() => confirmDelete([openedMail.id])}
                                className={`p-1.5 rounded ${isDark ? "text-gray-400 hover:text-red-400 hover:bg-[#3d3b39]" : "text-[#616161] hover:text-red-500 hover:bg-[#F3F2F1]"} transition shrink-0`} title="Delete">
                                <Trash2 size={15} />
                              </button>
                            </div>

                            {/* Participants + metadata row */}
                            <div className="flex items-center gap-2 mb-2">
                              {/* Participant avatars (thread view) */}
                              {threadMessages.length > 1 ? (
                                <div className="flex -space-x-1.5 mr-1">
                                  {[...new Set(threadMessages.map(m => m.sender))].slice(0, 4).map((name, i) => (
                                    <div key={i} className={`w-6 h-6 rounded-full ${getAvatarColor(name)} border-2 ${isDark ? "border-[#252423]" : "border-white"} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                                      {getInitials(name || "?")}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className={`w-6 h-6 rounded-full ${getAvatarColor(openedMail.sender || "")} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                                  {getInitials(openedMail.sender || openedMail.from || "?")}
                                </div>
                              )}
                              <span className={`text-xs truncate ${isDark ? "text-gray-300" : "text-[#424242]"}`}>
                                {threadMessages.length > 1
                                  ? [...new Set(threadMessages.map(m => m.sender))].slice(0, 3).join(", ") + (threadMessages.length > 3 ? ` +${threadMessages.length - 3}` : "")
                                  : (openedMail.sender || openedMail.from || "Unknown")}
                              </span>
                              {threadMessages.length > 1 && (
                                <span className={`text-xs shrink-0 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>
                                  · {threadMessages.length} messages
                                </span>
                              )}
                              <span className={`text-xs shrink-0 ml-auto ${isDark ? "text-gray-400" : "text-[#616161]"}`}>
                                {fmtDateTime(openedMail.receivedDateTime || openedMail.sentDateTime)}
                              </span>
                            </div>

                            {/* Action toolbar — Outlook compact style */}
                            <div className="flex items-center -mx-1">
                              {(() => {
                                const btn = (onClick, icon, label, extra = "") => (
                                  <button onClick={onClick}
                                    className={`flex items-center gap-1 px-2 py-1.5 text-[13px] rounded transition ${isDark ? "text-gray-300 hover:bg-[#3d3b39]" : "text-[#424242] hover:bg-[#EDEBE9]"} ${extra}`}>
                                    {icon}{label && <span className="hidden sm:inline">{label}</span>}
                                  </button>
                                );
                                return <>
                                  {btn(handleReply, <Reply size={14} />, "Reply")}
                                  {btn(handleReplyAll, <ReplyAll size={14} />, "Reply all")}
                                  {btn(handleForward, <Forward size={14} />, "Forward")}
                                  <div className={`w-px h-4 mx-1 ${isDark ? "bg-[#3d3b39]" : "bg-[#D1D1D1]"}`} />
                                  {activeFolder === "Inbox" && btn(() => archiveMail(openedMail.id), <Archive size={14} />, "Archive")}
                                  <button onClick={() => toggleFlag(openedMail.id)} title="Flag"
                                    className={`flex items-center gap-1 px-2 py-1.5 text-[13px] rounded transition ${flaggedIds[openedMail.id] ? "text-orange-500" : isDark ? "text-gray-300 hover:bg-[#3d3b39]" : "text-[#424242] hover:bg-[#EDEBE9]"}`}>
                                    <Flag size={14} /><span className="hidden sm:inline">{flaggedIds[openedMail.id] ? "Unflag" : "Flag"}</span>
                                  </button>
                                  {btn(() => toggleRead(openedMail), <MailOpen size={14} />, (readOverrides[openedMail.id] !== undefined ? readOverrides[openedMail.id] : openedMail.isRead) ? "Unread" : "Read")}
                                  <div className="relative" onClick={e => e.stopPropagation()}>
                                    {btn(() => setShowCategoryMenu(p => p === openedMail.id ? null : openedMail.id), <Tag size={14} />, "Categorize")}
                                    {showCategoryMenu === openedMail.id && (
                                      <div className={`absolute left-0 top-full mt-0.5 w-44 ${isDark ? "bg-[#252423] border-[#3d3b39]" : "bg-white border-[#D1D1D1]"} border rounded shadow-lg z-30 py-1`}>
                                        {Object.entries(CATEGORY_COLORS).map(([key, { dot, label }]) => (
                                          <button key={key} onClick={() => setCategory(openedMail.id, key)}
                                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm ${isDark ? "text-gray-200 hover:bg-[#3d3b39]" : "text-[#1f1f1f] hover:bg-[#F3F2F1]"}`}>
                                            <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                                            {label}
                                            {mailCategories[openedMail.id] === key && <Check size={11} className="ml-auto text-blue-500" />}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative" onClick={e => e.stopPropagation()}>
                                    {btn(() => setShowSnoozeMenu(p => p === openedMail.id ? null : openedMail.id), <Clock size={14} />, "Snooze", "hidden md:flex")}
                                    {showSnoozeMenu === openedMail.id && (
                                      <div className={`absolute left-0 top-full mt-0.5 w-44 ${isDark ? "bg-[#252423] border-[#3d3b39]" : "bg-white border-[#D1D1D1]"} border rounded shadow-lg z-30 py-1 overflow-hidden`}>
                                        {["Tomorrow morning", "Tomorrow afternoon", "This weekend", "Next week", "In 2 weeks"].map(t => (
                                          <button key={t} onClick={() => { if (onToast) onToast(`Snoozed: ${t}`, "success"); setShowSnoozeMenu(null); }}
                                            className={`w-full px-3 py-1.5 text-sm text-left ${isDark ? "text-gray-200 hover:bg-[#3d3b39]" : "text-[#1f1f1f] hover:bg-[#F3F2F1]"}`}>{t}</button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {btn(() => window.print(), <Printer size={14} />, null, "hidden md:flex")}
                                  <div className={`w-px h-4 mx-1 ${isDark ? "bg-[#3d3b39]" : "bg-[#D1D1D1]"} ml-auto`} />
                                  <button onClick={() => setShowCrmPanel(p => !p)}
                                    className={`flex items-center gap-1 px-2 py-1.5 text-[13px] rounded transition ${showCrmPanel ? "text-purple-600 bg-purple-50" : isDark ? "text-gray-300 hover:bg-[#3d3b39]" : "text-[#424242] hover:bg-[#EDEBE9]"}`}>
                                    <Activity size={14} /><span className="hidden sm:inline">CRM</span>
                                  </button>
                                </>;
                              })()}
                            </div>
                          </div>
                          {/* Scroll + body area */}
                          <div className="flex-1 overflow-y-auto">
                            {/* ── Inline reply compose ── */}
                            {inlineReply && (
                              <div className={`px-4 py-3 ${isDark ? "bg-[#252423] border-[#3d3b39]" : "bg-white border-[#E1E1E1]"} border-b`}>
                                <div className="flex items-center justify-between mb-3">
                                  <span className={`text-sm font-semibold ${th.text}`}>
                                    {inlineReply.type === "reply" ? "Reply" : inlineReply.type === "replyAll" ? "Reply All" : "Forward"}
                                  </span>
                                  <button onClick={() => { setInlineReply(null); setInlineBody(""); setInlineError(""); }}
                                    className={`p-1.5 rounded-lg ${th.hover} ${th.textMuted} transition`} title="Discard">
                                    <X size={14} />
                                  </button>
                                </div>

                                <div className={`flex items-center gap-2 px-3 py-2 border ${th.border} rounded-lg mb-2 ${isDark ? "bg-gray-800" : "bg-white"}`}>
                                  <span className={`text-xs font-semibold ${th.textMuted} w-6 flex-shrink-0`}>To</span>
                                  <input
                                    value={inlineToInput}
                                    onChange={e => setInlineToInput(e.target.value)}
                                    placeholder="Recipients…"
                                    className={`flex-1 text-sm bg-transparent outline-none ${th.text} placeholder:text-gray-400`}
                                  />
                                </div>

                                {inlineReply.ccEmail && (
                                  <div className={`flex items-center gap-2 px-3 py-2 border ${th.border} rounded-lg mb-2 ${isDark ? "bg-gray-800" : "bg-white"}`}>
                                    <span className={`text-xs font-semibold ${th.textMuted} w-6 flex-shrink-0`}>Cc</span>
                                    <span className={`text-sm ${th.textMuted} truncate`}>{inlineReply.ccEmail}</span>
                                  </div>
                                )}

                                <textarea
                                  value={inlineBody}
                                  onChange={e => { setInlineBody(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                  placeholder="Write your reply…"
                                  style={{ minHeight: '100px', overflow: 'hidden' }}
                                  className={`w-full px-3 py-2.5 text-sm border ${th.border} rounded-lg resize-none outline-none transition ${th.text} ${isDark ? "bg-gray-800" : "bg-white"} placeholder:text-gray-400`}
                                />

                                {inlineError && <p className="mt-1.5 text-xs text-red-500">{inlineError}</p>}

                                <div className="flex items-center gap-2 mt-3">
                                  {/* Send split-button */}
                                  <div className="relative flex-shrink-0">
                                    <div className="flex rounded-lg overflow-hidden shadow-sm">
                                      <button onClick={handleInlineSend} disabled={inlineSending}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
                                        <Send size={14} />{inlineSending ? "Sending…" : "Send"}
                                      </button>
                                      <button onClick={() => setInlineSendDropdown(p => !p)}
                                        className="flex items-center px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white border-l border-blue-500 transition">
                                        <ChevronDown size={14} />
                                      </button>
                                    </div>
                                    {inlineSendDropdown && (
                                      <div className={`absolute left-0 top-full mt-1 w-48 border rounded-xl shadow-xl z-50 overflow-hidden ${isDark ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200"}`}
                                        onMouseLeave={() => setInlineSendDropdown(false)}>
                                        <button onClick={() => { setInlineSendDropdown(false); handleInlineSend(); }}
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${th.hover} ${th.text} transition`}>
                                          <Send size={14} className="text-blue-500 flex-shrink-0" />Send
                                        </button>
                                        <button onClick={() => { setInlineSendDropdown(false); setScheduleDateTime(""); setScheduleModal(true); }}
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${th.hover} ${th.text} transition`}>
                                          <Clock size={14} className="text-blue-500 flex-shrink-0" />Schedule send
                                        </button>
                                        <button onClick={() => { setInlineSendDropdown(false); handleMailMerge(); }}
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${th.hover} ${th.text} transition`}>
                                          <Users size={14} className="text-blue-500 flex-shrink-0" />Start mail merge
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => { setInlineReply(null); setInlineBody(""); setInlineError(""); setInlineSendDropdown(false); }}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${th.textMuted} ${th.hover} rounded-lg transition`}>
                                    <Trash2 size={14} />Discard
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ── Email thread / single email ── */}
                            <div className="px-4 py-3 space-y-2">
                              {!openedMail.bodyLoaded && (
                                <div className="flex items-center gap-2 text-xs text-gray-400 py-2 animate-pulse">
                                  <RefreshCw size={12} className="animate-spin" />Loading…
                                </div>
                              )}

                              {threadMessages.length > 1 ? (
                                /* Thread view — each message as compact Outlook email container */
                                threadMessages.map((tm) => {
                                  const isCurrentMsg = tm.id === openedMail.id;
                                  const isExpanded = threadExpandedIds.has(tm.id);
                                  const bodyHtml = isCurrentMsg
                                    ? (openedMail.body || openedMail.bodyPreview || "")
                                    : (threadBodies[tm.id] || "");
                                  const cleanHtml = bodyHtml.replace(/http:/g, "https:").replace(/border-left\s*:\s*[^;'"<>]*(?:#[0-9a-fA-F]{3,8}|rgb[^;)]+\)|rgba[^;)]+\)|blue|navy|#3b82f6|cornflowerblue)[^;'"<>]*;?/gi, "border-left:2px solid #e5e7eb;");
                                  return (
                                    <div key={tm.id} className={`${isDark ? "bg-[#252423] border-[#3d3b39]" : "bg-white border-[#E1E1E1]"} border rounded overflow-hidden`}>
                                      {/* Collapsed header — always visible */}
                                      <button
                                        onClick={() => isCurrentMsg ? null : toggleThreadMsg(tm.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isCurrentMsg ? "cursor-default" : isDark ? "hover:bg-[#3d3b39]" : "hover:bg-[#F3F2F1]"} transition`}
                                      >
                                        <div className={`w-8 h-8 rounded-full ${getAvatarColor(tm.sender)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                          {getInitials(tm.sender || "?")}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className={`text-[13px] font-semibold truncate ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>{tm.sender}</span>
                                            <span className={`text-xs shrink-0 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>{tm.receivedDateTime ? new Date(tm.receivedDateTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                          </div>
                                          {!isExpanded && <p className={`text-xs truncate mt-0.5 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>{tm.bodyPreview}</p>}
                                          {isExpanded && tm.toEmail && (
                                            <div className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>
                                              <span className="font-medium">To:</span> {tm.toEmail}
                                            </div>
                                          )}
                                        </div>
                                        {!isCurrentMsg && (
                                          <ChevronDown size={13} className={`shrink-0 ${isDark ? "text-gray-400" : "text-[#616161]"} transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                        )}
                                      </button>
                                      {/* Expanded body */}
                                      {isExpanded && (
                                        <div className={`border-t ${isDark ? "border-[#3d3b39]" : "border-[#E1E1E1]"}`}>
                                          {!bodyHtml && !isCurrentMsg ? (
                                            <p className={`text-xs ${isDark ? "text-gray-400" : "text-[#616161]"} py-3 px-4`}>Loading…</p>
                                          ) : (
                                            <EmailBodyFrame html={cleanHtml} isDark={isDark} />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                /* Single email — compact Outlook container with body + attachments */
                                <div className={`${isDark ? "bg-[#252423] border-[#3d3b39]" : "bg-white border-[#E1E1E1]"} border rounded overflow-hidden`}>
                                  {/* Email sub-header: sender email + to/cc */}
                                  <div className={`px-4 pt-3 pb-2 border-b ${isDark ? "border-[#3d3b39]" : "border-[#E1E1E1]"}`}>
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-full ${getAvatarColor(openedMail.sender || "")} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                        {getInitials(openedMail.sender || openedMail.from || "?")}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className={`text-[13px] font-semibold ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>{openedMail.sender || openedMail.from || "Unknown"}</span>
                                          <span className={`text-xs shrink-0 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>{fmtDateTime(openedMail.receivedDateTime || openedMail.sentDateTime)}</span>
                                        </div>
                                        {openedMail.senderEmail && (
                                          <div className={`text-xs ${isDark ? "text-gray-400" : "text-[#616161]"}`}>{openedMail.senderEmail}</div>
                                        )}
                                        <div className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>
                                          {(() => {
                                            const list = (openedMail.toEmail || "").split(/[,;]/).map(e => e.trim()).filter(Boolean);
                                            const vis = toExpanded ? list : list.slice(0, 3);
                                            const extra = list.length - 3;
                                            return <><span className="font-medium">To:</span>{" "}{vis.join(", ")}
                                              {!toExpanded && extra > 0 && <button onClick={() => setToExpanded(true)} className="text-blue-500 ml-1">+{extra} more</button>}
                                            </>;
                                          })()}
                                        </div>
                                        {openedMail.ccEmail && (
                                          <div className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-[#616161]"}`}>
                                            <span className="font-medium">Cc:</span>{" "}
                                            {(() => {
                                              const list = openedMail.ccEmail.split(/[,;]/).map(e => e.trim()).filter(Boolean);
                                              const vis = ccExpanded ? list : list.slice(0, 3);
                                              const extra = list.length - 3;
                                              return <>{vis.join(", ")}{!ccExpanded && extra > 0 && <button onClick={() => setCcExpanded(true)} className="text-blue-500 ml-1">+{extra}</button>}</>;
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Body */}
                                  <EmailBodyFrame
                                    html={(openedMail.body || openedMail.bodyPreview || "").replace(/http:/g, "https:").replace(/border-left\s*:\s*[^;'"<>]*(?:#[0-9a-fA-F]{3,8}|rgb[^;)]+\)|rgba[^;)]+\)|blue|navy|#3b82f6|cornflowerblue)[^;'"<>]*;?/gi, "border-left:2px solid #e5e7eb;")}
                                    isDark={isDark}
                                  />
                                  {/* Attachments */}
                                  {openedMail.attachments?.length > 0 && (
                                    <div className={`px-4 pb-4 pt-2 border-t ${isDark ? "border-[#3d3b39]" : "border-[#E1E1E1]"}`}>
                                      <p className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-[#424242]"}`}>
                                        <Paperclip size={12} />Attachments ({openedMail.attachments.length})
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {openedMail.attachments.map((att, i) => {
                                          const name = att.name || att.fileName || `attachment-${i}`;
                                          const size = att.size ? fmtFileSize(att.size) : "";
                                          return (
                                            <div key={name + i} className={`flex items-center gap-2 px-3 py-2 border ${isDark ? "border-[#3d3b39] bg-[#1b1a19] hover:bg-[#3d3b39]" : "border-[#E1E1E1] bg-white hover:bg-[#F3F2F1]"} rounded text-sm group transition`}>
                                              <FileIcon name={name} size={16} />
                                              <div className="min-w-0">
                                                <p className={`truncate max-w-[140px] text-xs font-medium ${isDark ? "text-gray-200" : "text-[#1f1f1f]"}`}>{name}</p>
                                                {size && <p className={`text-xs ${isDark ? "text-gray-400" : "text-[#616161]"}`}>{size}</p>}
                                              </div>
                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                {att.contentBytes ? (
                                                  <>
                                                    <a href={`data:${att.contentType || "application/octet-stream"};base64,${att.contentBytes}`}
                                                      download={name} title="Download"
                                                      className={`p-1 rounded ${isDark ? "text-gray-400 hover:text-blue-400" : "text-[#616161] hover:text-blue-600"}`}><Download size={13} /></a>
                                                    <button onClick={() => window.open(`data:${att.contentType};base64,${att.contentBytes}`, "_blank")} title="Preview"
                                                      className={`p-1 rounded ${isDark ? "text-gray-400 hover:text-green-400" : "text-[#616161] hover:text-green-600"}`}><Eye size={13} /></button>
                                                  </>
                                                ) : (
                                                  <span className={`p-1 ${isDark ? "text-gray-400" : "text-[#616161]"}`}><Download size={13} /></span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <MailOpen size={56} className={`mb-4 ${th.textMuted} opacity-30`} />
                          <p className={`text-base font-medium ${th.textMuted}`}>Select an email to read</p>
                          <p className={`text-sm ${th.textMuted} mt-1 opacity-60`}>Nothing selected</p>
                        </div>
                      )}
                    </div>

                    {/* ── CRM Extension Panel ───────────────────────── */}
                    {showCrmPanel && openedMail && (
                      <div className={`hidden md:flex w-64 xl:w-72 border-l ${th.border} ${th.surface} flex-col overflow-y-auto shrink-0`}>
                        {/* CRM header */}
                        <div className={`flex items-center justify-between px-4 py-3 border-b ${th.border}`}>
                          <div className="flex items-center gap-2">
                            <Activity size={15} className="text-purple-500" />
                            <span className="text-sm font-semibold">CRM</span>
                          </div>
                          <button onClick={() => setShowCrmPanel(false)} className={`p-1 rounded-lg ${th.hover} ${th.textMuted}`}><X size={15} /></button>
                        </div>
                        {/* CRM tabs */}
                        <div className={`flex border-b ${th.border}`}>
                          {["actions", "timeline"].map(t => (
                            <button key={t} onClick={() => setCrmTab(t)}
                              className={`flex-1 py-2 text-xs font-medium capitalize transition border-b-2 ${crmTab === t ? "border-purple-500 text-purple-600" : `border-transparent ${th.textMuted} ${th.hover}`}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="p-3 flex-1">
                          {crmTab === "actions" && (
                            <div className="space-y-2">
                              <p className={`text-xs font-semibold ${th.textMuted} uppercase tracking-wide mb-3`}>Quick Actions</p>
                              {[
                                { icon: Link, label: "Link to Contact", color: "text-blue-500", hover: isDark ? "hover:bg-blue-900/20" : "hover:bg-blue-50" },
                                { icon: UserPlus, label: "Create Lead", color: "text-green-500", hover: isDark ? "hover:bg-green-900/20" : "hover:bg-green-50" },
                                { icon: Tag, label: "Create Ticket", color: "text-orange-500", hover: isDark ? "hover:bg-orange-900/20" : "hover:bg-orange-50" },
                                { icon: CheckSquare, label: "Add Follow-up Task", color: "text-purple-500", hover: isDark ? "hover:bg-purple-900/20" : "hover:bg-purple-50" },
                                { icon: Calendar, label: "Schedule Meeting", color: "text-indigo-500", hover: isDark ? "hover:bg-indigo-900/20" : "hover:bg-indigo-50" },
                              ].map(({ icon: Icon, label, color, hover }) => (
                                <button key={label}
                                  onClick={() => { if (onToast) onToast(`${label} — coming soon`, "info"); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 border ${th.border} rounded-xl text-sm ${th.text} ${th.bg} ${hover} transition text-left`}>
                                  <Icon size={15} className={color} />{label}
                                </button>
                              ))}
                              <div className={`mt-4 pt-4 border-t ${th.border}`}>
                                <p className={`text-xs font-semibold ${th.textMuted} uppercase tracking-wide mb-2`}>Email Info</p>
                                <div className={`space-y-1.5 text-xs ${th.textMuted}`}>
                                  <div className="flex gap-2"><span className="font-medium w-10 shrink-0">From</span><span className="truncate">{openedMail.senderEmail || openedMail.sender || "—"}</span></div>
                                  <div className="flex gap-2"><span className="font-medium w-10 shrink-0">To</span><span className="truncate">{(openedMail.toEmail || "—").split(",")[0]}</span></div>
                                  <div className="flex gap-2"><span className="font-medium w-10 shrink-0">Date</span><span>{fmtDateTime(openedMail.receivedDateTime || openedMail.sentDateTime)}</span></div>
                                  {openedMail.attachments?.length > 0 && (
                                    <div className="flex gap-2"><span className="font-medium w-10 shrink-0">Files</span><span>{openedMail.attachments.length} attachment(s)</span></div>
                                  )}
                                </div>
                              </div>
                              {flaggedIds[openedMail.id] && (
                                <div className="mt-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
                                  <p className="text-xs text-orange-600 font-medium flex items-center gap-1.5"><Flag size={12} className="fill-orange-500" />Flagged for follow-up</p>
                                </div>
                              )}
                            </div>
                          )}
                          {crmTab === "timeline" && (
                            <div>
                              <p className={`text-xs font-semibold ${th.textMuted} uppercase tracking-wide mb-3`}>Activity History</p>
                              <div className="space-y-3">
                                {[
                                  { icon: Mail, label: "Email received", time: fmtDateTime(openedMail.receivedDateTime || openedMail.sentDateTime), color: "bg-blue-100 text-blue-600" },
                                  { icon: User, label: "Contact viewed", time: "Just now", color: "bg-gray-100 text-gray-600" },
                                ].map((item, i) => (
                                  <div key={i} className="flex gap-2.5">
                                    <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center shrink-0 mt-0.5`}>
                                      <item.icon size={13} />
                                    </div>
                                    <div>
                                      <p className={`text-xs font-medium ${th.text}`}>{item.label}</p>
                                      <p className={`text-xs ${th.textMuted}`}>{item.time}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Templates section ────────────────────────────────── */}
              {activeFolder === "Templates" && (
                <div className="flex flex-1 overflow-hidden">
                  {/* Template list */}
                  <div className={`w-80 border-r ${th.border} flex flex-col ${th.bg}`}>
                    <div className={`h-12 border-b ${th.border} px-4 flex items-center justify-between ${th.surface}`}>
                      <h2 className="text-sm font-semibold">Templates</h2>
                      <button onClick={() => { setShowAddTemplate(true); setOpenedTemplateIdx(null); }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs transition">
                        <Plus size={13} />New
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {!apiTemplates.length ? (
                        <div className="flex flex-col items-center justify-center h-full py-12">
                          <Edit2 size={36} className={`mb-3 ${th.textMuted} opacity-40`} />
                          <p className={`text-sm ${th.textMuted}`}>No templates yet</p>
                        </div>
                      ) : apiTemplates.map((tpl, idx) => (
                        <div key={tpl.name + idx}
                          onClick={() => { setOpenedTemplateIdx(idx); setShowAddTemplate(false); }}
                          className={`border-b ${th.border} px-4 py-3 cursor-pointer transition ${th.hover} ${openedTemplateIdx === idx && !showAddTemplate ? isDark ? "bg-indigo-900/20 border-l-2 border-l-indigo-400" : "bg-indigo-50 border-l-2 border-l-indigo-600" : ""}`}>
                          <p className={`text-sm font-medium truncate ${th.text}`}>{tpl.name || tpl.subject}</p>
                          <p className={`text-xs ${th.textMuted} truncate mt-0.5`}>{tpl.subject}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Template detail */}
                  <div className={`flex-1 flex flex-col ${th.bg} overflow-hidden`}>
                    {showAddTemplate ? (
                      <>
                        <div className={`h-12 border-b ${th.border} px-6 flex items-center ${th.surface}`}>
                          <h2 className="text-sm font-semibold">New Template</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          <form onSubmit={handleAddTemplate} className="max-w-2xl space-y-5">
                            {[
                              { label: "Template Name", key: "name", ph: "Enter template name" },
                              { label: "Subject", key: "subject", ph: "Enter subject line" },
                            ].map(({ label, key, ph }) => (
                              <div key={key}>
                                <label className={`block text-sm font-medium ${th.textMuted} mb-1.5`}>{label}</label>
                                <input type="text" value={newTemplate[key]}
                                  onChange={e => setNewTemplate(p => ({ ...p, [key]: e.target.value }))}
                                  required placeholder={ph}
                                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${th.input} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                              </div>
                            ))}
                            <div>
                              <label className={`block text-sm font-medium ${th.textMuted} mb-1.5`}>Message</label>
                              <textarea value={newTemplate.body}
                                onChange={e => setNewTemplate(p => ({ ...p, body: e.target.value }))}
                                required rows={8} placeholder="Enter your message..."
                                className={`w-full px-4 py-2.5 border rounded-xl text-sm ${th.input} resize-y focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                            </div>
                            <div className="flex gap-3">
                              <button type="submit" disabled={isSubmitting}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition disabled:opacity-50">
                                {isSubmitting ? "Creating..." : "Create Template"}
                              </button>
                              <button type="button" onClick={() => setShowAddTemplate(false)}
                                className={`px-5 py-2.5 border ${th.border} text-sm rounded-xl ${th.hover} ${th.text}`}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      </>
                    ) : (() => {
                      const tpl = apiTemplates[openedTemplateIdx];
                      if (editTemplateIdx === openedTemplateIdx && tpl) return (
                        <>
                          <div className={`h-12 border-b ${th.border} px-6 flex items-center ${th.surface}`}>
                            <h2 className="text-sm font-semibold">Edit Template</h2>
                          </div>
                          <div className="flex-1 overflow-y-auto p-6">
                            <form onSubmit={async e => {
                              e.preventDefault(); setIsSubmitting(true);
                              try {
                                await apiClient.put(`/Template/${encodeURIComponent(tpl.name)}`, { name: tpl.name, subject: editTemplate.subject, body: editTemplate.body });
                                apiClient.get("/Template").then(r => setApiTemplates(Array.isArray(r.data) ? r.data : [])).catch(() => {});
                                setEditTemplateIdx(null);
                              } catch {}
                              setIsSubmitting(false);
                            }} className="max-w-2xl space-y-5">
                              <div>
                                <label className={`block text-sm font-medium ${th.textMuted} mb-1.5`}>Subject</label>
                                <input type="text" value={editTemplate.subject}
                                  onChange={e => setEditTemplate(p => ({ ...p, subject: e.target.value }))} required
                                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${th.input} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                              </div>
                              <div>
                                <label className={`block text-sm font-medium ${th.textMuted} mb-1.5`}>Message</label>
                                <textarea value={editTemplate.body}
                                  onChange={e => setEditTemplate(p => ({ ...p, body: e.target.value }))} required rows={8}
                                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${th.input} resize-y focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                              </div>
                              <div className="flex gap-3">
                                <button type="submit" disabled={isSubmitting}
                                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition disabled:opacity-50">
                                  {isSubmitting ? "Saving..." : "Save Changes"}
                                </button>
                                <button type="button" onClick={() => setEditTemplateIdx(null)}
                                  className={`px-5 py-2.5 border ${th.border} text-sm rounded-xl ${th.hover} ${th.text}`}>Cancel</button>
                              </div>
                            </form>
                          </div>
                        </>
                      );
                      return tpl ? (
                        <>
                          <div className={`h-12 border-b ${th.border} px-6 flex items-center justify-between ${th.surface}`}>
                            <h2 className="text-sm font-semibold truncate">{tpl.name}</h2>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => { setEditTemplateIdx(openedTemplateIdx); setEditTemplate({ subject: tpl.subject, body: tpl.body }); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${th.hover} ${th.text}`}><Pencil size={13} />Edit</button>
                              <button onClick={async () => {
                                if (!window.confirm("Delete this template?")) return;
                                try {
                                  await apiClient.delete(`/Template/${tpl.TemplateId}`);
                                  apiClient.get("/Template").then(r => setApiTemplates(Array.isArray(r.data) ? r.data : [])).catch(() => {});
                                  setOpenedTemplateIdx(null);
                                } catch {}
                              }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg hover:bg-red-50 text-red-500">
                                <Trash2 size={13} />Delete
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-2xl space-y-5">
                              <div>
                                <label className={`block text-xs font-semibold ${th.textMuted} uppercase tracking-wide mb-2`}>Subject</label>
                                <div className={`px-4 py-3 border ${th.border} rounded-xl text-sm ${th.text} ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>{tpl.subject}</div>
                              </div>
                              <div>
                                <label className={`block text-xs font-semibold ${th.textMuted} uppercase tracking-wide mb-2`}>Message</label>
                                <div className={`px-4 py-4 border ${th.border} rounded-xl text-sm ${th.text} whitespace-pre-wrap min-h-48 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>{tpl.body}</div>
                              </div>
                              <button onClick={() => { setReplyData({ type: "new", toEmail: "", subject: tpl.subject, body: tpl.body }); setShowCompose(true); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl transition">
                                <Mail size={14} />Use Template
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <Edit2 size={48} className={`mb-4 ${th.textMuted} opacity-30`} />
                          <p className={`text-base ${th.textMuted}`}>Select a template</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Calendar ─────────────────────────────────────────────────── */}
        {activeApp === "Calendar" && (() => {
          const today = new Date(_today);
          const eventsForDay = (d) => calEvents.filter(e => e.date === calDateKey(d));
          const monthGrid = getMonthGrid(calDate.getFullYear(), calDate.getMonth());
          const miniGrid = getMonthGrid(miniCalDate.getFullYear(), miniCalDate.getMonth());
          const evColor = (c) => ({ blue:"bg-blue-500", green:"bg-green-600", red:"bg-red-500", orange:"bg-orange-500", purple:"bg-purple-500", teal:"bg-teal-500" }[c] || "bg-blue-500");

          return (
            <div className="flex flex-1 overflow-hidden">

              {/* ── Left: Mini calendar + calendar list ───────────────── */}
              <aside className={`hidden md:flex flex-col w-60 border-r ${th.border} ${th.surface} shrink-0`}>
                {/* Mini calendar */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <button onClick={() => setMiniCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className={`p-1 rounded ${th.hover} ${th.textMuted}`}><ChevronLeft size={14} /></button>
                    <span className={`text-xs font-semibold ${th.text}`}>
                      {miniCalDate.toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                    </span>
                    <button onClick={() => setMiniCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className={`p-1 rounded ${th.hover} ${th.textMuted}`}><ChevronRight size={14} /></button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((d, i) => (
                      <div key={i} className={`text-center text-[10px] font-semibold ${th.textMuted} py-0.5`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {miniGrid.map((cell, i) => {
                      const isToday = cell.date.toDateString() === today.toDateString();
                      const isSel = cell.date.toDateString() === selectedCalDay.toDateString();
                      return (
                        <button key={i}
                          onClick={() => { setSelectedCalDay(cell.date); setCalDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)); setMiniCalDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)); }}
                          className={`flex items-center justify-center w-7 h-7 mx-auto rounded-full text-[11px] transition font-medium
                            ${isToday ? "bg-blue-600 text-white" :
                              isSel ? isDark ? "bg-gray-600 text-white" : "bg-gray-200 text-gray-800" :
                              !cell.curr ? th.textMuted + " opacity-40" :
                              `${th.hover} ${th.text}`}`}>
                          {cell.date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`mx-3 border-t ${th.border}`} />

                {/* Add calendar */}
                <button className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-500 hover:text-blue-600 transition">
                  <Plus size={14} />Add calendar
                </button>

                <div className={`mx-3 border-t ${th.border}`} />

                {/* Calendar accounts */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {(accounts.length ? accounts.slice(0, 2) : [{ username: "My Calendar", name: "Me" }]).map((acc, i) => (
                    <div key={i} className="mb-1">
                      <button className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded ${th.hover} text-xs font-semibold ${th.textMuted}`}>
                        <ChevronRight size={11} />
                        <span className="truncate max-w-[150px]">{acc.username || acc.name}</span>
                      </button>
                      <div className="ml-4 space-y-0.5">
                        {[{ label: "Calendar", color: "bg-blue-500" }, { label: "Birthdays", color: "bg-green-500" }, { label: "Holidays", color: "bg-teal-500" }].map(({ label, color }) => (
                          <div key={label} className={`flex items-center gap-2 px-2 py-1 rounded ${th.hover} cursor-pointer`}>
                            <div className={`w-3 h-3 rounded-sm ${color} flex items-center justify-center shrink-0`}>
                              <Check size={8} className="text-white" />
                            </div>
                            <span className={`text-xs ${th.text}`}>{label}</span>
                          </div>
                        ))}
                        <button className="px-2 py-0.5 text-xs text-blue-500 hover:underline block">Show all</button>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              {/* ── Main calendar area ────────────────────────────────── */}
              <div className={`flex flex-1 flex-col overflow-hidden ${th.bg}`}>

                {/* Top toolbar */}
                <div className={`border-b ${th.border} px-3 py-2 flex items-center gap-2 flex-wrap shrink-0`}>
                  <button
                    onClick={() => { setEventFormDate(selectedCalDay); setShowEventForm(true); }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition shrink-0">
                    <Plus size={14} />New event <ChevronDown size={11} />
                  </button>
                  <div className={`w-px h-5 ${isDark ? "bg-gray-600" : "bg-gray-300"}`} />
                  {/* View switcher */}
                  <div className={`flex border ${th.border} rounded-lg overflow-hidden text-sm shrink-0`}>
                    {["Day","Work week","Week","Month"].map(v => (
                      <button key={v} onClick={() => setCalView(v)}
                        className={`px-3 py-1.5 font-medium transition border-r last:border-r-0 ${th.border} ${calView === v ? isDark ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-900" : `${th.text} ${th.hover}`}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <button className={`px-3 py-1.5 text-sm border ${th.border} rounded-lg ${th.hover} ${th.text} hidden lg:block`}>Split view</button>
                  <button className={`px-3 py-1.5 text-sm border ${th.border} rounded-lg ${th.hover} ${th.text} hidden lg:block`}>Share</button>
                  <button className={`px-3 py-1.5 text-sm border ${th.border} rounded-lg ${th.hover} ${th.text} hidden xl:block`}>Print</button>
                  {/* Refresh */}
                  <button
                    onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth(), 1))}
                    title="Refresh events from Microsoft Calendar"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border ${th.border} rounded-lg ${th.hover} ${th.text} ${calLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <RefreshCw size={13} className={calLoading ? "animate-spin" : ""} />
                    <span className="hidden lg:inline">Refresh</span>
                  </button>
                </div>

                {/* Sub-header: Today button + month navigation */}
                <div className={`border-b ${th.border} px-4 py-2 flex items-center gap-3 shrink-0`}>
                  <button
                    onClick={() => { setCalDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedCalDay(today); setMiniCalDate(new Date(today.getFullYear(), today.getMonth(), 1)); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border ${th.border} rounded-lg ${th.hover} ${th.text} font-medium`}>
                    <Calendar size={14} />Today
                  </button>
                  <div className="flex items-center">
                    <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className={`p-1.5 rounded-lg ${th.hover} ${th.textMuted}`}><ChevronLeft size={16} /></button>
                    <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className={`p-1.5 rounded-lg ${th.hover} ${th.textMuted}`}><ChevronRight size={16} /></button>
                  </div>
                  <h2 className={`text-lg font-semibold ${th.text}`}>
                    {calDate.toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                  </h2>
                </div>

                {/* ── Month grid ────────────────────────────────────── */}
                {calView === "Month" && (
                  <div className="flex-1 overflow-auto flex flex-col">
                    {/* Day-of-week headers */}
                    <div className={`grid grid-cols-7 border-b ${th.border} shrink-0 sticky top-0 z-10 ${th.surface}`}>
                      {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(d => (
                        <div key={d} className={`py-2 text-center text-xs font-semibold ${th.textMuted} border-r last:border-r-0 ${th.border}`}>{d}</div>
                      ))}
                    </div>
                    {/* Week rows */}
                    <div className="flex-1 grid grid-rows-6">
                      {Array.from({ length: 6 }, (_, wk) => {
                        const week = monthGrid.slice(wk * 7, wk * 7 + 7);
                        return (
                          <div key={wk} className={`grid grid-cols-7 border-b last:border-b-0 ${th.border}`} style={{ minHeight: 90 }}>
                            {week.map((cell, di) => {
                              const isToday = cell.date.toDateString() === today.toDateString();
                              const isSel = cell.date.toDateString() === selectedCalDay.toDateString();
                              const dayEvs = eventsForDay(cell.date);
                              return (
                                <div key={di}
                                  onClick={() => { setSelectedCalDay(cell.date); }}
                                  onDoubleClick={() => { setSelectedCalDay(cell.date); setEventFormDate(cell.date); setShowEventForm(true); }}
                                  className={`border-r last:border-r-0 ${th.border} p-1 cursor-pointer transition group ${!cell.curr ? "opacity-40" : ""} ${isSel && !isToday ? isDark ? "bg-gray-800" : "bg-blue-50/50" : isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"}`}>
                                  {/* Day number */}
                                  <div className="mb-1">
                                    <span className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full font-medium
                                      ${isToday ? "bg-blue-600 text-white font-bold" :
                                        isSel ? isDark ? "bg-gray-600 text-white" : "bg-blue-100 text-blue-700" :
                                        th.text}`}>
                                      {cell.date.getDate()}
                                    </span>
                                  </div>
                                  {/* Events */}
                                  <div className="space-y-0.5">
                                    {dayEvs.slice(0, 3).map(ev => (
                                      <div key={ev.id}
                                        onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                                        className={`text-xs px-1.5 py-0.5 rounded text-white font-medium truncate cursor-pointer hover:opacity-90 transition ${evColor(ev.color)}`}>
                                        <span className="opacity-80 mr-0.5 text-[10px]">{ev.start}</span>{ev.title}
                                      </div>
                                    ))}
                                    {dayEvs.length > 3 && (
                                      <p className={`text-[11px] ${th.textMuted} px-1`}>+{dayEvs.length - 3} more</p>
                                    )}
                                  </div>
                                  {/* Add hint on hover */}
                                  <button
                                    onClick={e => { e.stopPropagation(); setEventFormDate(cell.date); setShowEventForm(true); }}
                                    className={`hidden group-hover:flex items-center gap-0.5 mt-0.5 text-[11px] text-blue-500 hover:text-blue-600`}>
                                    <Plus size={10} />Add
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Day view ──────────────────────────────────────── */}
                {calView === "Day" && (
                  <div className="flex-1 overflow-auto">
                    <div className={`px-4 py-3 border-b ${th.border} text-sm font-semibold ${th.text}`}>
                      {selectedCalDay.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                    <div className="relative" style={{ minHeight: 1200 }}>
                      {/* Hour rows */}
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className={`flex border-b ${th.border}`} style={{ height: 50 }}>
                          <div className={`w-16 shrink-0 text-right pr-3 pt-1 text-xs ${th.textMuted}`}>
                            {h === 0 ? "" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`}
                          </div>
                          <div className="flex-1 relative" />
                        </div>
                      ))}
                      {/* Events overlay */}
                      {eventsForDay(selectedCalDay).map(ev => {
                        const [sh, sm] = ev.start.split(":").map(Number);
                        const [eh, em] = (ev.end || ev.start).split(":").map(Number);
                        const top = (sh * 60 + sm) / 60 * 50;
                        const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 50, 25);
                        return (
                          <div key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className={`absolute left-20 right-4 rounded-lg px-2 py-1 text-white text-xs font-medium shadow cursor-pointer hover:opacity-90 transition ${evColor(ev.color)}`}
                            style={{ top, height }}>
                            <p className="truncate font-semibold">{ev.title}</p>
                            <p className="opacity-80">{ev.start} – {ev.end || ""}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Week / Work week view ─────────────────────────── */}
                {(calView === "Week" || calView === "Work week") && (
                  <div className="flex-1 overflow-auto flex flex-col">
                    {(() => {
                      const dow = selectedCalDay.getDay();
                      const weekStart = calAddDays(selectedCalDay, -dow);
                      const cols = calView === "Work week" ? [1,2,3,4,5].map(i => calAddDays(weekStart, i)) : Array.from({length:7}, (_,i) => calAddDays(weekStart, i));
                      return (
                        <>
                          {/* Header */}
                          <div className={`grid border-b ${th.border} shrink-0`} style={{ gridTemplateColumns: `64px repeat(${cols.length}, 1fr)` }}>
                            <div className="border-r border-transparent" />
                            {cols.map((d, i) => {
                              const isTod = d.toDateString() === today.toDateString();
                              return (
                                <div key={i} className={`py-2 text-center border-r last:border-r-0 ${th.border}`}>
                                  <p className={`text-xs font-medium ${th.textMuted}`}>{d.toLocaleDateString("en-US",{weekday:"short"})}</p>
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mx-auto mt-0.5 ${isTod ? "bg-blue-600 text-white" : th.text}`}>
                                    {d.getDate()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Time grid */}
                          <div className="flex-1 overflow-auto relative" style={{ minHeight: 1200 }}>
                            {Array.from({length:24},(_,h) => (
                              <div key={h} className={`flex border-b ${th.border}`} style={{height:50}}>
                                <div className={`w-16 shrink-0 text-right pr-3 pt-1 text-xs ${th.textMuted}`}>
                                  {h > 0 ? `${h%12||12} ${h<12?"AM":"PM"}` : ""}
                                </div>
                                {cols.map((_,ci) => <div key={ci} className={`flex-1 border-r last:border-r-0 ${th.border}`} />)}
                              </div>
                            ))}
                            {/* Events */}
                            {cols.map((d, ci) => eventsForDay(d).map(ev => {
                              const [sh, sm] = ev.start.split(":").map(Number);
                              const [eh, em] = (ev.end || ev.start).split(":").map(Number);
                              const top = (sh*60+sm)/60*50;
                              const height = Math.max(((eh*60+em)-(sh*60+sm))/60*50, 25);
                              return (
                                <div key={ev.id}
                                  onClick={() => setSelectedEvent(ev)}
                                  className={`absolute rounded px-1.5 py-0.5 text-white text-[11px] font-medium shadow cursor-pointer hover:opacity-90 transition ${evColor(ev.color)}`}
                                  style={{ top, height, left: `calc(${64}px + ${ci * (100/cols.length)}%)`, width: `calc(${100/cols.length}% - 4px)` }}>
                                  <p className="truncate font-semibold">{ev.title}</p>
                                </div>
                              );
                            }))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* ── Calendar loading overlay ─────────────────────── */}
              {calLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-30 pointer-events-none">
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg ${isDark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700"} text-sm font-medium`}>
                    <RefreshCw size={15} className="animate-spin text-blue-500" />
                    Loading events…
                  </div>
                </div>
              )}

              {/* ── Event detail popup ────────────────────────────── */}
              {selectedEvent && (
                <div className="fixed inset-0 z-50" onClick={() => setSelectedEvent(null)}>
                  <div
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 ${th.card} border ${th.border} rounded-2xl shadow-2xl p-5`}
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-3 h-3 rounded-sm mt-1.5 shrink-0 ${evColor(selectedEvent.color)}`} />
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold ${th.text} leading-snug`}>{selectedEvent.title}</h3>
                        <p className={`text-xs ${th.textMuted} mt-1`}>
                          {new Date(selectedEvent.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        </p>
                        <p className={`text-xs ${th.textMuted}`}>{selectedEvent.start}{selectedEvent.end ? ` – ${selectedEvent.end}` : ""}</p>
                      </div>
                      <button onClick={() => setSelectedEvent(null)} className={`p-1 rounded ${th.hover} ${th.textMuted} shrink-0`}><X size={15} /></button>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200/30">
                      <button
                        onClick={() => handleDeleteEvent(selectedEvent)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                        <Trash2 size={14} />Delete
                      </button>
                      <button onClick={() => setSelectedEvent(null)}
                        className={`px-3 py-1.5 text-sm border ${th.border} rounded-lg ${th.hover} ${th.text}`}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── New Event Form Modal ──────────────────────────── */}
              {showEventForm && (() => {
                const evDate = eventFormDate || selectedCalDay;

                const evDateLabel = evDate ? evDate.toLocaleDateString("en-US",{weekday:"short",year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\//g,"-") : "";
                const busyOptions = ["Free","Working elsewhere","Tentative","Busy","Out of office"];
                const reminderOptions = ["Don't remind me","At time of event","5 minutes before","15 minutes before","30 minutes before","1 hour before","2 hours before","12 hours before","1 day before","1 week before"];
                const categoryOptions = [
                  {label:"Blue category",color:"#0078D4"},{label:"Green category",color:"#107C10"},
                  {label:"Orange category",color:"#CA5010"},{label:"Purple category",color:"#5C2D91"},
                  {label:"Red category",color:"#D13438"},{label:"Yellow category",color:"#C19C00"},
                ];
                const busyDotColor = (s) => s==="Free"?"bg-green-400":s==="Working elsewhere"?"bg-yellow-400":s==="Tentative"?"bg-blue-400":s==="Out of office"?"bg-purple-400":"bg-[#6264A7]";
                const closeAllDd = () => { setShowEvBusyDd(false); setShowEvReminderDd(false); setShowEvCategoryDd(false); setShowEvPrivacyDd(false); };
                // day-view block positions
                const [sh, sm] = newEventStart.split(":").map(Number);
                const [eh, em] = newEventEnd.split(":").map(Number);
                const gridStart = 7;
                const topPx = Math.max(0,((sh-gridStart)*60+sm)/60*48);
                const heightPx = Math.max(28,((eh*60+em)-(sh*60+sm))/60*48);
                return (
                  <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={()=>setShowEventForm(false)}>
                    <div className="bg-[#1f1f2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{height:"110vh"}} onClick={e=>e.stopPropagation()}>

                      {/* ── Top toolbar ── */}
                      <div className="flex items-center justify-between px-3 py-2 bg-[#141424] border-b border-white/10 shrink-0 flex-wrap gap-1">
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {/* Save */}
                          <button onClick={handleSaveEvent}
                            disabled={!newEventTitle.trim()}
                            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md mr-1 transition-colors ${newEventTitle.trim()?"bg-blue-600 hover:bg-blue-700 text-white":"bg-blue-600/30 text-white/35 cursor-not-allowed"}`}>
                            <Bookmark size={13}/>Save
                          </button>
                          {/* Event tab */}
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-semibold rounded-md">
                            <Calendar size={13} className="text-blue-400"/>Event
                          </button>
                          {/* Series tab */}
                          <button className="flex items-center gap-1.5 px-3 py-1.5 text-white/50 hover:bg-white/8 text-xs rounded-md transition-colors">
                            <RefreshCw size={13}/>Series
                          </button>
                          <div className="w-px h-5 bg-white/15 mx-1"/>
                          {/* Busy dropdown */}
                          <div className="relative">
                            <button onClick={()=>{closeAllDd();setShowEvBusyDd(p=>!p);}}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-white/60 hover:bg-white/8 text-xs rounded-md transition-colors">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${busyDotColor(evBusyStatus)}`}/>
                              {evBusyStatus}<ChevronDown size={11}/>
                            </button>
                            {showEvBusyDd && (
                              <><div className="fixed inset-0 z-40" onClick={()=>setShowEvBusyDd(false)}/>
                              <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1">
                                {busyOptions.map(opt=>(
                                  <button key={opt} onClick={()=>{setEvBusyStatus(opt);setShowEvBusyDd(false);}}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${busyDotColor(opt)}`}/>
                                    <span className="flex-1">{opt}</span>
                                    {evBusyStatus===opt&&<Check size={12} className="text-blue-400"/>}
                                  </button>
                                ))}
                              </div></>
                            )}
                          </div>
                          {/* Reminder dropdown */}
                          <div className="relative">
                            <button onClick={()=>{closeAllDd();setShowEvReminderDd(p=>!p);}}
                              className="flex items-center gap-0.5 px-2 py-1.5 text-white/45 hover:bg-white/8 rounded-md transition-colors">
                              <Bell size={13}/><ChevronDown size={11}/>
                            </button>
                            {showEvReminderDd && (
                              <><div className="fixed inset-0 z-40" onClick={()=>setShowEvReminderDd(false)}/>
                              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1">
                                {reminderOptions.map(opt=>(
                                  <button key={opt} onClick={()=>{setEvReminder(opt);setShowEvReminderDd(false);}}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
                                    <span className="w-3.5 shrink-0 flex justify-center">{evReminder===opt&&<Check size={12} className="text-blue-400"/>}</span>
                                    {opt}
                                  </button>
                                ))}
                                <div className="border-t border-white/10 mt-1 pt-1">
                                  <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/50 hover:bg-white/10 transition-colors">
                                    <span className="w-3.5 shrink-0"/>Add email reminder
                                  </button>
                                </div>
                              </div></>
                            )}
                          </div>
                          {/* Category dropdown */}
                          <div className="relative">
                            <button onClick={()=>{closeAllDd();setShowEvCategoryDd(p=>!p);}}
                              className="flex items-center gap-0.5 px-2 py-1.5 text-white/45 hover:bg-white/8 rounded-md transition-colors">
                              <Tag size={13}/><ChevronDown size={11}/>
                            </button>
                            {showEvCategoryDd && (
                              <><div className="fixed inset-0 z-40" onClick={()=>setShowEvCategoryDd(false)}/>
                              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1">
                                {categoryOptions.map(({label,color})=>(
                                  <button key={label} onClick={()=>{setEvCategory(c=>c===label?null:label);setShowEvCategoryDd(false);}}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
                                    <span style={{color}} className="shrink-0"><Tag size={13}/></span>
                                    <span className="flex-1">{label}</span>
                                    {evCategory===label&&<Check size={12} className="text-blue-400"/>}
                                  </button>
                                ))}
                                <div className="border-t border-white/10 mt-1 pt-1">
                                  <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/50 hover:bg-white/10 transition-colors">
                                    <span className="w-3.5 shrink-0"/>New category
                                  </button>
                                </div>
                              </div></>
                            )}
                          </div>
                          {/* Privacy dropdown */}
                          <div className="relative">
                            <button onClick={()=>{closeAllDd();setShowEvPrivacyDd(p=>!p);}}
                              className="flex items-center gap-0.5 px-2 py-1.5 text-white/45 hover:bg-white/8 rounded-md transition-colors">
                              <Lock size={13}/><ChevronDown size={11}/>
                            </button>
                            {showEvPrivacyDd && (
                              <><div className="fixed inset-0 z-40" onClick={()=>setShowEvPrivacyDd(false)}/>
                              <div className="absolute top-full left-0 mt-1 w-40 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1">
                                {["Private","Not private"].map(opt=>(
                                  <button key={opt} onClick={()=>{setEvPrivacy(opt);setShowEvPrivacyDd(false);}}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
                                    <span className="w-3.5 shrink-0 flex justify-center">{evPrivacy===opt&&<Check size={12} className="text-blue-400"/>}</span>
                                    {opt}
                                  </button>
                                ))}
                              </div></>
                            )}
                          </div>
                        </div>
                        <button onClick={()=>setShowEventForm(false)} className="p-1.5 hover:bg-white/10 rounded-md text-white/35 transition-colors ml-auto">
                          <X size={15}/>
                        </button>
                      </div>

                      {/* ── Body ── */}
                      <div className="flex flex-1 overflow-hidden">

                        {/* LEFT: form */}
                        <div className="flex-1 overflow-y-auto px-7 py-5">
                          {/* Calendar selector */}
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/8">
                            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0"/>
                            <span className="text-sm text-white/70">
                              Calendar ({accounts[0]?.username || "your account"})
                            </span>
                            <ChevronDown size={13} className="text-white/35"/>
                          </div>

                          {/* Title */}
                          <div className="border-b border-white/20 mb-4 pb-1">
                            <input autoFocus type="text" placeholder="Add title"
                              value={newEventTitle}
                              onChange={e=>setNewEventTitle(e.target.value)}
                              className="w-full bg-transparent text-[22px] font-light text-white placeholder-white/25 focus:outline-none"/>
                          </div>

                          {/* ── Attendees / People picker ── */}
                          <div className="relative border-b border-white/8 px-1 py-2">
                            <div className="flex items-start gap-3">
                              <Users size={18} className="text-white/35 shrink-0 mt-2"/>
                              <div className="flex-1 min-w-0">
                                {/* Selected chips */}
                                {evSelectedAttendees.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2 pt-1">
                                    {evSelectedAttendees.map(p => {
                                      const avatarColors = ["bg-blue-600","bg-emerald-600","bg-rose-600","bg-amber-600","bg-violet-600","bg-cyan-600","bg-pink-600","bg-teal-600"];
                                      const ac = avatarColors[(p.name||p.email).charCodeAt(0) % avatarColors.length];
                                      const ini = (p.name||p.email).split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                                      return (
                                        <span key={p.email} className="flex items-center gap-1.5 bg-blue-600/15 border border-blue-500/30 text-white text-xs px-2 py-1 rounded-full max-w-[180px]">
                                          <span className={`w-4 h-4 rounded-full ${ac} flex items-center justify-center text-[8px] font-bold shrink-0`}>{ini}</span>
                                          <span className="truncate">{p.name||p.email}</span>
                                          <button onMouseDown={e=>{e.preventDefault();setEvSelectedAttendees(a=>a.filter(x=>x.email!==p.email));}} className="text-white/35 hover:text-white/80 shrink-0 ml-0.5">
                                            <X size={10}/>
                                          </button>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Search input */}
                                <input type="text"
                                  placeholder={evSelectedAttendees.length ? "Add more attendees..." : "Invite required attendees"}
                                  value={evAttendeeSearch}
                                  onChange={e=>{setEvAttendeeSearch(e.target.value);setShowEvAttendeePicker(true);}}
                                  onFocus={()=>setShowEvAttendeePicker(true)}
                                  onBlur={()=>setTimeout(()=>setShowEvAttendeePicker(false),150)}
                                  className="w-full bg-transparent text-sm text-white placeholder-white/30 focus:outline-none py-1"/>
                              </div>
                              <AtSign size={15} className="text-white/25 shrink-0 mt-2"/>
                            </div>

                            {/* ── Suggestions dropdown ── */}
                            {showEvAttendeePicker && (() => {
                              const q = evAttendeeSearch.toLowerCase().trim();
                              const pool = outlookPeople.filter(p => !evSelectedAttendees.some(a => a.email.toLowerCase() === p.email.toLowerCase()));
                              const suggestions = q
                                ? pool.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
                                : pool.slice(0, 12);
                              const avatarColors = ["bg-blue-600","bg-emerald-600","bg-rose-600","bg-amber-600","bg-violet-600","bg-cyan-600","bg-pink-600","bg-teal-600","bg-orange-600","bg-indigo-600"];
                              const addAttendee = p => {
                                setEvSelectedAttendees(a => [...a, { name: p.name, email: p.email }]);
                                setEvAttendeeSearch("");
                                setShowEvAttendeePicker(true);
                              };
                              return (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden" style={{maxHeight:300,overflowY:"auto"}}>
                                  {/* Header */}
                                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-[#15162a]">
                                    <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                                      {q ? "Search results" : "Suggested from Outlook"}
                                    </span>
                                    {!q && outlookPeople.length > 0 && (
                                      <span className="text-[10px] text-white/30">{outlookPeople.length} contacts</span>
                                    )}
                                  </div>

                                  {/* Loading */}
                                  {!q && outlookPeople.length === 0 && (
                                    <div className="flex items-center justify-center py-6 gap-2">
                                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                                      <span className="text-xs text-white/35">Fetching contacts…</span>
                                    </div>
                                  )}

                                  {/* No results */}
                                  {q && suggestions.length === 0 && (
                                    <div className="px-4 py-4 text-center">
                                      <Users size={22} className="text-white/20 mx-auto mb-1"/>
                                      <p className="text-xs text-white/40">No contacts match "<span className="text-white/60">{evAttendeeSearch}</span>"</p>
                                    </div>
                                  )}

                                  {/* People list */}
                                  {suggestions.map((p, idx) => {
                                    const ini = p.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "?";
                                    const ac = avatarColors[p.name.charCodeAt(0) % avatarColors.length];
                                    return (
                                      <button key={p.email + idx}
                                        onMouseDown={e=>{e.preventDefault();addAttendee(p);}}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 active:bg-white/12 transition-colors text-left group">
                                        <div className={`w-9 h-9 rounded-full ${ac} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                                          {ini}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <p className="text-sm text-white font-medium truncate leading-tight">{p.name}</p>
                                            {p.source === "people" && (
                                              <span className="shrink-0 text-[9px] font-semibold bg-blue-600/25 text-blue-300 px-1.5 py-0.5 rounded-full leading-none">Outlook</span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-white/45 truncate leading-tight">{p.email}</p>
                                          {p.title && <p className="text-[10px] text-white/30 truncate leading-tight">{p.title}</p>}
                                        </div>
                                        <div className="w-6 h-6 rounded-full border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <Plus size={12} className="text-white/60"/>
                                        </div>
                                      </button>
                                    );
                                  })}

                                  {/* Footer */}
                                  {suggestions.length > 0 && (
                                    <div className="px-4 py-2 border-t border-white/8 text-[10px] text-white/25 bg-[#15162a]">
                                      Click to add · {evSelectedAttendees.length} selected
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Date / Time */}
                          <div className="flex items-center gap-4 py-3 border-b border-white/8 px-1 flex-wrap">
                            <Clock size={18} className="text-white/35 shrink-0"/>
                            <div className="flex items-center gap-2 flex-1 flex-wrap text-sm text-white">
                              <span className="text-white/60">{evDateLabel}</span>
                              {!newEventAllDay && (
                                <>
                                  <input type="time" value={newEventStart}
                                    onChange={e=>setNewEventStart(e.target.value)}
                                    className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"/>
                                  <span className="text-white/30">-</span>
                                  <input type="time" value={newEventEnd}
                                    onChange={e=>setNewEventEnd(e.target.value)}
                                    className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"/>
                                </>
                              )}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer shrink-0">
                              <div onClick={()=>setNewEventAllDay(p=>!p)}
                                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${newEventAllDay?"bg-blue-600":"bg-white/20"}`}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newEventAllDay?"translate-x-4":"translate-x-0.5"}`}/>
                              </div>
                              <span className="text-xs text-white/50">All day</span>
                            </label>
                            <button className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white/65 border border-white/15 px-2.5 py-1.5 rounded-md transition-colors shrink-0">
                              <Calendar size={12}/>Scheduler
                            </button>
                          </div>

                          {/* Location */}
                          <div className="flex items-center gap-4 py-3 border-b border-white/8 px-1">
                            <MapPin size={18} className="text-white/35 shrink-0"/>
                            <input type="text" placeholder="Add a room or location"
                              value={newEventLocation}
                              onChange={e=>setNewEventLocation(e.target.value)}
                              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                          </div>

                          {/* Teams meeting toggle */}
                          <div className="flex items-center gap-4 py-3 border-b border-white/8 px-1">
                            <Video size={18} className="text-white/35 shrink-0"/>
                            <div onClick={()=>setNewEventOnline(p=>!p)}
                              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${newEventOnline?"bg-blue-600":"bg-white/20"}`}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newEventOnline?"translate-x-4":"translate-x-0.5"}`}/>
                            </div>
                            <span className="text-sm text-white/70 font-medium">Teams meeting</span>
                          </div>

                          {/* Description */}
                          <div className="mt-4 border border-white/10 rounded-xl overflow-hidden">
                            <textarea rows={6} placeholder="Add a description or notes..."
                              value={newEventDescription}
                              onChange={e=>setNewEventDescription(e.target.value)}
                              className="w-full bg-[#1a1a2e] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none resize-none"/>
                            <div className="flex items-center gap-0.5 px-3 py-2 bg-[#252638] border-t border-white/10">
                              {[[Paperclip,"Attach"],[Pencil,"Format"],[Link2,"Link"],[Smile,"Emoji"],[Sparkles,"AI Assist"]].map(([Icon,label])=>(
                                <button key={label} title={label} className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white/70 transition-colors">
                                  <Icon size={14}/>
                                </button>
                              ))}
                              <div className="w-px h-4 bg-white/15 mx-1"/>
                              {[[Copy,"Copy"],[Globe,"Translate"],[Mic,"Dictate"]].map(([Icon,label])=>(
                                <button key={label} title={label} className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white/70 transition-colors">
                                  <Icon size={14}/>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Agenda */}
                          <div className="flex items-center gap-4 py-3 mt-3 border-t border-white/8 px-1">
                            <FileText size={18} className="text-white/35 shrink-0"/>
                            <input type="text" placeholder="Add an agenda"
                              value={newEventAgenda}
                              onChange={e=>setNewEventAgenda(e.target.value)}
                              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                          </div>
                        </div>

                        {/* RIGHT: Day view */}
                        <div className="w-64 border-l border-white/10 flex flex-col shrink-0 bg-[#14142a]">
                          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-0.5">
                              <button className="p-1 hover:bg-white/10 rounded text-white/40 transition-colors"><ChevronLeft size={14}/></button>
                              <button className="p-1 hover:bg-white/10 rounded text-white/40 transition-colors"><Calendar size={13}/></button>
                              <button className="p-1 hover:bg-white/10 rounded text-white/40 transition-colors"><ChevronRight size={14}/></button>
                            </div>
                            <span className="text-[11px] text-white/60 font-medium">
                              {evDate ? evDate.toLocaleDateString("en-US",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}) : ""}
                            </span>
                            <button className="p-1 hover:bg-white/10 rounded text-white/35 transition-colors"><ExternalLink size={13}/></button>
                          </div>
                          <div className="flex-1 overflow-y-auto relative">
                            {Array.from({length:14},(_,i)=>{
                              const h=i+7;
                              const h12=h===12?12:h>12?h-12:h;
                              const ap=h<12?"AM":"PM";
                              return (
                                <div key={h} className="flex border-b border-white/5" style={{height:48}}>
                                  <div className="w-14 text-right pr-2 pt-1 text-[9px] text-white/30 shrink-0 leading-tight select-none">{h12} {ap}</div>
                                  <div className="flex-1 border-l border-white/5"/>
                                </div>
                              );
                            })}
                            {!newEventAllDay && (
                              <div className="absolute left-14 right-1 rounded-md bg-[#c84b4b] px-2 py-1 text-white text-[11px] font-medium shadow-lg flex flex-col justify-center"
                                style={{top:topPx,height:heightPx}}>
                                <span className="truncate font-semibold leading-tight">{newEventTitle||"New event"}</span>
                                <span className="truncate opacity-80 leading-tight">{newEventStart} – {newEventEnd}</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── People stub ───────────────────────────────────────────────── */}
        {activeApp === "People" && (
          <div className={`flex-1 flex flex-col items-center justify-center ${th.bg}`}>
            <Users size={64} className={`mb-4 ${th.textMuted} opacity-30`} />
            <p className={`text-xl font-semibold ${th.text}`}>People</p>
            <p className={`text-sm ${th.textMuted} mt-2`}>Your contacts are available in the Contacts module.</p>
          </div>
        )}

        {/* ── Tasks stub ────────────────────────────────────────────────── */}
        {activeApp === "Tasks" && (
          <div className={`flex-1 flex flex-col items-center justify-center ${th.bg}`}>
            <CheckSquare size={64} className={`mb-4 ${th.textMuted} opacity-30`} />
            <p className={`text-xl font-semibold ${th.text}`}>Tasks</p>
            <p className={`text-sm ${th.textMuted} mt-2`}>Manage your tasks and to-do items here.</p>
          </div>
        )}

        {/* ── Files stub ────────────────────────────────────────────────── */}
        {activeApp === "Files" && (
          <div className={`flex-1 flex flex-col items-center justify-center ${th.bg}`}>
            <FolderOpen size={64} className={`mb-4 ${th.textMuted} opacity-30`} />
            <p className={`text-xl font-semibold ${th.text}`}>Files</p>
            <p className={`text-sm ${th.textMuted} mt-2`}>Access your OneDrive files and email attachments.</p>
          </div>
        )}
      </div>

      {/* ── Compose Modal ────────────────────────────────────────────────── */}
      {showCompose && (
        <Email
          accessToken={accessToken}
          onClose={() => { setShowCompose(false); setReplyData(null); }}
          replyData={replyData}
          onMailSent={mail => { handleMailSent(mail); setShowCompose(false); setReplyData(null); }}
        />
      )}

      {/* ── Schedule Send Modal ──────────────────────────────────────────── */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1300] p-4">
          <div className={`${th.card} border ${th.border} rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${th.border} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${th.text} flex items-center gap-2`}>
                <Clock size={16} className="text-blue-500" />Schedule send
              </h3>
              <button onClick={() => setScheduleModal(false)} className={`p-1.5 rounded-lg ${th.hover} ${th.textMuted} transition`}>
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4">
              <label className={`text-xs font-medium ${th.textMuted} mb-2 block`}>Select date and time</label>
              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={e => setScheduleDateTime(e.target.value)}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                className={`w-full px-3 py-2 border ${th.border} rounded-lg text-sm ${th.text} ${isDark ? "bg-gray-800" : "bg-white"} outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100`}
              />
              {inlineError && <p className="mt-2 text-xs text-red-500">{inlineError}</p>}
            </div>
            <div className={`px-5 py-3 border-t ${th.border} flex items-center justify-end gap-2`}>
              <button onClick={() => { setScheduleModal(false); setInlineError(""); }}
                className={`px-4 py-2 text-sm font-medium ${th.textMuted} ${th.hover} rounded-lg transition`}>
                Cancel
              </button>
              <button onClick={handleScheduleSend} disabled={!scheduleDateTime || schedulingInProgress}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                <Clock size={14} />{schedulingInProgress ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
      <nav className={`md:hidden flex items-center justify-around h-14 border-t ${th.border} ${th.surface} shrink-0 z-20`}>
        {[
          { key: "Mail",     icon: Mail,        badge: folderCounts.Inbox },
          { key: "Calendar", icon: Calendar,    badge: 0 },
          { key: "People",   icon: Users,       badge: 0 },
          { key: "Tasks",    icon: CheckSquare, badge: 0 },
          { key: "Files",    icon: FolderOpen,  badge: 0 },
        ].map(({ key, icon: Icon, badge }) => (
          <button key={key} onClick={() => setActiveApp(key)}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition ${activeApp === key ? "text-blue-600" : th.textMuted}`}>
            <Icon size={20} />
            <span className="text-[9px] font-medium">{key}</span>
            {badge > 0 && (
              <span className="absolute top-2 right-[calc(50%-14px)] w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default OutlookEmail;
