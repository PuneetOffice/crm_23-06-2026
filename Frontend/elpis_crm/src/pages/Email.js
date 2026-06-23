import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  FileText,
  Search,
  Tag,
  CheckCircle2,
  ChevronDown,
  Clock,
  Users,
} from "lucide-react";
import { useMsal } from "@azure/msal-react";
import apiClient from "../api/client";

const QUOTE_COLORS = ["bg-blue-500","bg-red-500","bg-green-500","bg-purple-500","bg-orange-500","bg-teal-500","bg-pink-500","bg-indigo-500"];
function quoteAvatarColor(name) {
  if (!name) return QUOTE_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return QUOTE_COLORS[h % QUOTE_COLORS.length];
}
function quoteInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
function quoteFileSize(bytes) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function Email({ accessToken: accessTokenProp, onClose, onMailSent, replyData }) {
  const { instance, accounts } = useMsal();
  const [accessToken, setAccessToken] = useState(accessTokenProp || "");

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(""); // Applied template
  // Modal state for template
  const [modalSelectedTemplate, setModalSelectedTemplate] = useState("");
  // Sync modal state with applied state when opening modal

  // States
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [sendDropdown, setSendDropdown]           = useState(false);
  const [scheduleModal, setScheduleModal]         = useState(false);
  const [scheduleDateTime, setScheduleDateTime]   = useState("");
  const [schedulingInProgress, setSchedulingInProgress] = useState(false);
  // Show all emails modal for To field
  const [showAllToEmails, setShowAllToEmails] = useState(false);
  // Tag selection state
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState("");
  const [selectedTags, setSelectedTags] = useState([]); // Applied tags
  // Modal state for tags
  const [modalSelectedTags, setModalSelectedTags] = useState([]);

  // Templates & Tags Modal state
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Original email quote (reply/replyAll mode) — shown visually, not in textarea
  const [quoteHtml, setQuoteHtml] = useState("");

  // File attachment and image states
  const [attachments, setAttachments] = useState([]);
  const [images, setImages] = useState([]);
  const attachmentInputRef = React.useRef(null);
  const imageInputRef = React.useRef(null);

  // Email suggestions state
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [filteredEmailSuggestions, setFilteredEmailSuggestions] = useState([]);
  const toInputRef = React.useRef(null);

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

  //  DRAG & DROP
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);

    const imageFiles = droppedFiles.filter((file) =>
      file.type.startsWith("image/")
    );
    const otherFiles = droppedFiles.filter(
      (file) => !file.type.startsWith("image/")
    );

    if (imageFiles.length > 0) {
      setImages((prev) => [...prev, ...imageFiles]);
    }

    if (otherFiles.length > 0) {
      setAttachments((prev) => [...prev, ...otherFiles]);
    }
  };

  // Filter templates and tags based on search
  const filteredTemplates = templates.filter(
    (tpl) =>
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.TemplateType &&
        tpl.TemplateType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tpl.Body &&
        tpl.Body.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTags = tags.filter((tag) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handler functions for modal
  const handleTemplateSelect = (templateName) => {
    setModalSelectedTemplate(templateName);
  };

  const handleTagToggle = (tag) => {
    if (modalSelectedTags.includes(tag)) {
      setModalSelectedTags(modalSelectedTags.filter((t) => t !== tag));
    } else {
      setModalSelectedTags([...modalSelectedTags, tag]);
    }
  };

  const handleApply = () => {
    setSelectedTemplate(modalSelectedTemplate);
    setSelectedTags(modalSelectedTags);
    setShowTemplatesModal(false);
  };

  const handleClearAll = () => {
    setModalSelectedTemplate("");
    setModalSelectedTags([]);
  };

  // Get access token from MSAL (redirect-safe, no popup)
useEffect(() => {
  console.log(
    "Email: Getting token. Prop:",
    !!accessTokenProp,
    "Accounts:",
    accounts.length
  );

  // 1️⃣ If token was passed in, just use it
  if (accessTokenProp) {
    console.log("Email: Using provided access token");
    setAccessToken(accessTokenProp);
    return;
  }

  // 2️⃣ No account → nothing to do
  if (accounts.length === 0) {
    console.warn("Email: No accounts found");
    setAccessToken("");
    return;
  }

  const request = {
    account: accounts[0],
    scopes: [
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/Mail.ReadWrite",
      "https://graph.microsoft.com/Mail.Send",
    ],
  };

  const getToken = async () => {
    try {
      // ✅ Silent first
      const response = await instance.acquireTokenSilent(request);
      console.log("Email: Token acquired (silent)");
      setAccessToken(response.accessToken);
    } catch (error) {
      console.warn(
        "Email: Silent token failed, redirecting:",
        error.errorCode
      );

      // ✅ Redirect fallback (NO popup)
      instance.acquireTokenRedirect(request);
    }
  };

  getToken();
}, [accessTokenProp, instance, accounts]);

  // Manage body overflow when modal is open
  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      // Restore body scroll when modal is closed/unmounted
      document.body.style.overflow = "unset";
    };
  }, []);

  // Fetch templates on mount
  useEffect(() => {
    apiClient
      .get(`/Template`)
      .then((res) => {
        const templatesArray = Array.isArray(res.data) ? res.data : [];
        // Filter only active templates
        const activeTemplates = templatesArray.filter(t => t.IsActive !== false);
        console.debug("[Email] Templates loaded:", activeTemplates);
        setTemplates(activeTemplates);
      })
      .catch((err) => {
        console.error("[Email] Failed to load templates:", err);
        setTemplates([]);
      });
  }, []);

  // Fetch tags on mount (so button shows if there are any tags)
  useEffect(() => {
    setTagsLoading(true);
    setTagsError("");
    apiClient
      .get(`/Contact/tags/all`)
      .then((res) => {
        const tagsArray = Array.isArray(res.data) ? res.data : [];
        console.debug("[Email] Tags loaded:", tagsArray);
        setTags(tagsArray);
        setTagsLoading(false);
      })
      .catch((err) => {
        console.error("[Email] Failed to load tags:", err);
        setTags([]);
        setTagsError("Could not load tags");
        setTagsLoading(false);
      });
  }, []);

  // Fetch contact emails for autocomplete using paged endpoint (avoids loading all contacts)
  useEffect(() => {
    const fetchContactEmails = async () => {
      try {
        const allEmails = [];
        let page = 1;
        const pageSize = 100;
        while (true) {
          const res = await apiClient.get(`/Contact?page=${page}&pageSize=${pageSize}`);
          const items = Array.isArray(res.data?.items) ? res.data.items : [];
          items.forEach((contact) => {
            const workEmail = contact.WorkEmail || contact.workEmail || "";
            if (typeof workEmail === "string" && workEmail.trim()) {
              allEmails.push(workEmail.trim());
            }
          });
          if (items.length < pageSize) break;
          page++;
          if (page > 10) break; // safety cap at 1000 emails
        }
        setEmailSuggestions([...new Set(allEmails)].sort());
      } catch (error) {
        setEmailSuggestions([]);
      }
    };
    fetchContactEmails();
  }, []);

  // When a template is selected, fetch its details and fill subject/body
  useEffect(() => {
    if (selectedTemplate) {
      apiClient
        .get(`/Template/${encodeURIComponent(selectedTemplate)}`)
        .then((res) => {
          const data = res.data;
          if (data && typeof data === "object") {
            setSubject(data.subject || "");
            setBody(data.body || "");
          }
        })
        .catch(() => {});
    }
  }, [selectedTemplate]);

  // On mount, check for selectedContactEmails in localStorage to prefill To field (one-shot, clear after read)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("selectedContactEmails");
      if (raw) {
        localStorage.removeItem("selectedContactEmails");
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          setToInput(arr.join(", "));
        }
      }
    } catch (e) {}
  }, []);

  // Convert HTML to plain text while preserving structure
  const htmlToPlainText = (html) => {
    if (!html) return "";
    let text = html;
    // Convert common HTML tags to newlines
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<\/li>/gi, "\n");
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, "");
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    // Clean up multiple newlines
    text = text.replace(/\n\n\n+/g, "\n\n");
    return text.trim();
  };

  // Handle reply data when provided
  useEffect(() => {
    if (replyData) {
      setToInput(replyData.toEmail || "");
      setCcInput(replyData.ccEmail || "");
      setSubject(replyData.subject || "");

      if (replyData.type === "reply" || replyData.type === "replyAll") {
        // Body starts empty — user types reply above the quoted original
        setBody("");
        setQuoteHtml(replyData.originalBody || "");
      } else if (replyData.type === "forward") {
        const plainTextBody = htmlToPlainText(replyData.originalBody);
        const forwardText = `\n\n---\nForwarded message:\nFrom: ${replyData.originalMail.sender}\nTo: ${replyData.originalMail.toEmail}\nDate: ${new Date(replyData.originalMail.receivedDateTime).toLocaleString()}\nSubject: ${replyData.originalMail.subject}\n\n${plainTextBody}`;
        setBody(forwardText);
        setQuoteHtml("");
        if (replyData.attachments && replyData.attachments.length > 0) {
          setAttachments(replyData.attachments);
        }
      }

      if (replyData.ccEmail) {
        setShowCc(true);
      }
    }
  }, [replyData]);

  // Handle To input change with email autocomplete
  const handleToInputChange = (e) => {
    const value = e.target.value;
    
    // Check if user just typed a separator (comma or semicolon)
    const lastChar = value[value.length - 1];
    const hasSeparator = lastChar === ',' || lastChar === ';';
    
    if (hasSeparator) {
      // Extract everything before the separator
      const newEmail = value.slice(0, -1).trim();
      
      if (newEmail && newEmail.length > 0) {
        // Add to confirmed emails list and clear input
        setToInput(toInput + newEmail + ", ");
        setShowEmailSuggestions(false);
        setFilteredEmailSuggestions([]);
        if (toInputRef.current) {
          toInputRef.current.focus();
        }
      }
      return;
    }
    
    // Update input with selected email
    setToInput(toInput.slice(0, toInput.lastIndexOf(',') + 1) + value.trim());
    
    // Get the current partial email (what user is typing)
    const lastEmail = value.trim();
    
    if (lastEmail && lastEmail.length > 0) {
      // Filter suggestions based on partial input
      const filtered = emailSuggestions.filter((email) =>
        email.toLowerCase().includes(lastEmail.toLowerCase())
      );
      setFilteredEmailSuggestions(filtered);
      setShowEmailSuggestions(filtered.length > 0);
    } else {
      setShowEmailSuggestions(false);
      setFilteredEmailSuggestions([]);
    }
  };

  // Handle selecting an email from suggestions
  const handleSelectEmailSuggestion = (email) => {
    // Add selected email to confirmed list and clear input
    setToInput(toInput + email + ", ");
    setShowEmailSuggestions(false);
    setFilteredEmailSuggestions([]);
    if (toInputRef.current) {
      toInputRef.current.focus();
    }
  };

  // Helper: parse a user-provided string of emails into an array
  const parseEmails = (input) => {
    if (!input) return [];
    return input
      .split(/[;,\n]+/) // split on comma, semicolon or newline
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const validateEmail = (email) => {
    // simple regex for basic validation
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  // Handle attachment file selection
  const handleAttachmentSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  // Handle image file selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    setImages([...images, ...imageFiles]);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  // Remove attachment
  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Remove image
  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);

    // Parse inputs into arrays
    const toEmails = parseEmails(toInput);
    const ccEmails = parseEmails(ccInput);

    // Frontend validation for empty or invalid fields
    let validationErrors = {};
    if (toEmails.length === 0)
      validationErrors.to = "At least one recipient is required";
    if (!subject.trim()) validationErrors.subject = "Subject is required";
    if (!body.trim() && !quoteHtml) validationErrors.body = "Email body is required";

    // Validate email formats
    const invalidTo = toEmails.filter((addr) => !validateEmail(addr));
    if (invalidTo.length > 0)
      validationErrors.to = `Invalid To address(es): ${invalidTo.join(", ")}`;
    const invalidCc = ccEmails.filter((addr) => !validateEmail(addr));
    if (invalidCc.length > 0)
      validationErrors.cc = `Invalid Cc address(es): ${invalidCc.join(", ")}`;

    // Update error state and clear success message
    setErrors(validationErrors);
    setSuccessMessage("");

    // If any validation failed, stop submission here
    if (Object.keys(validationErrors).length > 0) {
      setIsSending(false);
      return;
    }

    // Prepare attachments for Microsoft Graph API
    let attachmentsPayload = [];
    try {
      for (const file of attachments) {
        const base64 = await fileToBase64(file);
        attachmentsPayload.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: file.name,
          contentBytes: base64,
        });
      }

      for (const file of images) {
        const base64 = await fileToBase64(file);
        attachmentsPayload.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: file.name,
          contentBytes: base64,
        });
      }
    } catch (error) {
      console.error("Error converting files to base64:", error);
      setErrors({ apiError: "Failed to process attachments/images" });
      setIsSending(false);
      return;
    }

    // Send Email via Microsoft Graph API
    try {
      console.log("Sending email via Graph API");
      const userHtml = body.replace(/\n/g, "<br>").replace(/ {2}/g, "&nbsp;&nbsp;");
      const finalHtml = quoteHtml
        ? `${userHtml}<br><br><div style="border-left:2px solid #e5e7eb;padding-left:12px;margin-top:8px;color:#6b7280;font-size:13px;">${quoteHtml}</div>`
        : userHtml;
      const emailPayload = {
        message: {
          subject: subject,
          body: {
            contentType: "HTML",
            content: finalHtml,
          },
          toRecipients: toEmails.map((addr) => ({
            emailAddress: {
              address: addr,
            },
          })),
          ccRecipients:
            ccEmails.length > 0
              ? ccEmails.map((addr) => ({
                  emailAddress: {
                    address: addr,
                  },
                }))
              : [],
        },
      };

      // Add attachments if any
      if (attachmentsPayload.length > 0) {
        emailPayload.message.attachments = attachmentsPayload;
      }

      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        }
      );

      // Check if the request was successful
      if (response.ok || response.status === 202) {
        console.log(" Email sent successfully (status:", response.status, ")");
        setSuccessMessage("Email sent successfully!");
        setErrors({});

        // Reset form fields after successful email send
        setToInput("");
        setCcInput("");
        setSubject("");
        setBody("");
        setQuoteHtml("");
        setSelectedTemplate("");
        setSelectedTags([]);
        setAttachments([]);
        setImages([]);

        // Clear selected contacts from localStorage after sending
        try {
          localStorage.removeItem("selectedContactEmails");
        } catch (e) {}

        // Call onMailSent prop if provided
        if (typeof onMailSent === "function") {
          onMailSent({
            subject,
            body,
            to: toEmails,
            cc: ccEmails,
          });
        }

        setIsSending(false);

        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error("Graph API error response:", errorData);
        setErrors({
          apiError: errorData.error?.message || "Failed to send email",
        });
        setIsSending(false);
      }
    } catch (error) {
      console.error("Network/parse error when sending email:", error);
      setErrors({ apiError: error.message || "Failed to send email" });
      setIsSending(false);
    }
  };

  // Build send payload (shared by schedule + mail merge)
  const buildPayload = () => {
    const toEmails = parseEmails(toInput);
    const ccEmails = parseEmails(ccInput);
    const finalHtml = quoteHtml
      ? `${body.replace(/\n/g, "<br>").replace(/ {2}/g, "&nbsp;&nbsp;")}<br><br><div style="border-left:2px solid #e5e7eb;padding-left:12px;margin-top:8px;color:#6b7280;font-size:13px;">${quoteHtml}</div>`
      : body.replace(/\n/g, "<br>").replace(/ {2}/g, "&nbsp;&nbsp;");
    return { toEmails, ccEmails, html: finalHtml };
  };

  const handleScheduleSend = async () => {
    if (!scheduleDateTime) return;
    const scheduledAt = new Date(scheduleDateTime);
    const delay = scheduledAt.getTime() - Date.now();
    if (delay <= 0) { setErrors({ apiError: "Please select a future date and time." }); return; }
    const { toEmails, ccEmails, html } = buildPayload();
    if (!toEmails.length) { setErrors({ to: "At least one recipient is required." }); return; }
    setSchedulingInProgress(true);
    try {
      const draftRes = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
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
          await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
            method: "POST", headers: { Authorization: `Bearer ${accessToken}` },
          }).catch(() => {});
        }, delay);
        setScheduleModal(false);
        setSuccessMessage(`Scheduled for ${scheduledAt.toLocaleString()}`);
        setTimeout(() => onClose(), 1200);
      } else {
        const err = await draftRes.json().catch(() => ({}));
        setErrors({ apiError: err?.error?.message || "Failed to schedule email." });
      }
    } catch (e) {
      setErrors({ apiError: e.message || "Failed to schedule." });
    } finally {
      setSchedulingInProgress(false);
    }
  };

  const handleMailMerge = async () => {
    const { toEmails, ccEmails, html } = buildPayload();
    if (!toEmails.length) { setErrors({ to: "At least one recipient is required." }); return; }
    if (!subject.trim()) { setErrors({ subject: "Subject is required." }); return; }
    setIsSending(true); setErrors({});
    let sent = 0;
    for (const addr of toEmails) {
      try {
        const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: {
            subject,
            body: { contentType: "HTML", content: html },
            toRecipients: [{ emailAddress: { address: addr } }],
            ccRecipients: ccEmails.map(a => ({ emailAddress: { address: a } })),
          }}),
        });
        if (res.ok || res.status === 202) sent++;
      } catch {}
    }
    setIsSending(false);
    setSuccessMessage(`Mail merge sent to ${sent} of ${toEmails.length} recipient${toEmails.length !== 1 ? "s" : ""}.`);
    setTimeout(() => onClose(), 1200);
  };

  // Fetch emails for selected tags
  useEffect(() => {
    if (selectedTags.length > 0) {
      apiClient
        .get(`/Contact/tags/emails?tags=${encodeURIComponent(selectedTags.join(","))}`)
        .then((res) => {
          const emails = typeof res.data === "string" ? res.data : String(res.data || "");
          const emailArr = emails
            .split(/[,;\n]+/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
          setToInput(emailArr.join(", "));
        })
        .catch(() => {});
    }
  }, [selectedTags]);


  // Static light-mode theme (Email compose always light)
  const d = {
    bg: "bg-white", surface: "bg-gray-50", text: "text-gray-900",
    muted: "text-gray-600", border: "border-gray-200", borderSm: "border-gray-100",
    input: "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-blue-200",
    hover: "hover:bg-gray-100", hoverBlue: "hover:bg-blue-50",
    chip: "bg-white border-gray-300 text-gray-700",
    tag: "bg-blue-100 text-blue-800 border-blue-300",
  };
  const isDark = false;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1100] p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b ${d.border} ${d.surface}`}>
          <h2 className={`text-lg sm:text-xl font-bold ${d.text}`}>
            {replyData?.type === "reply" ? "Reply"
              : replyData?.type === "replyAll" ? "Reply All"
              : replyData?.type === "forward" ? "Forward"
              : "New Message"}
          </h2>
          <button
            onClick={onClose}
            className={`${d.muted} hover:text-gray-300 transition-colors p-1.5 ${d.hover} rounded-lg`}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Template & Tags Selector Button */}
          {(templates.length > 0 || tags.length > 0) && (
            <div className={`px-4 sm:px-6 py-2 sm:py-3 border-b ${isDark ? "bg-blue-900/20 border-blue-800/40" : "bg-blue-50 border-blue-100"}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowTemplatesModal(true)}
                  className={`px-3 py-2 ${isDark ? "bg-gray-700 text-blue-400 border-blue-700 hover:bg-gray-600" : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"} border rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm text-xs sm:text-sm font-medium flex-shrink-0`}
                >
                  <FileText size={16} />
                  Templates & Tags
                </button>

                {/* Display selected items */}
                {(selectedTemplate || selectedTags.length > 0) && (
                  <div className="flex-1 flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {selectedTemplate && (
                      <span className="bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-md flex items-center gap-2 border border-blue-200 text-xs font-medium flex-shrink-0">
                        <FileText size={12} />
                        {selectedTemplate}
                        <button
                          type="button"
                          onClick={() => setSelectedTemplate("")}
                          className="hover:text-indigo-900 transition-colors font-bold"
                          aria-label="Remove template"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-md flex items-center gap-2 border border-emerald-200 text-xs font-medium flex-shrink-0"
                      >
                        <Tag size={10} />
                        {tag}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTags(
                              selectedTags.filter((t) => t !== tag)
                            )
                          }
                          className="hover:text-emerald-900 transition-colors font-bold"
                          aria-label="Remove tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Templates & Tags Modal */}
          {showTemplatesModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1200] p-3 sm:p-4">
              <div className={`${d.bg} rounded-xl shadow-2xl w-full max-w-xl sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
                {/* Modal Header */}
                <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${d.border} ${isDark ? "bg-blue-900/20" : "bg-blue-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
                        <FileText size={20} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <h2 className={`text-base sm:text-lg font-bold ${d.text}`}>Templates & Tags</h2>
                        <p className={`text-xs sm:text-sm ${d.muted} mt-0.5`}>
                          Select template and tags for your email
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTemplatesModal(false)}
                      className={`p-1.5 ${d.hover} rounded-lg transition-colors flex-shrink-0 ${d.muted}`}
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className={`px-4 sm:px-6 py-2 sm:py-3 ${d.surface} border-b ${d.border}`}>
                  <div className="relative">
                    <Search size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${d.muted} flex-shrink-0`} />
                    <input
                      type="text"
                      placeholder="Search templates and tags..."
                      className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 transition-all text-sm ${d.input}`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
                  {/* Templates Section */}
                  {templates.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={16} className="text-blue-500 flex-shrink-0" />
                        <h3 className={`${d.text} text-sm font-semibold`}>Templates</h3>
                        <span className={`text-xs ${d.muted} ${isDark ? "bg-gray-700" : "bg-gray-100"} px-2 py-0.5 rounded-full ml-auto`}>
                          {filteredTemplates.length}
                        </span>
                      </div>

                      {filteredTemplates.length === 0 ? (
                        <p className={`${d.muted} text-xs sm:text-sm py-3 sm:py-4 text-center ${d.surface} rounded-lg`}>
                          No templates found
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredTemplates.map((tpl) => (
                            <button
                              key={tpl.name}
                              type="button"
                              onClick={() => handleTemplateSelect(tpl.name)}
                              className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg border transition-all text-sm ${
                                modalSelectedTemplate === tpl.name
                                  ? isDark ? "bg-blue-900/30 border-blue-500" : "bg-blue-50 border-blue-500 shadow-sm"
                                  : `${d.bg} ${d.border} ${d.hoverBlue}`
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`${d.text} font-medium text-sm`}>{tpl.name}</span>
                                    {tpl.TemplateType && (
                                      <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${isDark ? "bg-blue-900/40 text-blue-300" : "bg-blue-100 text-blue-700"}`}>
                                        {tpl.TemplateType}
                                      </span>
                                    )}
                                    {modalSelectedTemplate === tpl.name && (
                                      <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0 ml-auto" />
                                    )}
                                  </div>
                                  {tpl.Body && (
                                    <p className={`${d.muted} text-xs mt-1 line-clamp-2`}>{tpl.Body}</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tags Section */}
                  {!tagsLoading && !tagsError && tags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Tag size={16} className="text-emerald-500 flex-shrink-0" />
                        <h3 className={`${d.text} text-sm font-semibold`}>Tags</h3>
                        <span className={`text-xs ${d.muted} ${isDark ? "bg-gray-700" : "bg-gray-100"} px-2 py-0.5 rounded-full ml-auto`}>
                          {filteredTags.length}
                        </span>
                      </div>

                      {filteredTags.length === 0 ? (
                        <p className={`${d.muted} text-xs sm:text-sm py-3 sm:py-4 text-center ${d.surface} rounded-lg`}>
                          No tags found
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {filteredTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleTagToggle(tag)}
                              className={`px-3 py-1.5 rounded-lg border transition-all text-xs sm:text-sm font-medium flex-shrink-0 ${
                                modalSelectedTags.includes(tag)
                                  ? isDark ? "bg-emerald-900/30 border-emerald-500 text-emerald-300" : "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                                  : `${d.bg} ${d.border} ${d.text} hover:border-emerald-400 ${isDark ? "hover:bg-emerald-900/20" : "hover:bg-emerald-50"}`
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {modalSelectedTags.includes(tag) && (
                                  <CheckCircle2 size={14} />
                                )}
                                {tag}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tagsLoading && (
                    <div className={`${d.muted} text-sm text-center py-4`}>
                      Loading tags...
                    </div>
                  )}

                  {tagsError && (
                    <div className="text-red-500 text-sm text-center py-4">
                      {tagsError}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t ${d.border} ${d.surface}`}>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className={`px-3 py-2 ${d.text} rounded-lg transition-colors text-xs sm:text-sm font-medium ${d.hover}`}
                    >
                      Clear All
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTemplatesModal(false)}
                        className={`px-3 py-2 border ${d.border} ${d.text} text-xs sm:text-sm font-medium rounded-lg ${d.hover} transition-colors`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApply}
                        className="px-3 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div className={`px-4 sm:px-6 py-3 border-b ${d.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`${d.muted} w-8 text-xs sm:text-sm font-medium flex-shrink-0`}>To:</span>
              <div className="flex-1 relative min-w-0">
                {/* Display confirmed emails as chips */}
                <div className="flex items-center flex-wrap gap-1 mb-2">
                  {(() => {
                    const emails = parseEmails(toInput);
                    const chips = emails.slice(0, 2);
                    return (
                      <>
                        {chips.map((email, idx) => (
                          <span
                            key={email + idx}
                            className={`${d.tag} px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 flex-shrink-0`}
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = parseEmails(toInput).filter((_, i) => email !== parseEmails(toInput)[i]).join(", ");
                                setToInput(updated ? updated + (updated ? ", " : "") : "");
                              }}
                              className="hover:text-blue-600 font-medium"
                              aria-label="Remove email"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {emails.length > 2 && (
                          <button
                            type="button"
                            className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full text-xs font-medium border border-blue-300 hover:bg-blue-100 transition-colors flex-shrink-0"
                            onClick={() => setShowAllToEmails(true)}
                          >
                            +{emails.length - 2}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Input field for typing new emails */}
                <input
                  ref={toInputRef}
                  type="text"
                  placeholder="Type emails (comma or semicolon separated)..."
                  value={(() => {
                    const parts = toInput.split(/[,;]/).map(s => s.trim());
                    return parts[parts.length - 1] || "";
                  })()}
                  onChange={handleToInputChange}
                  onFocus={() => {
                    const parts = toInput.split(/[,;]/).map(s => s.trim());
                    const lastEmail = parts[parts.length - 1] || "";
                    if (lastEmail && emailSuggestions.some(e => e.toLowerCase().includes(lastEmail.toLowerCase()))) {
                      setShowEmailSuggestions(true);
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 transition-all text-sm ${d.input}`}
                />
                
                {/* Email Suggestions Dropdown */}
                {showEmailSuggestions && filteredEmailSuggestions.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-1 ${d.bg} border ${d.border} rounded-lg shadow-lg z-[100] max-h-[200px] overflow-y-auto`}>
                    {filteredEmailSuggestions.map((email, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectEmailSuggestion(email)}
                        className={`w-full text-left px-3 py-2 ${d.hoverBlue} border-b ${d.borderSm} last:border-b-0 text-sm ${d.text} transition-colors`}
                      >
                        {email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCc(!showCc)}
                className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm px-2 font-medium flex-shrink-0"
              >
                Cc
              </button>
            </div>
            {errors.to && (
              <p className="text-red-600 text-xs ml-8 sm:ml-[52px] -mt-1 mb-2">
                {errors.to}
              </p>
            )}

            {showCc && (
              <>
                <div className="flex items-center gap-2 mb-2 mt-2">
                  <span className={`${d.muted} w-8 text-xs sm:text-sm font-medium flex-shrink-0`}>Cc:</span>
                  <input
                    type="text"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    placeholder="Cc recipients (optional)"
                    className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 text-sm ${d.input}`}
                  />
                </div>
                {errors.cc && (
                  <p className="text-red-600 text-xs ml-8 sm:ml-[52px] -mt-1 mb-2">
                    {errors.cc}
                  </p>
                )}
              </>
            )}

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <label htmlFor="email-subject" className={`${d.muted} text-xs sm:text-sm font-medium flex-shrink-0 sm:w-[52px]`}>
                Subject:
              </label>
              <input
                id="email-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Add a subject"
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 text-sm ${d.input}`}
              />
            </div>
            {errors.subject && (
              <p className="text-red-600 text-xs ml-8 sm:ml-[52px] mt-1">
                {errors.subject}
              </p>
            )}
          </div>

          {/* Message Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={quoteHtml ? "Type your reply here…" : "Type your message here… or drop files"}
              className={`w-full resize-none text-sm border rounded-lg p-3 transition-all outline-none ${
                quoteHtml ? "min-h-[100px] sm:min-h-[120px]" : "flex-1 min-h-[200px] sm:min-h-[300px]"
              } ${
                isDragging
                  ? "border-blue-500 " + (isDark ? "bg-blue-900/20" : "bg-blue-50")
                  : d.input
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
            {errors.body && (
              <p className="text-red-600 text-xs -mt-2">{errors.body}</p>
            )}

            {/* Original email quoted block (reply/replyAll mode) */}
            {quoteHtml && replyData && (
              <div className={`border ${d.border} rounded-xl overflow-hidden shadow-sm`}>
                {/* Sender row */}
                <div className={`flex items-start gap-3 px-4 py-3 ${d.surface} border-b ${d.border}`}>
                  <div className={`w-9 h-9 rounded-full ${quoteAvatarColor(replyData.originalMail?.sender)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                    {quoteInitials(replyData.originalMail?.sender)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-semibold ${d.text} truncate`}>{replyData.originalMail?.sender}</span>
                      <span className={`text-[11px] ${d.muted} flex-shrink-0`}>
                        {replyData.originalMail?.receivedDateTime ? new Date(replyData.originalMail.receivedDateTime).toLocaleString() : ""}
                      </span>
                    </div>
                    <div className={`flex flex-wrap items-center gap-1 text-xs ${d.muted}`}>
                      <span className="font-medium">To:</span>
                      {(replyData.originalMail?.toEmail || "").split(/[,;]/).map(e => e.trim()).filter(Boolean).map((e, i) => (
                        <span key={i} className={`px-1.5 py-0.5 rounded ${isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>{e}</span>
                      ))}
                    </div>
                    {replyData.originalMail?.ccEmail && (
                      <div className={`flex flex-wrap items-center gap-1 mt-0.5 text-xs ${d.muted}`}>
                        <span className="font-medium">Cc:</span>
                        {replyData.originalMail.ccEmail.split(/[,;]/).map(e => e.trim()).filter(Boolean).map((e, i) => (
                          <span key={i} className={`px-1.5 py-0.5 rounded ${isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>{e}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Attachments row */}
                {replyData.originalMail?.attachments?.length > 0 && (
                  <div className={`px-4 py-2.5 border-b ${d.border} ${d.surface} flex flex-wrap gap-2`}>
                    {replyData.originalMail.attachments.map((att, i) => {
                      const name = att.name || att.fileName || `attachment-${i}`;
                      const sz = quoteFileSize(att.size);
                      return (
                        <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 border ${d.border} rounded-lg ${d.bg} text-xs`}>
                          <Paperclip size={12} className={`${d.muted} flex-shrink-0`} />
                          <span className={`${d.text} font-medium truncate max-w-[140px]`}>{name}</span>
                          {sz && <span className={d.muted}>{sz}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Email body */}
                <div
                  className={`px-4 py-3 text-sm ${d.muted} max-h-52 overflow-y-auto leading-relaxed ${d.bg}`}
                  dangerouslySetInnerHTML={{ __html: quoteHtml }}
                />
              </div>
            )}
          </div>
          

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className={`px-4 sm:px-6 py-2 sm:py-3 border-t ${d.border} ${d.surface}`}>
              <p className={`text-xs sm:text-sm font-semibold ${d.text} mb-2`}>
                Attachments ({attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 ${d.chip} px-2 py-1 rounded text-xs border`}
                  >
                    <span className={`${d.text} truncate text-xs`}>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-red-600 hover:text-red-800 font-bold flex-shrink-0"
                      aria-label="Remove attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images Preview */}
          {images.length > 0 && (
            <div className={`px-4 sm:px-6 py-2 sm:py-3 border-t ${d.border} ${d.surface}`}>
              <p className={`text-xs sm:text-sm font-semibold ${d.text} mb-2`}>
                Images ({images.length})
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {images.map((file, idx) => (
                  <div key={idx} className="relative group flex-shrink-0">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error & Success Messages */}
          {errors.apiError && (
            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-red-50 border-t border-red-200">
              <p className="text-red-600 text-xs sm:text-sm">{errors.apiError}</p>
            </div>
          )}

          {successMessage && (
            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-emerald-50 border-t border-emerald-200">
              <p className="text-emerald-700 text-xs sm:text-sm">{successMessage}</p>
            </div>
          )}

          {/* Footer */}
          <div className={`px-4 sm:px-6 py-3 border-t ${d.border} flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${d.surface}`}>
            <div className="flex items-center gap-1 flex-wrap">
              {/* Send split-button with dropdown */}
              <div className="relative flex-shrink-0">
                <div className="flex rounded-lg overflow-hidden shadow-sm">
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed text-xs sm:text-sm font-medium h-10 sm:h-auto"
                  >
                    <Send size={15} />
                    {isSending ? "Sending..." : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendDropdown(p => !p)}
                    className="flex items-center px-2 bg-blue-600 hover:bg-blue-700 text-white border-l border-blue-500 transition h-10 sm:h-auto"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {sendDropdown && (
                  <div className={`absolute left-0 top-full mt-1 w-48 ${d.bg} border ${d.border} rounded-xl shadow-xl z-50 overflow-visible`}
                    onMouseLeave={() => setSendDropdown(false)}>
                    <button type="submit" onClick={() => setSendDropdown(false)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${d.text} ${d.hover} transition`}>
                      <Send size={14} className="text-blue-500 flex-shrink-0" />Send
                    </button>
                    <button type="button" onClick={() => { setSendDropdown(false); setScheduleDateTime(""); setScheduleModal(true); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${d.text} ${d.hover} transition`}>
                      <Clock size={14} className="text-blue-500 flex-shrink-0" />Schedule send
                    </button>
                    <button type="button" onClick={() => { setSendDropdown(false); handleMailMerge(); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${d.text} ${d.hover} transition`}>
                      <Users size={14} className="text-blue-500 flex-shrink-0" />Start mail merge
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className={`p-2 ${d.muted} ${d.hover} rounded-lg transition h-10 w-10 flex items-center justify-center`}
                title="Attach file"
                aria-label="Attach file"
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                onChange={handleAttachmentSelect}
                className="hidden"
              />

              <button
                type="button"
                className={`p-2 ${d.muted} ${d.hover} rounded-lg transition h-10 w-10 flex items-center justify-center`}
                title="Insert emoji"
                aria-label="Insert emoji"
              >
                <Smile size={18} />
              </button>

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className={`p-2 ${d.muted} ${d.hover} rounded-lg transition h-10 w-10 flex items-center justify-center`}
                title="Insert image"
                aria-label="Insert image"
              >
                <ImageIcon size={18} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`${d.muted} px-3 sm:px-4 py-2 ${d.hover} rounded-lg transition text-xs sm:text-sm font-medium`}
            >
              Discard
            </button>
          </div>
        </form>

        {/* All Recipients Modal */}
        {showAllToEmails && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4">
            <div className={`${d.bg} rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col`}>
              {/* Modal Header */}
              <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${d.border} flex items-center justify-between gap-3`}>
                <h2 className={`text-base sm:text-lg font-bold ${d.text}`}>All Recipients ({parseEmails(toInput).length})</h2>
                <button
                  onClick={() => setShowAllToEmails(false)}
                  className={`${d.muted} p-1.5 ${d.hover} rounded-lg transition flex-shrink-0`}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
                {/* Input field for adding more emails */}
                <div className="mb-4 relative">
                  <input
                    type="text"
                    placeholder="Add more emails..."
                    value={(() => {
                      const parts = toInput.split(/[,;]/).map(s => s.trim());
                      return parts[parts.length - 1] || "";
                    })()}
                    onChange={handleToInputChange}
                    onFocus={() => setShowEmailSuggestions(true)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 transition-all text-sm ${d.input}`}
                  />

                  {/* Suggestions in modal */}
                  {showEmailSuggestions && filteredEmailSuggestions.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 ${d.bg} border ${d.border} rounded-lg shadow-lg z-[210] max-h-[150px] overflow-y-auto`}>
                      {filteredEmailSuggestions.map((email, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectEmailSuggestion(email)}
                          className={`w-full text-left px-3 py-2 ${d.hoverBlue} border-b ${d.borderSm} last:border-b-0 text-xs sm:text-sm ${d.text} transition-colors`}
                        >
                          {email}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* List of all emails */}
                <div className="space-y-2">
                  {parseEmails(toInput).map((email, idx) => (
                    <div
                      key={email + idx}
                      className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border ${isDark ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-200"}`}
                    >
                      <span className={`text-xs sm:text-sm ${d.text} flex-1 break-all`}>{email}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = parseEmails(toInput)
                            .filter((_, i) => email !== parseEmails(toInput)[i])
                            .join(", ");
                          setToInput(updated ? updated + (updated ? ", " : "") : "");
                        }}
                        className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-100 p-1 rounded transition flex-shrink-0"
                        title="Remove email"
                        aria-label="Remove email"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {parseEmails(toInput).length === 0 && (
                  <p className={`text-center ${d.muted} text-xs sm:text-sm py-6 sm:py-8`}>No recipients added yet</p>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t ${d.border} flex items-center justify-end gap-2 ${d.surface}`}>
                <button
                  type="button"
                  onClick={() => setShowAllToEmails(false)}
                  className={`px-3 py-2 ${d.text} border ${d.border} rounded-lg ${d.hover} transition text-xs sm:text-sm font-medium`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Schedule Send Modal ── */}
        {scheduleModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1400] p-4">
            <div className={`${d.bg} rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border ${d.border}`}>
              <div className={`px-5 py-4 border-b ${d.border} flex items-center justify-between`}>
                <h3 className={`text-base font-semibold ${d.text} flex items-center gap-2`}>
                  <Clock size={16} className="text-blue-500" />Schedule send
                </h3>
                <button type="button" onClick={() => setScheduleModal(false)}
                  className={`p-1.5 rounded-lg ${d.hover} ${d.muted} transition`}>
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4">
                <label className={`text-xs font-medium ${d.muted} mb-2 block`}>Select date and time</label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={e => setScheduleDateTime(e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 ${d.input}`}
                />
                {errors.apiError && <p className="mt-2 text-xs text-red-500">{errors.apiError}</p>}
              </div>
              <div className={`px-5 py-3 border-t ${d.border} flex items-center justify-end gap-2 ${d.surface}`}>
                <button type="button" onClick={() => setScheduleModal(false)}
                  className={`px-4 py-2 text-sm font-medium ${d.muted} ${d.hover} rounded-lg transition`}>
                  Cancel
                </button>
                <button type="button" onClick={handleScheduleSend}
                  disabled={!scheduleDateTime || schedulingInProgress}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                  <Clock size={14} />{schedulingInProgress ? "Scheduling…" : "Schedule"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Email;
