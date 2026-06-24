import { useEffect, useState, useMemo, useCallback, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../auth/AuthContext";
import DOMPurify from "dompurify";
import apiClient from "../api/client";
import { useMsal } from "@azure/msal-react";
import {
  Mail,
  X,
  ChevronDown,
  ChevronRight,
  Inbox,
  Send,
  Clock,
  PhoneCall,
  FileText,
  Plus,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Video,
  StickyNote,
} from "lucide-react";

function extractUniqueEmails(...values) {
  const seen = new Set();
  const emails = [];

  const addEmail = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
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

function buildEmailCacheKey(contactId, contactEmails) {
  const contactPart = contactId ? `contact-${contactId}` : "contact-unknown";
  const emailPart = (contactEmails || []).join("|");
  return `contact-email-logs:${contactPart}:${emailPart}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const OUTLOOK_GRAPH_SCOPES = [
  "https://graph.microsoft.com/User.Read",
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
];

const CALENDAR_GRAPH_SCOPES = [
  "https://graph.microsoft.com/Calendars.ReadWrite",
];

// Normalize a raw Microsoft Graph calendar event into a flat display object
function normalizeGraphEvent(ev) {
  const attendeeList = (ev.attendees || [])
    .map((a) => {
      const name = a.emailAddress?.name || "";
      const addr = a.emailAddress?.address || "";
      return name && name !== addr ? `${name} <${addr}>` : addr;
    })
    .filter(Boolean)
    .join(", ");

  const rawBody = ev.body?.content || ev.bodyPreview || "";
  const plainBody = rawBody
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Append "Z" only when Graph explicitly says UTC — avoids double-shift
  const parseGDate = (dt, tz) => {
    if (!dt) return null;
    return tz === "UTC" ? dt.replace(/Z?$/, "Z") : dt;
  };

  return {
    id: ev.id,
    MeetingId: ev.id,
    title: ev.subject || "",
    from: parseGDate(ev.start?.dateTime, ev.start?.timeZone),
    to: parseGDate(ev.end?.dateTime, ev.end?.timeZone),
    timeZone: ev.start?.timeZone || "UTC",
    location: ev.location?.displayName || "",
    description: plainBody.slice(0, 800),
    attendees: attendeeList,
    isOnlineMeeting: ev.isOnlineMeeting || false,
    teamsJoinUrl: ev.onlineMeeting?.joinUrl || ev.onlineMeetingUrl || "",
    organizer: ev.organizer?.emailAddress?.address || "",
  };
}

async function fetchGraphWithRetry(url, headers, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await window.fetch(url, { headers });
    if (response.status !== 429) {
      return response;
    }

    const retryAfterHeader = response.headers.get("Retry-After");
    const retryDelayMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : 1000 * (attempt + 1);

    if (attempt === maxRetries) {
      return response;
    }

    await sleep(retryDelayMs);
  }

  throw new Error("Unexpected retry loop exit");
}

// Helper function to get current date-time in local timezone (ISO format)
function getLocalDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${date}T${hours}:${minutes}`;
}

// Helper function to format date-only in local timezone
function formatLocalDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${date}T${hours}:${minutes}`;
}

// Helper function to convert local datetime string to ISO string
function dateTimeToISO(dateTimeString) {
  if (!dateTimeString) return "";
  const d = new Date(dateTimeString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${date}T${hours}:${minutes}:${seconds}.000Z`;
}

// Helper function to convert duration string (HH:MM or MM:SS) to TimeSpan format
function convertToTimeSpanFormat(durationStr) {
  if (!durationStr) return null;
  // If already in TimeSpan format (HH:MM:SS), return as-is
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(durationStr)) return durationStr;
  // If in HH:MM format, add :00 for seconds
  if (/^\d{1,2}:\d{2}$/.test(durationStr)) return `${durationStr}:00`;
  return null;
}

export default function ContactEmailLogs({
  WorkEmail,
  contactEmail: contactEmailProp,
  contactEmails: contactEmailsProp,
  contactName,
  accountName,
  accountId,
  contactId,
  onClose,
}) {
  const auth = useContext(AuthContext);
  const isAdmin = ["admin", "Admin"].includes(auth?.getRole?.() ?? "");

  const contactEmail = contactEmailProp || WorkEmail || "";
  // Memoize contactEmails so the array reference is stable across renders
  // Without this, extractUniqueEmails returns a new array every render,
  // causing the email fetch useEffect to fire infinitely (infinite loop + 429s)
  const contactEmails = useMemo(
    () => extractUniqueEmails(contactEmailsProp, contactEmail, WorkEmail),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contactId, contactEmailProp, WorkEmail, contactEmailsProp],
  );
  // Tabs state
  const [activeTab, setActiveTab] = useState("email");

  //copy note state
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [copiedCallLogId, setCopiedCallLogId] = useState(null);

  // Email logic (Microsoft Graph / MSAL — same pattern as Email.js / OutlookEmail.js)
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const isOutlookLoggedIn = accounts.length > 0;
  const [accessToken, setAccessToken] = useState("");

  const handleAddDeal = () => {
    const prefill = {
      contactId,
      contactName,
      accountId,
      accountName,
    };

    if (typeof window.openAddDealForm === "function") {
      window.openAddDealForm(prefill);
    } else {
      navigate("/dashboard/Deals");
    }
  };
  const [calendarToken, setCalendarToken] = useState("");
  const [emails, setEmails] = useState([]);
  const totalConversationEmails = emails.length;
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [openEmail, setOpenEmail] = useState(null);
  const emailCacheKey = buildEmailCacheKey(contactId, contactEmails);

  // Call log logic
  const [callLogs, setCallLogs] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [callError, setCallError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState(null);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [callLogForm, setCallLogForm] = useState({
    id: "",
    callOwner: contactName || "",
    callType: "",
    callDirection: "",
    callStatus: "",
    callDuration: "",
    outcome: "",
    phone: "",
    associatedWithCall: "",
    notes: "",
    createdAt: getLocalDateTime(),
    // Auto-populate from context - don't show these in forms
    contactId: contactId || "",
    accountId: "", // Will be auto-populated from contact if needed
    dealId: "", // Don't show dealId in contacts conversation
  });
  const [editCallLog, setEditCallLog] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);

  const handleImportFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      setImportFile(null);
      return;
    }
    setImportFile(file);
    setImportError(null);
  };

  const closeImportModal = () => {
    if (importLoading) return;
    setShowImportModal(false);
    setImportFile(null);
    setImportError(null);
  };

  const handleImportUpload = async (e) => {
    e.preventDefault();
    if (!importFile) {
      setImportError("Please select a file to upload.");
      return;
    }
    setImportLoading(true);
    setImportError(null);
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      const res = await apiClient.post("/import/calllogs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const success =
        res?.data?.success ?? (res?.status >= 200 && res?.status < 300);
      if (success) {
        alert(res?.data?.message || "Call logs imported successfully.");
        closeImportModal();
        fetchCallLogs();
        return;
      }
      setImportError(
        res?.data?.message ||
        "Import failed. Please verify the file and try again.",
      );
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Import failed. Please try again.";
      setImportError(message);
    } finally {
      setImportLoading(false);
    }
  };

  // Compatibility wrapper: route same-origin fetch calls through axios client
  // NOTE: removed local fetch wrapper — use global `window.fetch` for external
  // Graph calls and `apiClient` for same-origin backend requests.

  const handleOutlookLogin = useCallback(async () => {
    try {
      setEmailError(null);
      await instance.loginRedirect({ scopes: OUTLOOK_GRAPH_SCOPES });
    } catch (error) {
      console.error("ContactEmailLogs: MSAL login failed:", error);
      setEmailError("Sign-in failed. Please try again.");
    }
  }, [instance]);

  // Email fetching — token only when MSAL account exists
  useEffect(() => {
    async function getToken() {
      if (!accounts.length) {
        setAccessToken("");
        setLoadingEmails(false);
        return;
      }
      const request = { account: accounts[0], scopes: OUTLOOK_GRAPH_SCOPES };
      try {
        const response = await instance.acquireTokenSilent(request);
        setAccessToken(response.accessToken);
        setEmailError(null);
      } catch (error) {
        console.warn(
          "ContactEmailLogs: silent token failed, redirecting",
          error?.errorCode,
        );
        try {
          await instance.acquireTokenRedirect(request);
        } catch (e) {
          console.error("ContactEmailLogs: token redirect failed", e);
          setEmailError("Failed to get access token. Please sign in again.");
        }
      }
    }
    getToken();
  }, [accounts, instance]);

  // Fetch logged-in user's email from Graph once we have an access token
  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;
    async function fetchMe() {
      try {
        const res = await window.fetch(
          "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return;
        if (!mounted) return;
        // prefer `mail` then `userPrincipalName`
      } catch (e) {
        // ignore
      }
    }
    fetchMe();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  // Acquire calendar token (Calendars.ReadWrite) silently — same account, already consented
  useEffect(() => {
    async function getCalToken() {
      if (!accounts.length) {
        setCalendarToken("");
        return;
      }
      try {
        const resp = await instance.acquireTokenSilent({
          scopes: CALENDAR_GRAPH_SCOPES,
          account: accounts[0],
        });
        setCalendarToken(resp.accessToken);
      } catch (err) {
        console.warn(
          "Calendar token acquisition failed (silent):",
          err?.errorCode || err?.message,
        );
        // Non-fatal — meetings tab will show sign-in prompt
      }
    }
    getCalToken();
  }, [accounts, instance]);

  // Fetch emails using WorkEmail + Emails fields (from, to, cc)
  useEffect(() => {
    if (!accessToken || contactEmails.length === 0 || activeTab !== "email")
      return;

    // Check session cache first — show instantly if available
    try {
      const cached = sessionStorage.getItem(emailCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmails(parsed);
          setLoadingEmails(false);
          return;
        }
      }
    } catch (e) { }

    let cancelled = false;
    setLoadingEmails(true);
    setEmailError(null);

    async function fetchEmails() {
      try {
        const sel =
          "id,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime";
        const headers = { Authorization: `Bearer ${accessToken}` };
        const contactEmailSet = new Set(contactEmails);
        const payloads = [];

        // Search from, to, cc for each unique email (WorkEmail + Emails field, max 3)
        const emailsToSearch = contactEmails.slice(0, 3);
        for (const email of emailsToSearch) {
          for (const field of ["from", "to", "cc"]) {
            if (cancelled) return;
            try {
              const response = await fetchGraphWithRetry(
                `https://graph.microsoft.com/v1.0/me/messages?$search="${field}:${email}"&$top=50&$select=${sel}`,
                headers,
              );
              payloads.push(
                response.ok ? await response.json() : { value: [] },
              );
            } catch (e) {
              payloads.push({ value: [] });
            }
            await sleep(200);
          }
        }

        if (cancelled) return;

        // Deduplicate and filter to only emails involving the contact
        const all = payloads.flatMap((p) => p.value || []);
        const seen = new Set();
        const merged = all.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          const fromAddr = m.from?.emailAddress?.address?.toLowerCase();
          const toAddrs = (m.toRecipients || [])
            .map((r) => r.emailAddress?.address?.toLowerCase())
            .filter(Boolean);
          const ccAddrs = (m.ccRecipients || [])
            .map((r) => r.emailAddress?.address?.toLowerCase())
            .filter(Boolean);
          return (
            (fromAddr && contactEmailSet.has(fromAddr)) ||
            toAddrs.some((a) => contactEmailSet.has(a)) ||
            ccAddrs.some((a) => contactEmailSet.has(a))
          );
        });

        merged.sort(
          (a, b) =>
            new Date(b.receivedDateTime || b.sentDateTime || 0) -
            new Date(a.receivedDateTime || a.sentDateTime || 0),
        );

        setEmails(merged);
        try {
          sessionStorage.setItem(emailCacheKey, JSON.stringify(merged));
        } catch (e) { }
        setLoadingEmails(false);
      } catch (e) {
        if (cancelled) return;
        setEmailError("Failed to fetch emails");
        setLoadingEmails(false);
      }
    }

    fetchEmails();
    return () => {
      cancelled = true;
    };
  }, [accessToken, contactEmails, emailCacheKey, activeTab]);

  // Call logs fetching
  const fetchCallLogs = async () => {
    if (!contactName && !contactId) return;
    setLoadingCalls(true);
    setCallError(null);
    try {
      let axiosRes = null;
      // Prefer fetching by numeric contactId if available
      if (contactId) {
        try {
          axiosRes = await apiClient.get(
            `/CallLog/contact/${encodeURIComponent(contactId)}`,
          );
        } catch (e) {
          axiosRes = null;
        }
      }
      // Fallback to fetching all logs and filter client-side
      if (!axiosRes || axiosRes.status < 200 || axiosRes.status >= 300) {
        try {
          axiosRes = await apiClient.get(`/CallLog`);
        } catch (e) {
          axiosRes = null;
        }
      }
      if (!axiosRes) throw new Error("Failed to fetch call logs");
      const data = axiosRes.data;
      // If we received the full list, filter by contactId or contactName
      let filtered = data;
      if (Array.isArray(data)) {
        if (contactId) {
          filtered = data.filter(
            (c) =>
              Number(c.contactId || c.ContactId) === Number(contactId) ||
              String(c.contactId || c.ContactId) === String(contactId),
          );
        } else if (contactName) {
          const n = contactName.toLowerCase();
          filtered = data.filter(
            (c) => (c.name || c.Name || "").toLowerCase() === n,
          );
        }
      }
      setCallLogs(filtered);
    } catch (e) {
      // Silently handle errors - call logs may not be available
      setCallError("Failed to fetch call logs");
    } finally {
      setLoadingCalls(false);
    }
  };

  useEffect(() => {
    fetchCallLogs();
    // eslint-disable-next-line
  }, [contactName, contactId]);

  // Create or update call log
  const handleCallLogSubmit = async (e) => {
    e.preventDefault();
    const url = editCallLog
      ? `/CallLog/${encodeURIComponent(callLogForm.id)}`
      : `/CallLog`;
    // Build payload with ALL backend fields properly mapped
    const contactIdNumber = Number(contactId ?? callLogForm.contactId);
    const accountIdNumber = Number(callLogForm.accountId) || null;
    const dealIdNumber = Number(callLogForm.dealId) || null;

    const payload = {
      callLogId: editCallLog ? callLogForm.id : undefined,
      callOwner: callLogForm.callOwner || contactName || "",
      callType: callLogForm.callType || "",
      callDirection: callLogForm.callDirection || "",
      callStatus: callLogForm.callStatus || "",
      callDuration: callLogForm.callDuration
        ? convertToTimeSpanFormat(callLogForm.callDuration)
        : null,
      outcome: callLogForm.outcome || "",
      phone: callLogForm.phone || "",
      associatedWithCall: callLogForm.associatedWithCall || "",
      notes: callLogForm.notes || "",
      createdAt: callLogForm.createdAt
        ? dateTimeToISO(callLogForm.createdAt)
        : new Date().toISOString(),
      contactId: Number.isFinite(contactIdNumber) ? contactIdNumber : null,
      accountId: Number.isFinite(accountIdNumber) ? accountIdNumber : null,
      dealId: Number.isFinite(dealIdNumber) ? dealIdNumber : null,
    };

    // If callOwner is empty but we have a contactId, try fetching contact to populate
    if (
      (!payload.callOwner || payload.callOwner.trim() === "") &&
      payload.contactId
    ) {
      try {
        const contactRes = await apiClient.get(
          `/Contact/${encodeURIComponent(payload.contactId)}`,
        );
        const contactData = contactRes?.data;
        const maybeName =
          contactData.name ||
          contactData.Name ||
          `${contactData.FirstName || contactData.firstName || ""} ${contactData.LastName || contactData.lastName || ""}`.trim() ||
          contactData.WorkEmail ||
          contactData.Email ||
          "";
        if (maybeName) payload.callOwner = maybeName;
      } catch (e) {
        console.warn("Failed to fetch contact for name fallback:", e);
      }
    }
    // Remove callLogId for POST (create) so backend assigns identity
    if (!editCallLog) {
      delete payload.callLogId;
    }

    try {
      console.log("CallLog payload:", payload);
      const r = await (editCallLog
        ? apiClient.put(url.replace(/^\//, ""), payload)
        : apiClient.post(url.replace(/^\//, ""), payload));
      if (!r || r.status < 200 || r.status >= 300)
        throw new Error("HTTP error");
      setShowCallLogForm(false);
      setEditCallLog(null);
      setCallLogForm({
        id: "",
        callOwner: contactName || "",
        callType: "",
        callDirection: "",
        callStatus: "",
        callDuration: "",
        outcome: "",
        phone: "",
        associatedWithCall: "",
        notes: "",
        createdAt: getLocalDateTime(),
        contactId: contactId || "",
        accountId: "",
        dealId: "",
      });
      fetchCallLogs();
    } catch (err) {
      console.error("CallLog save error:", err);
      // show more prominent message including server response
      alert(`Failed to save call log: ${err?.message || err}`);
    }
  };

  // Edit call log
  const handleEditCallLog = (log) => {
    setEditCallLog(log);
    setCallLogForm({
      id: log.id || log.callLogId || log.CallLogId || "",
      callOwner: log.callOwner || log.CallOwner || log.name || log.Name || "",
      callType: log.callType || log.CallType || "",
      callDirection: log.callDirection || log.CallDirection || "",
      callStatus: log.callStatus || log.CallStatus || "",
      callDuration: log.callDuration || log.CallDuration || "",
      outcome: log.outcome || log.Outcome || "",
      phone: log.phone || log.Phone || "",
      associatedWithCall:
        log.associatedWithCall || log.AssociatedWithCall || "",
      notes: log.notes || log.Notes || "",
      createdAt:
        log.createdAt || log.CreatedAt
          ? formatLocalDate(log.createdAt || log.CreatedAt)
          : getLocalDateTime(),
      contactId: log.contactId || log.ContactId || contactId || "",
      accountId: log.accountId || log.AccountId || "",
      dealId: log.dealId || log.DealId || "",
    });
    setShowCallLogForm(true);
  };

  // Show delete confirmation modal
  const handleDeleteCallLog = (id) => {
    setDeleteLogId(id);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDeleteCallLog = async () => {
    setShowDeleteModal(false);
    if (!deleteLogId) return;
    try {
      const res = await apiClient.delete(
        `/CallLog/${encodeURIComponent(deleteLogId)}`,
      );
      if (!res || res.status < 200 || res.status >= 300)
        throw new Error("Failed to delete call log");
      fetchCallLogs();
    } catch {
      setCallError("Failed to delete call log");
    } finally {
      setDeleteLogId(null);
    }
  };
  // Tasks logic
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState(null);

  const [deals, setDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [dealsError, setDealsError] = useState(null);
  const lastFetchedDealsKey = useRef(null);
  const dealsRequestInFlight = useRef(false);

  const fetchDeals = useCallback(async () => {
    const currentKey = contactId ? `contact-${contactId}` : contactEmail ? `email-${contactEmail}` : null;
    if (!currentKey) return;

    // Avoid refetching if we already loaded deals for the same contact/email
    if (lastFetchedDealsKey.current === currentKey) {
      return;
    }

    if (dealsRequestInFlight.current) {
      return;
    }

    dealsRequestInFlight.current = true;
    setLoadingDeals(true);
    setDealsError(null);

    try {
      const res = await apiClient.get(`/Deal/contact/${contactId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setDeals(data);
      lastFetchedDealsKey.current = currentKey;
    } catch (err) {
      console.error("ContactEmailLogs: failed to fetch related deals", err);
      setDealsError("Failed to load related deals");
      setDeals([]);
      lastFetchedDealsKey.current = null;
    } finally {
      setLoadingDeals(false);
      dealsRequestInFlight.current = false;
    }
  }, [contactId, contactEmail]);

  // Fetch tasks for this contact
  const fetchTasks = () => {
    if (!contactName && !contactEmail && !contactId) return;
    setLoadingTasks(true);
    setTasksError(null);
    //apiClient.get(`/TaskList`)
    apiClient
      .get(`/TaskList/contact/${contactId}`)
      .then((r) => {
        const data = r.data;
        // normalize task objects (handle camelCase or PascalCase coming from backend)
        const normalize = (t) => ({
          TaskId: t.TaskId ?? t.taskId ?? t.TaskId ?? t.id ?? 0,
          Title: t.Title ?? t.title ?? "",
          Description: t.Description ?? t.description ?? "",
          TaskType: t.TaskType ?? t.taskType ?? "",
          DueDate: t.DueDate ?? t.dueDate ?? "",
          Outcome: t.Outcome ?? t.outcome ?? "",
          Owner: t.Owner ?? t.owner ?? "",
          RelatedTo: t.RelatedTo ?? t.relatedTo ?? "",
          ContactId: t.ContactId ?? t.contactId ?? "",
          Collaborators: t.Collaborators ?? t.collaborators ?? "",
          ReminderDateTime: t.ReminderDateTime ?? t.reminderDateTime ?? "",
          IsReminderSent: t.IsReminderSent ?? t.isReminderSent ?? false,
          ReminderAdvanceMinutes:
            (t.ReminderAdvanceMinutes ?? t.reminderAdvanceMinutes) === 0
              ? null
              : (t.ReminderAdvanceMinutes ?? t.reminderAdvanceMinutes ?? null),
        });

        let list = Array.isArray(data) ? data.map(normalize) : [];

        // TODO: Once database migration adds ContactId column to Tasks, enable this filtering:
        // Prefer filtering by numeric contactId if available
        // if (contactId) {
        //   list = list.filter((t) => String(t.ContactId) === String(contactId));
        // } else if (contactName) {
        //   const n = contactName.toLowerCase();
        //   list = list.filter((t) => (t.Owner || "").toLowerCase() === n || (t.RelatedTo || "").toLowerCase() === n);
        // } else if (contactEmail) {
        //   const e = contactEmail.toLowerCase();
        //   list = list.filter((t) => (t.Owner || "").toLowerCase() === e || (t.RelatedTo || "").toLowerCase() === e);
        // }

        // For now, show all tasks (ContactId not yet in database)
        // Once migration is applied, uncomment filtering above and remove this comment

        setTasks(list);
        // Expose tasks globally for client-side reminder system
        try {
          window.allTasks = list;
        } catch (_) { }
      })
      .catch((err) => {
        // Silently handle errors - tasks may not be available or endpoint may not exist
        setTasksError("Failed to fetch tasks");
      })
      .finally(() => setLoadingTasks(false));
  };

  useEffect(() => {
    if (activeTab === "tasks") fetchTasks();
    // eslint-disable-next-line
  }, [activeTab, contactName, contactEmail]);

  useEffect(() => {
    if (activeTab === "deals") fetchDeals();
  }, [activeTab, fetchDeals]);

  useEffect(() => {
    const handleDealAdded = () => {
      if (activeTab === "deals") fetchDeals();
    };
    window.addEventListener("dealAdded", handleDealAdded);
    return () => window.removeEventListener("dealAdded", handleDealAdded);
  }, [activeTab, fetchDeals]);

  // Task form/modal logic
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    TaskId: "",
    Title: "",
    Description: "",
    Status: "",
    TaskType: "",
    DueDate: getLocalDateTime(),
    CompletedDate: "",
    Outcome: "",
    OwnerId: "",
    Owner: contactName || "",
    ContactId: contactId || "",
    CreatedById: "",
    UpdatedById: "",
    CreatedAt: "",
    UpdatedAt: "",
  });

  // Create or update task
  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    const url = editTask
      ? `/TaskList/${encodeURIComponent(taskForm.TaskId)}`
      : `/TaskList`;
    // Prepare payload with ALL backend fields properly mapped
    const contactIdNumber = Number.isFinite(
      Number(contactId || taskForm.ContactId),
    )
      ? Number(contactId || taskForm.ContactId)
      : null;
    const ownerIdNumber = Number(taskForm.OwnerId) || null;
    const createdByIdNumber = Number(taskForm.CreatedById) || null;
    const updatedByIdNumber = Number(taskForm.UpdatedById) || null;

    const payload = {
      id: editTask ? taskForm.TaskId : undefined,
      title: taskForm.Title || "",
      description: taskForm.Description || "",
      status: taskForm.Status || "",
      taskType: taskForm.TaskType || "",
      dueDate: taskForm.DueDate ? taskForm.DueDate.split("T")[0] : null,
      completedDate: taskForm.CompletedDate
        ? taskForm.CompletedDate.split("T")[0]
        : null,
      outcome: taskForm.Outcome || "",
      ownerId: Number.isFinite(ownerIdNumber) ? ownerIdNumber : null,
      contactId: contactIdNumber,
      createdById: Number.isFinite(createdByIdNumber)
        ? createdByIdNumber
        : null,
      updatedById: Number.isFinite(updatedByIdNumber)
        ? updatedByIdNumber
        : null,
      createdAt: taskForm.CreatedAt
        ? dateTimeToISO(taskForm.CreatedAt)
        : new Date().toISOString(),
      updatedAt: taskForm.UpdatedAt
        ? dateTimeToISO(taskForm.UpdatedAt)
        : new Date().toISOString(),
    };

    // Remove id for POST so backend assigns identity
    if (!editTask) delete payload.id;

    console.log("Submitting task payload:", payload);
    try {
      const res = await (editTask
        ? apiClient.put(url.replace(/^\//, ""), payload)
        : apiClient.post(url.replace(/^\//, ""), payload));
      if (!res || res.status < 200 || res.status >= 300)
        throw new Error("Failed to save task");
      setShowTaskForm(false);
      setEditTask(null);
      setTaskForm({
        TaskId: "",
        Title: "",
        Description: "",
        Status: "",
        TaskType: "",
        DueDate: getLocalDateTime(),
        CompletedDate: "",
        Outcome: "",
        OwnerId: "",
        Owner: contactName || "",
        ContactId: contactId || "",
        CreatedById: "",
        UpdatedById: "",
        CreatedAt: "",
        UpdatedAt: "",
      });
      fetchTasks();
    } catch {
      alert("Failed to save task");
    }
  };

  // Edit task
  const handleEditTask = (task) => {
    setEditTask(task);
    setTaskForm({
      TaskId: task.TaskId ?? task.taskId ?? task.id ?? "",
      Title: task.Title ?? task.title ?? "",
      Description: task.Description ?? task.description ?? "",
      Status: task.Status ?? task.status ?? "",
      TaskType: task.TaskType ?? task.taskType ?? "",
      DueDate:
        (task.DueDate ?? task.dueDate)
          ? formatLocalDate(task.DueDate ?? task.dueDate)
          : getLocalDateTime(),
      CompletedDate:
        (task.CompletedDate ?? task.completedDate)
          ? formatLocalDate(task.CompletedDate ?? task.completedDate)
          : "",
      Outcome: task.Outcome ?? task.outcome ?? "",
      OwnerId: task.OwnerId ?? task.ownerId ?? "",
      Owner: task.Owner ?? task.owner ?? "",
      ContactId: task.ContactId ?? task.contactId ?? contactId ?? "",
      CreatedById: task.CreatedById ?? task.createdById ?? "",
      UpdatedById: task.UpdatedById ?? task.updatedById ?? "",
      CreatedAt:
        (task.CreatedAt ?? task.createdAt)
          ? formatLocalDate(task.CreatedAt ?? task.createdAt)
          : "",
      UpdatedAt:
        (task.UpdatedAt ?? task.updatedAt)
          ? formatLocalDate(task.UpdatedAt ?? task.updatedAt)
          : "",
    });
    setShowTaskForm(true);
  };

  // Show delete confirmation modal for task
  const handleDeleteTask = (id) => {
    setDeleteTaskId(id);
    setShowDeleteTaskModal(true);
  };

  // Confirm delete task
  const confirmDeleteTask = async () => {
    setShowDeleteTaskModal(false);
    if (!deleteTaskId) return;
    try {
      const res = await apiClient.delete(
        `/TaskList/${encodeURIComponent(deleteTaskId)}`,
      );
      if (!res || res.status < 200 || res.status >= 300)
        throw new Error("Failed to delete task");
      fetchTasks();
    } catch {
      setTasksError("Failed to delete task");
    } finally {
      setDeleteTaskId(null);
    }
  };

  // ====================== NOTES STATE ======================
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [noteDealSelections, setNoteDealSelections] = useState(() => new Set());
  const [noteDealOnlySelected, setNoteDealOnlySelected] = useState(false);
  const [noteDestinationError, setNoteDestinationError] = useState("");
  const [showDealDropdown, setShowDealDropdown] = useState(false);
  const dealDropdownRef = useRef(null);

  const [deleteNoteId, setDeleteNoteId] = useState(null);
  const [showDeleteNoteModal, setShowDeleteNoteModal] = useState(false);

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString();
  };

  const [noteForm, setNoteForm] = useState({
    NoteId: "",
    Description: "",
  });

  const noteEligibleDeals = useMemo(() => {
    if (!Array.isArray(deals)) return [];
    return deals.map((deal) => {
      const id = deal.dealId ?? deal.id ?? deal.DealId ?? deal.Id ?? "";
      const name = deal.name ?? deal.DealName ?? deal.dealName ?? String(id);
      return { id, name };
    });
  }, [deals]);

  const selectedDealsText = (() => {
    if (noteDealOnlySelected && noteDealSelections.size === 0) {
      return "This Contact Only";
    }
    const selectedNames = noteEligibleDeals
      .filter((deal) => noteDealSelections.has(deal.id))
      .map((deal) => deal.name);
    if (selectedNames.length === 0) {
      return "Select Destination";
    }
    if (selectedNames.length <= 2) {
      return selectedNames.join(", ");
    }
    return `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2} more`;
  })();

  function toggleNoteDeal(dealId) {
    setNoteDealSelections((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);

      if (next.size > 0) {
        setNoteDealOnlySelected(true);
      }
      return next;
    });
    setNoteDestinationError("");
  }

  function toggleNoteDealOnly() {
    if (noteDealSelections.size > 0) return;
    setNoteDealOnlySelected((v) => !v);
    setNoteDestinationError("");
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dealDropdownRef.current && !dealDropdownRef.current.contains(event.target)) {
        setShowDealDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setNoteDealSelections(new Set());
    setNoteDealOnlySelected(false);
    setNoteDestinationError("");
    setShowDealDropdown(false);
  }, [showNoteForm, contactId]);

  // ====================== FETCH NOTES ======================
  const fetchNotes = useCallback(async () => {
    if (!contactId) {
      console.warn("No contactId, skipping fetch");
      return;
    }

    setLoadingNotes(true);
    setNotesError(null);

    try {
      const res = await apiClient.get(`/Notes/contact/${contactId}`);

      if (!res || res.status < 200 || res.status >= 300) {
        throw new Error("Failed to fetch notes");
      }

      const normalized = Array.isArray(res.data)
        ? res.data.map((note) => ({
          NoteId: note.Id ?? note.id ?? note.noteId ?? "",
          Description: note.Description ?? note.description ?? "",
          CreatedAt: note.CreatedAt ?? note.createdAt ?? null,
          UpdatedAt: note.UpdatedAt ?? note.updatedAt ?? null,
        }))
        : [];

      setNotes(normalized);
    } catch (err) {
      console.error("Fetch Notes Error:", err);
      const serverMessage = err?.response?.data || err?.message;
      setNotesError(serverMessage || "Failed to fetch notes");
    } finally {
      setLoadingNotes(false);
    }
  }, [contactId]);

  // ====================== LOAD WHEN TAB OPEN ======================
  useEffect(() => {
    if (activeTab === "notes") {
      fetchNotes();
    }
  }, [activeTab, fetchNotes]);

  useEffect(() => {
    if (contactId) {
      fetchDeals();
    }
  }, [contactId, fetchDeals]);

  // ====================== ADD / UPDATE NOTE ======================
  const handleNoteSubmit = async (e) => {
    e.preventDefault();

    const url = editNote ? `/Notes/${noteForm.NoteId}` : `/Notes`;

    if (noteDealSelections.size === 0 && !noteDealOnlySelected) {
      setNoteDestinationError("Choose where this note should appear before saving.");
      return;
    }

    const payload = {
      id: editNote ? noteForm.NoteId : undefined,
      description: noteForm.Description,
      contactId: Number(contactId),
      mirrorToDealIds: Array.from(noteDealSelections),
    };

    if (!editNote) delete payload.Id;

    try {
      await (editNote
        ? apiClient.put(url, payload)
        : apiClient.post(url, payload));

      setShowNoteForm(false);
      setEditNote(null);
      setShowDealDropdown(false);
      setNoteDealSelections(new Set());
      setNoteDealOnlySelected(false);
      setNoteDestinationError("");

      setNoteForm({
        NoteId: "",
        Description: "",
      });

      await fetchNotes();
    } catch (err) {
      console.error("Save Note Error:", err);
      const serverMessage = err?.response?.data || err?.message;
      alert(serverMessage || "Failed to save note");
    }
  };

  // ====================== EDIT NOTE ======================
  const handleEditNote = (note) => {
    setEditNote(note);

    setNoteForm({
      NoteId: note.NoteId,
      Description: note.Description,
    });

    setShowNoteForm(true);
  };

  // ====================== DELETE NOTE ======================
  const handleDeleteNote = (id) => {
    setDeleteNoteId(id);
    setShowDeleteNoteModal(true);
  };

  const confirmDeleteNote = async () => {
    if (!deleteNoteId) return;

    try {
      const res = await apiClient.delete(`/Notes/${deleteNoteId}`);

      if (!res || res.status < 200 || res.status >= 300) {
        throw new Error("Delete failed");
      }

      await fetchNotes();
    } catch (err) {
      console.error(err);
      setNotesError("Failed to delete note");
    } finally {
      setDeleteNoteId(null);
      setShowDeleteNoteModal(false);
    }
  };

  // ====================== MEETINGS (Microsoft Teams / Graph API) ======================
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingError, setMeetingError] = useState(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const [deleteMeetingId, setDeleteMeetingId] = useState(null);
  const [showDeleteMeetingModal, setShowDeleteMeetingModal] = useState(false);

  const blankMeetingForm = useCallback(() => {
    const now = new Date();
    const later = new Date(now.getTime() + 3600000);
    const fmt = (d) => {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${y}-${mo}-${da}T${h}:${mi}`;
    };
    return {
      MeetingId: "",
      Title: "",
      From: fmt(now),
      To: fmt(later),
      TimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      Location: "",
      Description: "",
    };
  }, []);

  const [meetingForm, setMeetingForm] = useState(blankMeetingForm);

  // Fetch meetings for this contact from Teams/Graph Calendar
  const fetchMeetings = useCallback(async () => {
    if (!calendarToken) return;
    const emailToFilter =
      contactEmail || (contactEmails && contactEmails[0]) || "";
    if (!emailToFilter) {
      setMeetings([]);
      return;
    }

    setLoadingMeetings(true);
    setMeetingError(null);
    try {
      const selectFields =
        "id,subject,start,end,location,bodyPreview,body,attendees,isOnlineMeeting,onlineMeeting,organizer";
      const emailLower = emailToFilter.toLowerCase();

      // Graph API's attendees/any() lambda filter is not supported on all Exchange Online
      // tenants. Skip the filter attempt entirely — fetch the user's recent events and
      // filter client-side. This avoids the guaranteed 400 and works on every tenant.
      const resp = await window.fetch(
        `https://graph.microsoft.com/v1.0/me/events?$select=${encodeURIComponent(selectFields)}&$top=200&$orderby=${encodeURIComponent("start/dateTime desc")}`,
        { headers: { Authorization: `Bearer ${calendarToken}` } },
      );
      if (!resp.ok) throw new Error(`Graph API error ${resp.status}`);

      const data = await resp.json();
      setMeetings(
        (data.value || [])
          .filter((ev) =>
            (ev.attendees || []).some(
              (a) =>
                (a.emailAddress?.address || "").toLowerCase() === emailLower,
            ),
          )
          .map(normalizeGraphEvent)
          .sort((a, b) => new Date(b.from) - new Date(a.from)),
      );
    } catch (err) {
      console.error("fetchMeetings (Graph):", err);
      setMeetingError("Failed to load Teams meetings. " + (err?.message || ""));
    } finally {
      setLoadingMeetings(false);
    }
  }, [calendarToken, contactEmail, contactEmails]);

  useEffect(() => {
    if (activeTab === "meetings") fetchMeetings();
  }, [activeTab, fetchMeetings]);

  // Create or update meeting via Teams Graph API
  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!calendarToken) {
      alert("Please sign in to Microsoft to schedule Teams meetings.");
      return;
    }

    // Build Graph API event body
    const graphEvent = {
      subject: meetingForm.Title || "CRM Meeting",
      body: {
        contentType: "HTML",
        content: meetingForm.Description
          ? `<p>${meetingForm.Description}</p>`
          : "",
      },
      start: {
        dateTime: dateTimeToISO(meetingForm.From),
        timeZone: meetingForm.TimeZone || "UTC",
      },
      end: {
        dateTime: dateTimeToISO(meetingForm.To),
        timeZone: meetingForm.TimeZone || "UTC",
      },
      ...(meetingForm.Location
        ? { location: { displayName: meetingForm.Location } }
        : {}),
      attendees: contactEmail
        ? [
          {
            emailAddress: {
              address: contactEmail,
              name: contactName || contactEmail,
            },
            type: "required",
          },
        ]
        : [],
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    };

    const graphUrl = editMeeting
      ? `https://graph.microsoft.com/v1.0/me/events/${editMeeting.id || editMeeting.MeetingId}`
      : "https://graph.microsoft.com/v1.0/me/events";
    const method = editMeeting ? "PATCH" : "POST";

    try {
      const resp = await window.fetch(graphUrl, {
        method,
        headers: {
          Authorization: `Bearer ${calendarToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(graphEvent),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Graph API error ${resp.status}: ${errText}`);
      }

      setShowMeetingForm(false);
      setEditMeeting(null);
      setMeetingForm(blankMeetingForm());
      fetchMeetings();
      window.dispatchEvent(new CustomEvent("meetingUpdated"));
    } catch (err) {
      console.error("Meeting save error:", err);
      alert(`Failed to save meeting: ${err?.message || err}`);
    }
  };

  // Pre-fill form when editing
  const handleEditMeeting = (meeting) => {
    setEditMeeting(meeting);
    setMeetingForm({
      MeetingId: meeting.id || meeting.MeetingId || "",
      Title: meeting.title || "",
      From: meeting.from ? formatLocalDate(meeting.from) : getLocalDateTime(),
      To: meeting.to ? formatLocalDate(meeting.to) : blankMeetingForm().To,
      TimeZone:
        meeting.timeZone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "UTC",
      Location: meeting.location || "",
      Description: meeting.description || "",
    });
    setShowMeetingForm(true);
  };

  // Trigger delete confirmation
  const handleDeleteMeeting = (meeting) => {
    setDeleteMeetingId(meeting.id || meeting.MeetingId || meeting.meetingId);
    setShowDeleteMeetingModal(true);
  };

  // Execute delete via Graph API
  const confirmDeleteMeeting = async () => {
    setShowDeleteMeetingModal(false);
    if (!deleteMeetingId || !calendarToken) return;
    try {
      const resp = await window.fetch(
        `https://graph.microsoft.com/v1.0/me/events/${deleteMeetingId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${calendarToken}` },
        },
      );
      // 204 No Content = success; 404 = already gone — both are OK
      if (!resp.ok && resp.status !== 204 && resp.status !== 404) {
        throw new Error(`Graph API error ${resp.status}`);
      }
      fetchMeetings();
      window.dispatchEvent(new CustomEvent("meetingUpdated"));
    } catch (err) {
      setMeetingError("Failed to delete meeting: " + (err?.message || ""));
    } finally {
      setDeleteMeetingId(null);
    }
  };

  const isSentEmail = (mail) => mail.sentDateTime && !mail.receivedDateTime;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-5xl bg-white flex flex-col z-50 shadow-2xl text-sm">
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[11000] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 11000 }}
        >
          <div className="bg-white w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                Confirm Deletion
              </h4>
              <p className="text-gray-600">
                Are you sure you want to delete this call log?
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCallLog}
                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700
                 hover:to-red-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-white to-blue-100 shadow-sm">
        {/* Left Section */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0 space-y-2">
            {/* Contact Name */}
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {contactName?.trim() || contactEmail || "Contact Details"}
            </h3>

            {/* Account Name */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 rounded-full">
                Account
              </span>

              <h2 className="text-sm text-gray-600 truncate">
                {accountName || "Not Assigned"}
              </h2>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />

              <p className="text-xs text-gray-500 truncate">
                {contactEmail || "Not Assigned"}
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white transition-all duration-200 shadow-sm"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
        </button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto scrollbar-none">
        <button
          className={`px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === "email"
            ? "border-blue-600 text-blue-700 bg-blue-50/50"
            : "border-transparent text-gray-500 hover:text-blue-600 hover:bg-gray-50"
            }`}
          onClick={() => setActiveTab("email")}
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Logs
          </div>
        </button>
        <button
          className={`px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === "call"
            ? "border-green-600 text-green-700 bg-green-50/50"
            : "border-transparent text-gray-500 hover:text-green-600 hover:bg-gray-50"
            }`}
          onClick={() => setActiveTab("call")}
        >
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4" />
            Call Logs
          </div>
        </button>
        <button
          className={`px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === "notes"
            ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
            : "border-transparent text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
            }`}
          onClick={() => setActiveTab("notes")}
        >
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Notes
          </div>
        </button>
        <button
          className={`px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === "meetings"
            ? "border-purple-600 text-purple-700 bg-purple-50/50"
            : "border-transparent text-gray-500 hover:text-purple-600 hover:bg-gray-50"
            }`}
          onClick={() => setActiveTab("meetings")}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Meetings
          </div>
        </button>
        <button
          className={`px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === "tasks"
            ? "border-yellow-600 text-yellow-700 bg-yellow-50/50"
            : "border-transparent text-gray-500 hover:text-yellow-600 hover:bg-gray-50"
            }`}
          onClick={() => setActiveTab("tasks")}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Tasks
          </div>
        </button>
        <button
          className={`px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === "deals"
            ? "border-pink-600 text-pink-700 bg-pink-50/50"
            : "border-transparent text-gray-500 hover:text-pink-600 hover:bg-gray-50"
            }`}
          onClick={() => setActiveTab("deals")}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Deals
          </div>
        </button>
      </div>
      {/* Tab Content */}

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {activeTab === "meetings" ? (
          <div className="min-h-full">
            {/* Delete Meeting Modal */}
            {showDeleteMeetingModal && (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[11000] animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                style={{ zIndex: 11000 }}
              >
                <div className="bg-white w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
                  <div className="mb-6 text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">
                      Confirm Deletion
                    </h4>
                    <p className="text-gray-600">
                      Are you sure you want to delete this meeting?
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteMeetingModal(false)}
                      className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteMeeting}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Sign-in gate ── */}
            {!isOutlookLoggedIn ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 gap-4">
                <div className="p-4 bg-[#6264A7]/10 rounded-full">
                  <Video className="w-10 h-10 text-[#6264A7]" />
                </div>
                <p className="text-base font-semibold text-gray-800">
                  Sign in to Microsoft Teams
                </p>
                <p className="text-sm text-gray-500 text-center max-w-xs">
                  Connect your Microsoft account to schedule and view Teams
                  meetings for this contact.
                </p>
                <button
                  onClick={handleOutlookLogin}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#6264A7] hover:bg-[#4f518a] text-white rounded-lg font-semibold text-sm shadow-md transition-colors"
                >
                  <Video className="w-4 h-4" /> Sign in to Microsoft
                </button>
              </div>
            ) : (
              <>
                {/* Add Meeting Button */}
                <div className="flex items-center justify-between px-6 pt-4 pb-3 bg-white border-b border-gray-200">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#6264A7]/10 rounded-full">
                    <Video className="w-3.5 h-3.5 text-[#6264A7]" />
                    <span className="text-xs font-semibold text-[#6264A7]">
                      Microsoft Teams Calendar
                    </span>
                  </div>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6264A7] to-purple-700 hover:from-[#4f518a] hover:to-purple-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm font-semibold"
                    onClick={() => {
                      setShowMeetingForm(true);
                      setEditMeeting(null);
                      setMeetingForm(blankMeetingForm());
                    }}
                  >
                    <Plus className="w-4 h-4" /> New Teams Meeting
                  </button>
                </div>

                {/* Meeting Form Slide-in */}
                {showMeetingForm && (
                  <div className="fixed inset-0 z-50 flex h-full justify-end bg-black/30 backdrop-blur-sm">
                    <div className="bg-white shadow-2xl w-full sm:max-w-md h-full flex flex-col animate-in slide-in-from-right duration-200">
                      <div className="bg-gradient-to-r from-[#6264A7] to-purple-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg">
                            <Video className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">
                              {editMeeting ? "Edit Teams Meeting" : "New Teams Meeting"}
                            </h3>
                            <p className="text-white/70 text-xs">Saves directly to Microsoft Teams Calendar</p>
                          </div>
                        </div>
                        <button type="button" className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" onClick={() => { setShowMeetingForm(false); setEditMeeting(null); }}>
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                      <form
                        onSubmit={handleMeetingSubmit}
                        className="p-6 space-y-4 overflow-y-auto flex-1"
                      >
                        {/* Attendee chip */}
                        {contactEmail && (
                          <div className="flex items-center gap-2 p-3 bg-[#6264A7]/10 rounded-xl border border-[#6264A7]/20">
                            <Users className="w-4 h-4 text-[#6264A7] flex-shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-[#6264A7]">
                                Attendee (auto-added)
                              </p>
                              <p className="text-xs text-gray-600">
                                {contactName ? `${contactName} — ` : ""}
                                {contactEmail}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-500" />
                            Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all"
                            value={meetingForm.Title}
                            onChange={(e) =>
                              setMeetingForm((f) => ({
                                ...f,
                                Title: e.target.value,
                              }))
                            }
                            placeholder="Meeting title"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-purple-500" />{" "}
                              Start <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="datetime-local"
                              required
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                              value={meetingForm.From}
                              onChange={(e) =>
                                setMeetingForm((f) => ({
                                  ...f,
                                  From: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-purple-500" />{" "}
                              End <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="datetime-local"
                              required
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                              value={meetingForm.To}
                              onChange={(e) =>
                                setMeetingForm((f) => ({
                                  ...f,
                                  To: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-500" />{" "}
                            Time Zone
                          </label>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                            value={meetingForm.TimeZone}
                            onChange={(e) =>
                              setMeetingForm((f) => ({
                                ...f,
                                TimeZone: e.target.value,
                              }))
                            }
                          >
                            <option value="UTC">UTC</option>
                            <option value="India Standard Time">
                              IST — India Standard Time
                            </option>
                            <option value="Eastern Standard Time">
                              EST — Eastern Standard Time
                            </option>
                            <option value="Central Standard Time">
                              CST — Central Standard Time
                            </option>
                            <option value="Mountain Standard Time">
                              MST — Mountain Standard Time
                            </option>
                            <option value="Pacific Standard Time">
                              PST — Pacific Standard Time
                            </option>
                            <option value="GMT Standard Time">
                              GMT — London
                            </option>
                            <option value="W. Europe Standard Time">
                              CET — Central Europe
                            </option>
                            <option value="Tokyo Standard Time">
                              JST — Japan Standard Time
                            </option>
                            <option value="AUS Eastern Standard Time">
                              AEST — Australia Eastern
                            </option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-purple-500" />{" "}
                            Location
                          </label>
                          <input
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                            value={meetingForm.Location}
                            onChange={(e) =>
                              setMeetingForm((f) => ({
                                ...f,
                                Location: e.target.value,
                              }))
                            }
                            placeholder="Physical location (optional)"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-purple-500" />{" "}
                            Description
                          </label>
                          <textarea
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none resize-none"
                            value={meetingForm.Description}
                            onChange={(e) =>
                              setMeetingForm((f) => ({
                                ...f,
                                Description: e.target.value,
                              }))
                            }
                            placeholder="Meeting agenda or description"
                          />
                        </div>

                        {/* Teams badge */}
                        <div className="flex items-center gap-2 p-3 bg-[#6264A7]/10 rounded-xl border border-[#6264A7]/20 text-xs text-[#6264A7]">
                          <Video className="w-4 h-4 flex-shrink-0" />
                          <span>
                            A <strong>Teams meeting link</strong> will be
                            generated automatically and sent to the attendee.
                          </span>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                            onClick={() => {
                              setShowMeetingForm(false);
                              setEditMeeting(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#6264A7] to-purple-700 hover:opacity-90 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
                          >
                            {editMeeting
                              ? "Update Meeting"
                              : "Create Teams Meeting"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Loading / Error / Empty */}
                {loadingMeetings && (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6264A7]" />
                      <p className="text-gray-500 text-sm">
                        Loading Teams meetings…
                      </p>
                    </div>
                  </div>
                )}
                {meetingError && (
                  <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <span className="text-red-500 mt-0.5">⚠</span>
                    <p className="text-red-700 text-sm">{meetingError}</p>
                  </div>
                )}
                {!loadingMeetings && !meetingError && meetings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
                    <div className="p-4 bg-[#6264A7]/10 rounded-full">
                      <Calendar className="w-8 h-8 text-[#6264A7]" />
                    </div>
                    <p className="text-gray-600 font-medium">
                      No Teams meetings found
                    </p>
                    <p className="text-gray-400 text-xs text-center">
                      Meetings where {contactEmail || "this contact"} is an
                      attendee will appear here.
                    </p>
                  </div>
                )}

                {/* Meetings List */}
                {!loadingMeetings && meetings.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {meetings.map((meeting, index) => {
                      const joinUrl = meeting.teamsJoinUrl || "";
                      const isPast =
                        meeting.from && new Date(meeting.from) < new Date();
                      return (
                        <div
                          key={meeting.id || meeting.MeetingId || index}
                          className="bg-white hover:bg-purple-50/20 transition-all duration-200 border-l-4 border-transparent hover:border-[#6264A7]"
                        >
                          <div className="px-6 py-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">
                                    {meeting.title}
                                  </h3>
                                  {meeting.isOnlineMeeting && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#6264A7]/10 text-[#6264A7] rounded-full text-[10px] font-semibold flex-shrink-0">
                                      <Video className="w-2.5 h-2.5" /> Teams
                                    </span>
                                  )}
                                  {isPast && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-[10px] font-medium flex-shrink-0">
                                      Past
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                                    {new Date(meeting.from).toLocaleString([], {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                    {meeting.to && (
                                      <>
                                        {" "}
                                        –{" "}
                                        {new Date(
                                          meeting.to,
                                        ).toLocaleTimeString([], {
                                          timeStyle: "short",
                                        })}
                                      </>
                                    )}
                                  </span>
                                  {meeting.location &&
                                    !meeting.location.startsWith(
                                      "https://",
                                    ) && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-purple-400" />
                                        {meeting.location}
                                      </span>
                                    )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {joinUrl && (
                                  <a
                                    href={joinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6264A7] hover:bg-[#4f518a] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                                  >
                                    <Video className="w-3.5 h-3.5" /> Join
                                  </a>
                                )}
                                <button
                                  onClick={() => handleEditMeeting(meeting)}
                                  className="p-1.5 hover:bg-purple-100 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4 text-purple-500" />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteMeeting(meeting)}
                                    className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {meeting.description && (
                              <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-2">
                                {meeting.description}
                              </p>
                            )}
                            {meeting.attendees && (
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                                <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                <span className="truncate">
                                  {meeting.attendees}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "tasks" ? (
          <div className="flex-1 overflow-y-auto min-h-full">
            {/* Delete Task Modal */}
            {showDeleteTaskModal && (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[11000] animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                style={{ zIndex: 11000 }}
              >
                <div className="bg-white w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
                  <div className="mb-6 text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-yellow-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">
                      Confirm Deletion
                    </h4>
                    <p className="text-gray-600">
                      Are you sure you want to delete this task?
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteTaskModal(false)}
                      className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteTask}
                      className="px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end px-6 pt-4 pb-2 bg-white border-b border-gray-200">
              <button
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={() => {
                  setShowTaskForm(true);
                  setEditTask(null);
                  setTaskForm({
                    TaskId: "",
                    Title: "",
                    Description: "",
                    TaskType: "",
                    DueDate: getLocalDateTime(),
                    Outcome: "",
                    Owner: contactName || "",
                    RelatedTo: "",
                    ContactId: "",
                    Collaborators: "",
                    ReminderDateTime: "",
                    IsReminderSent: false,
                    ReminderAdvanceMinutes: null,
                    ReminderAdvanceMinutesCustom: "",
                  });
                }}
              >
                <Plus className="w-4 h-4" /> New Task
              </button>
            </div>
            {/* Task Form Modal */}
            {showTaskForm && (
              <div className="fixed inset-0 z-50 flex h-full justify-end bg-black/30 backdrop-blur-sm">
                <div className="bg-white shadow-2xl w-full sm:max-w-lg h-full flex flex-col">
                  {/* Form Header */}
                  <div className="sticky top-0 z-100 bg-gradient-to-r from-yellow-600 to-yellow-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-white">{editTask ? "Edit Task" : "New Task"}</h3>
                    </div>
                    <button type="button" className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" onClick={() => { setShowTaskForm(false); setEditTask(null); }}>
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  {/* Form Body */}
                  <form
                    onSubmit={handleTaskSubmit}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                      <div className="space-y-2 ">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-yellow-600" />
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                          required
                          value={taskForm.Title}
                          onChange={(e) =>
                            setTaskForm((f) => ({ ...f, Title: e.target.value }))
                          }
                          placeholder="Task title"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-yellow-600" />
                          Description
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all resize-none"
                          rows="3"
                          value={taskForm.Description}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              Description: e.target.value,
                            }))
                          }
                          placeholder="Task description"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-yellow-600" />
                          Task Type
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                          value={taskForm.TaskType}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              TaskType: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select task type</option>
                          <option value="followup">Follow up</option>
                          <option value="Call reminder">Call reminder</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-yellow-600" />
                          Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                          required
                          value={taskForm.Status}
                          onChange={(e) =>
                            setTaskForm((f) => ({ ...f, Status: e.target.value }))
                          }
                        >
                          <option value="">Select status</option>
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          Due Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                          required
                          value={taskForm.DueDate}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              DueDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-yellow-600" />
                          Outcome
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                          value={taskForm.Outcome}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              Outcome: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select outcome</option>
                          <option value="Success">Success</option>
                          <option value="Pending">Pending</option>
                          <option value="Failed">Failed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-yellow-600" />
                          Owner ID
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                          value={taskForm.OwnerId}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              OwnerId: e.target.value,
                            }))
                          }
                          placeholder="Owner ID"
                        />
                      </div>
                      {taskForm.Status === "Completed" && (
                        <div className="space-y-2">
                          <label className="text-sm text-gray-700 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-yellow-600" />
                            Completed Date
                          </label>
                          <input
                            type="datetime-local"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                            value={taskForm.CompletedDate}
                            onChange={(e) =>
                              setTaskForm((f) => ({
                                ...f,
                                CompletedDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex gap-3 p-6 border-t border-gray-200 bg-white">
                      <button
                        type="button"
                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setShowTaskForm(false);
                          setEditTask(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                      >
                        {editTask ? "Update Task" : "Create Task"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {loadingTasks && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-600"></div>
                  <p className="text-gray-600">Loading tasks…</p>
                </div>
              </div>
            )}
            {tasksError && (
              <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <div className="text-yellow-600 mt-0.5">⚠</div>
                <div className="text-yellow-800">{tasksError}</div>
              </div>
            )}
            {!loadingTasks && tasks.length === 0 && !tasksError && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="p-4 bg-gray-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600">
                  No tasks found for this contact.
                </p>
              </div>
            )}
            {/* Task List */}
            <div className="divide-y divide-gray-200">
              {tasks.map((task, index) => (
                <div
                  key={task.TaskId || task.taskId || index}
                  className="bg-white hover:bg-yellow-50/30 transition-all duration-200 border-l-4 border-transparent hover:border-yellow-500"
                >
                  <div className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-100 to-yellow-200 flex-shrink-0">
                          <FileText className="w-4 h-4 text-yellow-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900 font-semibold">
                            {task.Title}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {task.DueDate
                                ? new Date(task.DueDate).toLocaleString()
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          className="p-2 rounded-lg hover:bg-blue-100 transition-colors group"
                          title="Edit"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                        </button>
                        {isAdmin && (
                          <button
                            className="p-2 rounded-lg hover:bg-red-100 transition-colors group"
                            title="Delete"
                            onClick={() => handleDeleteTask(task.TaskId)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="ml-11 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-gray-600">Type:</span>
                        <span className="text-sm px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                          {task.TaskType || "-"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Outcome:</span>{" "}
                        {task.Outcome || "-"}
                      </div>
                      {task.ReminderDateTime && (
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Reminder:</span>{" "}
                            {new Date(task.ReminderDateTime).toLocaleString()}
                          </div>
                          {task.ReminderAdvanceMinutes &&
                            task.ReminderAdvanceMinutes !== 0 ? (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium">
                              {task.ReminderAdvanceMinutes} mins before
                            </span>
                          ) : activeTab === "notes" ? (
                            <div className="p-6">
                              <div className="flex justify-end px-6 pt-4 pb-2 bg-white border-b border-gray-200">
                                <button
                                  onClick={() => {
                                    setShowNoteForm(true);
                                    setEditNote(null);
                                    setNoteForm({
                                      NoteId: "",
                                      Description: "",
                                    });
                                  }}
                                  className="flex items-center gap-2 px-4 py-2.5 
                                    bg-gradient-to-r from-indigo-600 to-indigo-700 
                                    hover:from-indigo-700 hover:to-indigo-800 
                                    text-white rounded-lg shadow-md hover:shadow-lg 
                                    transition-all duration-200 transform hover:scale-105"
                                >
                                  <Plus className="w-4 h-4" />
                                  New Note
                                </button>
                              </div>

                              {loadingNotes && <p>Loading...</p>}
                              {notesError && (
                                <p className="text-red-500">{notesError}</p>
                              )}

                              {!loadingNotes && notes.length === 0 && (
                                <p className="text-gray-500">No notes found</p>
                              )}

                              {notes.map((note) => (
                                <div
                                  key={note.NoteId}
                                  className="bg-white p-4 mb-3 rounded shadow"
                                >
                                  <p className="text-gray-600">
                                    {note.Description}
                                  </p>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Created: {formatDate(note.CreatedAt)}
                                  </div>

                                  {note.UpdatedAt && (
                                    <div className="text-xs text-gray-400">
                                      Updated: {formatDate(note.UpdatedAt)}
                                    </div>
                                  )}

                                  <div className="flex gap-3 mt-2">
                                    <button
                                      onClick={() => handleEditNote(note)}
                                    >
                                      Edit
                                    </button>
                                    {isAdmin && (
                                      <button
                                        onClick={() =>
                                          handleDeleteNote(note.NoteId)
                                        }
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                      {task.Description && (
                        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <span className="font-medium">Description:</span>{" "}
                          {task.Description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Footer - Task Count */}
            {!loadingTasks && tasks.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-200 bg-white">
                <p className="text-xs text-gray-600 text-center">
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"} found
                </p>
              </div>
            )}
          </div>
        ) : activeTab === "email" ? (
          // EMAIL LOGS
          <div className="flex-1 overflow-y-auto bg-white">
            {!isOutlookLoggedIn ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="p-4 bg-blue-50 rounded-full mb-4">
                  <Mail className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  You are not signed in to Microsoft Outlook
                </h3>
                <p className="text-sm text-gray-600 max-w-md mb-6">
                  Email logs are loaded from your Microsoft mailbox. Sign in
                  with your work account to view conversations with this
                  contact.
                </p>
                <button
                  type="button"
                  onClick={handleOutlookLogin}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors"
                >
                  Sign in with Microsoft
                </button>
              </div>
            ) : (
              <>
                {!loadingEmails && !emailError && (
                  <div className="px-6 py-3 border-b border-gray-200 bg-blue-50">
                    <p className="text-sm text-blue-900 font-medium">
                      Latest emails loaded: {totalConversationEmails}
                    </p>
                  </div>
                )}
                {loadingEmails && (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                      <p className="text-gray-600">Loading emails…</p>
                    </div>
                  </div>
                )}
                {emailError && (
                  <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <div className="text-red-600 mt-0.5">⚠</div>
                    <div className="text-red-800">{emailError}</div>
                  </div>
                )}
                {!loadingEmails && emails.length === 0 && !emailError && (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                      <Inbox className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600">
                      No emails found with this contact.
                    </p>
                  </div>
                )}
                {/* Email List */}
                <div className="divide-y divide-gray-200">
                  {emails.map((mail, index) => {
                    const isOpen = openEmail === mail.id;
                    const previewTime = new Date(
                      mail.receivedDateTime || mail.sentDateTime,
                    ).toLocaleString();
                    const isSent = isSentEmail(mail);
                    return (
                      <div
                        key={mail.id || index}
                        className={`transition-all duration-200 ${isOpen ? "bg-blue-50/50" : "bg-white hover:bg-gray-50"
                          }`}
                      >
                        <div
                          onClick={() => setOpenEmail(isOpen ? null : mail.id)}
                          className="px-6 py-4 cursor-pointer"
                        >
                          {/* Email Header */}
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex-shrink-0">
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* From & Time */}
                              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`p-1.5 rounded ${isSent ? "bg-green-100" : "bg-blue-100"
                                      } flex-shrink-0`}
                                  >
                                    {isSent ? (
                                      <Send className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Inbox className="w-3.5 h-3.5 text-blue-600" />
                                    )}
                                  </div>
                                  <span className="text-gray-900 truncate">
                                    {mail.from?.emailAddress?.name
                                      ? `${mail.from.emailAddress.name} <${mail.from.emailAddress.address}>`
                                      : mail.from?.emailAddress?.address}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{previewTime}</span>
                                </div>
                              </div>
                              {/* Recipients Preview */}
                              <div className="mb-2 text-xs text-gray-500 flex flex-col gap-0.5">
                                <div className="flex items-start gap-1">
                                  <span className="font-medium text-gray-400">
                                    To:
                                  </span>
                                  <span className="truncate">
                                    {mail.toRecipients
                                      ?.map((r) =>
                                        r.emailAddress.name
                                          ? `${r.emailAddress.name} <${r.emailAddress.address}>`
                                          : r.emailAddress.address,
                                      )
                                      .join(", ") || "None"}
                                  </span>
                                </div>
                                {mail.ccRecipients &&
                                  mail.ccRecipients.length > 0 && (
                                    <div className="flex items-start gap-1">
                                      <span className="font-medium text-gray-400">
                                        Cc:
                                      </span>
                                      <span className="truncate">
                                        {mail.ccRecipients
                                          .map((r) =>
                                            r.emailAddress.name
                                              ? `${r.emailAddress.name} <${r.emailAddress.address}>`
                                              : r.emailAddress.address,
                                          )
                                          .join(", ")}
                                      </span>
                                    </div>
                                  )}
                              </div>
                              {/* Subject */}
                              <div className="mb-1 text-gray-900 font-medium line-clamp-1">
                                {mail.subject || "(No Subject)"}
                              </div>
                              {/* Preview */}
                              <div className="text-sm text-gray-600 line-clamp-2">
                                {mail.bodyPreview}
                              </div>
                            </div>
                          </div>
                          {/* Expanded Content */}
                          {isOpen && (
                            <div className="mt-4 ml-7 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <div className="mb-4 text-sm text-gray-600 border-b border-gray-100 pb-3">
                                <div className="flex mb-1">
                                  <span className="w-12 font-medium text-gray-500">
                                    From:
                                  </span>
                                  <span className="text-gray-900">
                                    {mail.from?.emailAddress?.name
                                      ? `${mail.from.emailAddress.name} <${mail.from.emailAddress.address}>`
                                      : mail.from?.emailAddress?.address ||
                                      "Unknown"}
                                  </span>
                                </div>
                                <div className="flex mb-1">
                                  <span className="w-12 font-medium text-gray-500">
                                    To:
                                  </span>
                                  <span className="text-gray-900">
                                    {mail.toRecipients
                                      ?.map((r) =>
                                        r.emailAddress.name
                                          ? `${r.emailAddress.name} <${r.emailAddress.address}>`
                                          : r.emailAddress.address,
                                      )
                                      .join(", ") || "None"}
                                  </span>
                                </div>
                                {mail.ccRecipients &&
                                  mail.ccRecipients.length > 0 && (
                                    <div className="flex mb-1">
                                      <span className="w-12 font-medium text-gray-500">
                                        Cc:
                                      </span>
                                      <span className="text-gray-900">
                                        {mail.ccRecipients
                                          .map((r) =>
                                            r.emailAddress.name
                                              ? `${r.emailAddress.name} <${r.emailAddress.address}>`
                                              : r.emailAddress.address,
                                          )
                                          .join(", ")}
                                      </span>
                                    </div>
                                  )}
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(
                                      (mail.body?.content || "").replace(
                                        /http:/g,
                                        "https:",
                                      ),
                                    ),
                                  }}
                                  className="text-gray-700"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Footer - Email Count */}
                {!loadingEmails && emails.length > 0 && (
                  <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-600 text-center">
                      Latest emails loaded: {totalConversationEmails}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "notes" ? (
          <div className="flex-1 overflow-y-auto bg-gray-50 min-h-full">
            <div className="flex justify-end px-6 pt-4 pb-2 bg-white border-b border-gray-200">
              <button
                onClick={() => {
                  setShowNoteForm(true);
                  setEditNote(null);
                  setNoteForm({ NoteId: "", Description: "" });
                  setShowDealDropdown(false);
                  setNoteDealSelections(new Set());
                  setNoteDealOnlySelected(false);
                  setNoteDestinationError("");
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 
                  hover:from-indigo-700 hover:to-indigo-800 
                  text-white rounded-lg shadow-md hover:shadow-lg 
                  transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                New Note
              </button>
            </div>

            <div className="p-6 space-y-4">
              {loadingNotes && (
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 text-gray-600">
                  Loading notes...
                </div>
              )}

              {notesError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
                  {notesError}
                </div>
              )}

              {!loadingNotes && notes.length === 0 && !notesError && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-gray-500">
                  No notes found for this contact.
                </div>
              )}

              <div className="divide-y divide-gray-200">
                {notes.map((note) => (
                  <div
                    key={note.NoteId}
                    className="bg-white hover:bg-indigo-50/40 transition-all duration-200 border-l-4 border-transparent hover:border-indigo-500"
                  >
                    <div className="px-6 py-4">
                      {/* LEFT */}
                      <>
                        <div
                          onClick={() =>
                            setExpandedNotes((prev) => ({
                              ...prev,
                              [note.NoteId]: !prev[note.NoteId],
                            }))
                          }
                          className="cursor-pointer"
                        >
                          <p
                            className={`text-sm text-gray-800 whitespace-pre-wrap break-words transition-all duration-200 ${expandedNotes[note.NoteId] ? "" : "line-clamp-4"
                              }`}
                            style={{
                              wordBreak: "break-word",
                              overflowWrap: "break-word",
                            }}
                          >
                            {note.Description}
                          </p>

                          {note.Description?.length > 180 && (
                            <button
                              type="button"
                              className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              {expandedNotes[note.NoteId]
                                ? "Read Less"
                                : "Read More"}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">
                              {formatDate(note.CreatedAt)}
                            </span>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(note.Description);

                                setCopiedNoteId(note.NoteId);

                                setTimeout(() => {
                                  setCopiedNoteId(null);
                                }, 2000);
                              }}
                              className={`px-3 py-1 rounded-lg text-xs transition-all ${copiedNoteId === note.NoteId
                                ? "bg-green-600 text-white"
                                : "bg-green-50 text-green-700"
                                }`}
                            >
                              {copiedNoteId === note.NoteId
                                ? "✔ Copied"
                                : "Copy"}
                            </button>

                            <button
                              onClick={() => handleEditNote(note)}
                              className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs"
                            >
                              Edit
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteNote(note.NoteId)}
                                className="px-3 py-1 rounded-lg bg-red-50 text-red-600 text-xs"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    </div>
                  </div>
                ))}
              </div>

              {showNoteForm && (
                <div className="fixed inset-0 z-50 flex h-full justify-end bg-black/30 backdrop-blur-sm">
                  <div className="bg-white shadow-2xl w-full sm:max-w-lg h-full flex flex-col">
                    {/* HEADER (same as meeting) */}
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-white">{editNote ? "Edit Note" : "New Note"}</h3>
                      </div>
                      <button type="button" className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" onClick={() => { setShowNoteForm(false); setEditNote(null); setShowDealDropdown(false); setNoteDealSelections(new Set()); setNoteDealOnlySelected(false); setNoteDestinationError(""); }}>
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    {/* BODY (scrollable like meeting) */}
                    <form
                      onSubmit={handleNoteSubmit}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        <div className="space-y-2" ref={dealDropdownRef} onMouseDown={(e) => e.stopPropagation()}>
                          <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                              Show this note in
                            </p>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowDealDropdown((v) => !v)}
                                className="w-full flex items-center justify-between rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white hover:border-blue-400"
                              >
                                <span className="truncate">
                                  {selectedDealsText}
                                </span>
                                <svg
                                  className={`w-4 h-4 transition-transform ${
                                    showDealDropdown ? "rotate-180" : ""
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
                              {showDealDropdown && (
                                <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                                  {noteEligibleDeals.map((deal) => (
                                    <label
                                      key={deal.id}
                                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={noteDealSelections.has(deal.id)}
                                        onChange={() => toggleNoteDeal(deal.id)}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">
                                        {deal.name}
                                      </span>
                                    </label>
                                  ))}
                                  <div className="border-t border-gray-200 my-1" />
                                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer bg-gray-50">
                                    <input
                                      type="checkbox"
                                      checked={noteDealOnlySelected}
                                      onChange={toggleNoteDealOnly}
                                      disabled={noteDealSelections.size > 0}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm font-medium">
                                      This Contact Only
                                    </span>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm text-gray-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            Note Description{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <textarea
                            required
                            rows="6"
                            value={noteForm.Description}
                            onChange={(e) =>
                              setNoteForm((f) => ({
                                ...f,
                                Description: e.target.value,
                              }))
                            }
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 
            bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent 
            outline-none transition-all resize-none"
                            placeholder="Write your note..."
                          />
                        </div>
                        {noteDestinationError && (
                          <p className="text-xs text-red-600 pt-1">
                            {noteDestinationError}
                          </p>
                        )}
                      </div>
                      {/* ACTIONS */}
                      <div className="flex-shrink-0 flex gap-3 p-6 border-t border-gray-200 bg-white">
                        <button
                          type="button"
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setShowNoteForm(false);
                            setEditNote(null);
                            setShowDealDropdown(false);
                            setNoteDealSelections(new Set());
                            setNoteDealOnlySelected(false);
                            setNoteDestinationError("");
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                        >
                          {editNote ? "Update Note" : "Create Note"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {showDeleteNoteModal && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6">
                  <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Delete Note
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">
                      Are you sure you want to delete this note? This action
                      cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDeleteNoteModal(false)}
                        className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeleteNote}
                        className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "deals" ? (
          <div className="flex-1 overflow-y-auto bg-gray-50 min-h-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 bg-white border-b border-gray-200 gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-pink-700">
                <FileText className="w-4 h-4" />
                Related Deals
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddDeal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  New Deal
                </button>
                <div className="text-xs text-gray-500">
                  {deals.length} {deals.length === 1 ? "deal" : "deals"}
                </div>
              </div>
            </div>
            {loadingDeals && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600"></div>
                  <p className="text-gray-600">Loading related deals…</p>
                </div>
              </div>
            )}
            {dealsError && (
              <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <div className="text-red-600 mt-0.5">⚠</div>
                <div className="text-red-800">{dealsError}</div>
              </div>
            )}
            {!loadingDeals && deals.length === 0 && !dealsError && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="p-4 bg-pink-50 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-pink-600" />
                </div>
                <p className="text-gray-600">No deals found for this contact.</p>
              </div>
            )}
            <div className="grid gap-4 p-6">
              {deals.map((deal, index) => {
                const dealId = deal.dealId || deal.id || deal.Id || deal.DealId;
                const dealName = deal.dealName || deal.name || deal.Name || deal.DealName || "Unnamed deal";
                const dealAccountName = deal.accountName || deal.AccountName || deal.Account || "";
                const dealStage = deal.dealStage || deal.DealStage || "Unknown";
                const dealValue = deal.dealValue || deal.DealAmount || deal.Amount || deal.dealAmount || deal.Value;
                const formattedValue =
                  dealValue || dealValue === 0
                    ? typeof dealValue === "number" ? dealValue.toLocaleString() : String(dealValue)
                    : "-";
                return (
                  <div
                    key={dealId || `${dealName}-${index}`}
                    className="bg-white p-5 rounded-2xl border border-gray-200 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <a
                          href={`/dashboard/Deals?id=${encodeURIComponent(dealId)}`}
                          onClick={(e) => {
                            e.preventDefault();
                            try {
                              navigate(`/dashboard/Deals?id=${encodeURIComponent(dealId)}`, { state: { openDealId: dealId } });
                            } catch (err) {
                              window.location.href = `/dashboard/Deals?id=${encodeURIComponent(dealId)}`;
                            }
                            if (typeof onClose === "function") onClose();
                          }}
                          className="text-base font-semibold text-gray-900 hover:text-blue-600 truncate"
                        >
                          {dealName}
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className="px-2.5 py-1 rounded-full bg-pink-50 text-pink-700">{dealStage}</span>
                        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{formattedValue}</span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
                      <div className="flex flex-col">
                        <div>Account: {dealAccountName || "-"}</div>
                        <div className="mt-1">Contact: {deal.contactName || deal.ContactName || contactName || "-"}</div>
                      </div>
                      <div className="flex flex-col text-right">
                        <div>Created: {(deal.createdAt || deal.CreatedAt) ? new Date(deal.createdAt || deal.CreatedAt).toLocaleString() : "-"}</div>
                        <div className="mt-1">Created By: {deal.createdBy || deal.CreatedBy || deal.CreatedByName || "-"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-full">
            <div className="flex justify-end px-6 pt-4 pb-2 bg-white border-b border-gray-200 gap-3">
              <button
                className="flex hidden items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg bg-white hover:bg-gray-50 transition-all duration-200"
                onClick={() => setShowImportModal(true)}
              >
                <Plus className="w-4 h-4" /> Import Call Logs
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={() => {
                  setShowCallLogForm(true);
                  setEditCallLog(null);
                  setCallLogForm({
                    id: "",
                    name: contactName || "",
                    callType: "",
                    outcome: "",
                    associatedWithCall: "",
                    notes: "",
                    callDate: getLocalDateTime(),
                    contactId: contactId || "",
                  });
                }}
              >
                <Plus className="w-4 h-4" /> New Call Log
              </button>
            </div>
            {showImportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 bg-slate-900 px-6 py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Import Call Logs
                      </h3>
                      <p className="text-sm text-slate-300">
                        Upload an Excel file to add or update call logs.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      onClick={closeImportModal}
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <form onSubmit={handleImportUpload} className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        File
                      </label>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="block w-full text-sm text-gray-700 file:border file:border-gray-300 file:rounded-lg file:px-4 file:py-2 file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                        onChange={handleImportFileChange}
                      />
                      <p className="text-xs text-gray-500">
                        Choose an Excel or CSV file imported from the CRM call
                        log template.
                      </p>
                    </div>
                    {importError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {importError}
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={closeImportModal}
                        disabled={importLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                        disabled={importLoading}
                      >
                        {importLoading ? "Importing..." : "Upload File"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {showCallLogForm && (
              <div className="fixed inset-0 z-50 flex h-full justify-end bg-black/30 backdrop-blur-sm">
                <div className="bg-white shadow-2xl w-full sm:max-w-lg h-full flex flex-col">
                  {/* Form Header */}
                  <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <PhoneCall className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-white">{editCallLog ? "Edit Call Log" : "New Call Log"}</h3>
                    </div>
                    <button type="button" className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" onClick={() => { setShowCallLogForm(false); setEditCallLog(null); }}>
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  {/* Form Body */}
                  <form
                    onSubmit={handleCallLogSubmit}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                      {/* Call Owner */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-green-600" />
                          Call Owner
                        </label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          placeholder="Person who made the call"
                          value={callLogForm.callOwner}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              callOwner: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Call Type */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-green-600" />
                          Call Type
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          value={callLogForm.callType}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              callType: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select call type</option>
                          <option value="Sales">Sales</option>
                          <option value="Support">Support</option>
                          <option value="Follow-up">Follow-up</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Call Direction */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-green-600" />
                          Call Direction
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          value={callLogForm.callDirection}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              callDirection: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select direction</option>
                          <option value="Incoming">Incoming</option>
                          <option value="Outgoing">Outgoing</option>
                        </select>
                      </div>

                      {/* Call Status */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          Call Status
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          value={callLogForm.callStatus}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              callStatus: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select status</option>
                          <option value="Completed">Completed</option>
                          <option value="Missed">Missed</option>
                          <option value="Voicemail">Voicemail</option>
                          <option value="Busy">Busy</option>
                        </select>
                      </div>

                      {/* Call Duration */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-600" />
                          Call Duration (HH:MM)
                        </label>
                        <input
                          type="text"
                          placeholder="00:00"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          value={callLogForm.callDuration}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              callDuration: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-green-600" />
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          placeholder="(123) 456-7890"
                          value={callLogForm.phone}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              phone: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Outcome */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          Outcome
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          value={callLogForm.outcome}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              outcome: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select outcome</option>
                          <option value="Intrested">Interested</option>
                          <option value="Left message">Left message</option>
                          <option value="No response">No response</option>
                          <option value="Notintrested">Not interested</option>
                          <option value="Not able to reach">
                            Not able to reach
                          </option>
                        </select>
                      </div>

                      {/* Associated With Call */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-green-600" />
                          Associated With Call
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          value={callLogForm.associatedWithCall}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              associatedWithCall: e.target.value,
                            }))
                          }
                        >
                          <option value="Existing contact">
                            Existing contact
                          </option>
                          <option value="Existing Account">
                            Existing Account
                          </option>
                          <option value="Existing Deal">Existing Deal</option>
                        </select>
                      </div>

                      {/* Account ID */}
                      <div className="space-y-2 hidden">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-600" />
                          Account ID
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          placeholder="Account ID"
                          value={callLogForm.accountId}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              accountId: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Deal ID */}
                      <div className="space-y-2 hidden">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-600" />
                          Deal ID
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          placeholder="Deal ID"
                          value={callLogForm.dealId}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              dealId: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Created At */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-600" />
                          Date & Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          required
                          value={callLogForm.createdAt}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              createdAt: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          Notes
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none"
                          rows="4"
                          placeholder="Add any additional notes about this call..."
                          value={callLogForm.notes}
                          onChange={(e) =>
                            setCallLogForm((f) => ({
                              ...f,
                              notes: e.target.value,
                            }))
                          }
                        />
                      </div>

                    </div>
                    {/* Action Buttons */}
                    <div className="flex-shrink-0 flex gap-3 p-6 border-t border-gray-200 bg-white">
                      <button
                        type="button"
                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setShowCallLogForm(false);
                          setEditCallLog(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                      >
                        {editCallLog ? "Update Call Log" : "Create Call Log"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {loadingCalls && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
                  <p className="text-gray-600">Loading call logs…</p>
                </div>
              </div>
            )}
            {callError && (
              <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <div className="text-red-600 mt-0.5">⚠</div>
                <div className="text-red-800">{callError}</div>
              </div>
            )}
            {!loadingCalls && callLogs.length === 0 && !callError && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="p-4 bg-gray-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600">
                  No call logs found for this contact.
                </p>
              </div>
            )}
            {/* Call Log List */}
            <div className="divide-y divide-gray-200">
              {callLogs.map((log, index) => (
                <div
                  key={log.id || log.Id || index}
                  className="bg-white hover:bg-green-50/30 transition-all duration-200 border-l-4 border-transparent hover:border-green-500"
                >
                  <div className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex-shrink-0">
                          <PhoneCall className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900 font-semibold  ">
                            {log.callType}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {(() => {
                                const dateVal =
                                  log.createdAt ||
                                  log.CreatedAt ||
                                  log.callDate;
                                if (!dateVal) return "N/A";
                                const d = new Date(dateVal);
                                return isNaN(d.getTime())
                                  ? dateVal
                                  : d.toLocaleString();
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          className="p-2 rounded-lg hover:bg-blue-100 transition-colors group"
                          title="Edit"
                          onClick={() => handleEditCallLog(log)}
                        >
                          <Edit className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                        </button>
                        {isAdmin && (
                          <button
                            className="p-2 rounded-lg hover:bg-red-100 transition-colors group"
                            title="Delete"
                            onClick={() =>
                              handleDeleteCallLog(
                                log.CallLogId ||
                                log.callLogId ||
                                log.Id ||
                                log.id,
                              )
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="ml-11 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-600">Outcome:</span>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                          {log.outcome || "-"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Associated:</span>{" "}
                        {log.associatedWithCall || "-"}
                      </div>
                      {log.notes && (
                        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="font-medium">Notes:</span>{" "}
                              <span className="break-words whitespace-pre-wrap">
                                {log.notes}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(log.notes || "");

                                const callLogId =
                                  log.CallLogId ||
                                  log.callLogId ||
                                  log.Id ||
                                  log.id ||
                                  index;

                                setCopiedCallLogId(callLogId);

                                setTimeout(() => {
                                  setCopiedCallLogId(null);
                                }, 2000);
                              }}
                              className={`px-3 py-1 rounded-lg text-xs transition-all ${copiedCallLogId ===
                                (log.CallLogId ||
                                  log.callLogId ||
                                  log.Id ||
                                  log.id ||
                                  index)
                                ? "bg-green-600 text-white"
                                : "bg-green-50 text-green-700"
                                }`}
                            >
                              {copiedCallLogId ===
                                (log.CallLogId ||
                                  log.callLogId ||
                                  log.Id ||
                                  log.id ||
                                  index)
                                ? "✔ Copied"
                                : "Copy"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Footer - Call Log Count */}
            {!loadingCalls && callLogs.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-200 bg-white">
                <p className="text-xs text-gray-600 text-center">
                  {callLogs.length}{" "}
                  {callLogs.length === 1 ? "call log" : "call logs"} found
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}