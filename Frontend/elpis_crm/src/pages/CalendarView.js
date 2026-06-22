import React, { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import {
  ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Video,
  X, RefreshCw, Search, Users, FileText, Star,
} from "lucide-react";

/* ─── constants ────────────────────────────────────────────── */
const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEK_HOURS = Array.from({ length: 24 }, (_, i) => i);

const CALENDAR_SCOPES = ["https://graph.microsoft.com/Calendars.ReadWrite"];

const COLOR_POOL = [
  { bg: "bg-blue-500",    light: "bg-blue-50 text-blue-800 border-blue-200",     dot: "bg-blue-500"    },
  { bg: "bg-purple-500",  light: "bg-purple-50 text-purple-800 border-purple-200", dot: "bg-purple-500"  },
  { bg: "bg-teal-500",    light: "bg-teal-50 text-teal-800 border-teal-200",     dot: "bg-teal-500"    },
  { bg: "bg-rose-500",    light: "bg-rose-50 text-rose-800 border-rose-200",     dot: "bg-rose-500"    },
  { bg: "bg-amber-500",   light: "bg-amber-50 text-amber-800 border-amber-200",  dot: "bg-amber-500"   },
  { bg: "bg-emerald-500", light: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  { bg: "bg-indigo-500",  light: "bg-indigo-50 text-indigo-800 border-indigo-200", dot: "bg-indigo-500"  },
];

/* ─── helpers ──────────────────────────────────────────────── */
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtFull(d) {
  if (!d) return "";
  return new Date(d).toLocaleString([], {
    weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function meetingDuration(from, to) {
  if (!from || !to) return "";
  const mins = Math.round((new Date(to) - new Date(from)) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function getColor(idx) {
  return COLOR_POOL[(idx || 0) % COLOR_POOL.length];
}
// Deterministic color from event id string
function colorIdxFromId(id) {
  if (!id) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % COLOR_POOL.length;
}

// Normalize a Graph API event to a flat display object
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
  const plainBody = rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const parseGDate = (dt, tz) => {
    if (!dt) return null;
    return tz === "UTC" ? dt.replace(/Z?$/, "Z") : dt;
  };

  return {
    id: ev.id,
    title: ev.subject || "(No title)",
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

/* ─── MiniCalendar ─────────────────────────────────────────── */
function MiniCalendar({ focusDate, onSelectDate, meetings }) {
  const [mini, setMini] = useState(new Date(focusDate));
  const year = mini.getFullYear(), month = mini.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const meetingDays = new Set(
    meetings.map((m) => {
      const d = new Date(m.from);
      return d.getMonth() === month && d.getFullYear() === year ? d.getDate() : null;
    }).filter(Boolean)
  );

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday  = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  const isFocus  = (d) => d && year === focusDate.getFullYear() && month === focusDate.getMonth() && d === focusDate.getDate();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden select-none">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <button onClick={() => setMini(new Date(year, month - 1, 1))}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-gray-700">{MONTHS[month].slice(0,3)} {year}</span>
        <button onClick={() => setMini(new Date(year, month + 1, 1))}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-[9px] text-gray-400 text-center font-semibold py-0.5">{d[0]}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((d, i) => (
            <button key={i} disabled={!d} onClick={() => d && onSelectDate(new Date(year, month, d))}
              className={`relative w-full aspect-square flex items-center justify-center rounded-full text-[11px] transition-all
                ${!d ? "" : isFocus(d) ? "bg-[#6264A7] text-white font-semibold shadow-sm"
                  : isToday(d) ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"}`}
            >
              {d}
              {d && meetingDays.has(d) && !isFocus(d) && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#6264A7]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── EventChip ────────────────────────────────────────────── */
function EventChip({ meeting, onClick, compact }) {
  const color = getColor(colorIdxFromId(meeting.id));
  const from  = meeting.from;

  if (compact) {
    return (
      <button onClick={(e) => { e.stopPropagation(); onClick(meeting); }}
        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] border truncate flex items-center gap-1 transition-all hover:brightness-95 ${color.light}`}
        title={meeting.title}
      >
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
        <span className="truncate font-medium">{fmtTime(from)} {meeting.title}</span>
        {meeting.isOnlineMeeting && <Video className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />}
      </button>
    );
  }

  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(meeting); }}
      className={`w-full text-left px-2 py-1 rounded-lg border mb-1 transition-all hover:shadow-sm hover:-translate-y-px ${color.light}`}
    >
      <div className="flex items-start gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${color.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-snug">{meeting.title}</p>
          <p className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5" />{fmtTime(from)}
            {meeting.isOnlineMeeting && <Video className="w-2.5 h-2.5 ml-1" />}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ─── MeetingDetailPanel ───────────────────────────────────── */
function MeetingDetailPanel({ meeting, onClose }) {
  if (!meeting) return null;
  const color = getColor(colorIdxFromId(meeting.id));
  const { title, from, to, location, description, attendees, isOnlineMeeting, teamsJoinUrl, organizer } = meeting;

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-white shadow-2xl z-50 flex flex-col cal-panel-in">
      <style>{`
        @keyframes calPanelIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
        .cal-panel-in { animation: calPanelIn 220ms cubic-bezier(.22,.68,0,1.2) forwards; }
      `}</style>

      <div className={`px-6 py-5 ${color.light} border-b border-current/10`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2 border ${color.light}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
              {isOnlineMeeting ? "Teams Meeting" : "Calendar Event"}
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Date/Time */}
        <div className="flex gap-3">
          <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0"><Clock className="w-4 h-4 text-blue-600" /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{fmtFull(from)}</p>
            {to && <p className="text-xs text-gray-500 mt-0.5">until {fmtTime(to)} · {meetingDuration(from, to)}</p>}
          </div>
        </div>

        {/* Teams Join Button */}
        {isOnlineMeeting && (
          <div className="flex items-center gap-3 p-3 bg-[#6264A7]/10 rounded-xl border border-[#6264A7]/20">
            <div className="p-2 bg-[#6264A7]/20 rounded-lg"><Video className="w-4 h-4 text-[#6264A7]" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#4f518a]">Microsoft Teams</p>
              <p className="text-xs text-[#6264A7]">Online meeting</p>
            </div>
            {teamsJoinUrl && (
              <a href={teamsJoinUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#6264A7] hover:bg-[#4f518a] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
                Join
              </a>
            )}
          </div>
        )}

        {/* Location */}
        {location && !location.startsWith("https://") && (
          <div className="flex gap-3">
            <div className="p-2 bg-green-50 rounded-lg flex-shrink-0"><MapPin className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Location</p>
              <p className="text-sm text-gray-800">{location}</p>
            </div>
          </div>
        )}

        {/* Attendees */}
        {attendees && (
          <div className="flex gap-3">
            <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0"><Users className="w-4 h-4 text-amber-600" /></div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1.5">Attendees</p>
              <div className="flex flex-wrap gap-1.5">
                {String(attendees).split(/[,;]+/).filter(Boolean).map((a, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full">
                    <div className="w-4 h-4 rounded-full bg-[#6264A7] flex items-center justify-center text-[8px] text-white font-bold">
                      {a.trim().charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-700">{a.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Organizer */}
        {organizer && (
          <div className="flex gap-3">
            <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0"><Star className="w-4 h-4 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Organizer</p>
              <p className="text-sm text-gray-800">{organizer}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {description && (
          <div className="flex gap-3">
            <div className="p-2 bg-slate-50 rounded-lg flex-shrink-0"><FileText className="w-4 h-4 text-slate-500" /></div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN CALENDAR COMPONENT                                   */
/* ═══════════════════════════════════════════════════════════ */
export default function CalendarView() {
  const { instance, accounts } = useMsal();
  const isSignedIn = accounts.length > 0;

  const [calToken, setCalToken]         = useState("");
  const [meetings, setMeetings]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [error, setError]               = useState(null);
  const [viewMode, setViewMode]         = useState("month");
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [animDir, setAnimDir]           = useState("");

  /* ── Acquire calendar token ── */
  useEffect(() => {
    if (!accounts.length) { setCalToken(""); return; }
    setTokenLoading(true);
    instance.acquireTokenSilent({ scopes: CALENDAR_SCOPES, account: accounts[0] })
      .then((r) => setCalToken(r.accessToken))
      .catch((err) => {
        console.warn("Calendar token failed:", err?.errorCode);
        setCalToken("");
      })
      .finally(() => setTokenLoading(false));
  }, [accounts, instance]);

  /* ── Compute fetch window based on current view ── */
  const getFetchWindow = useCallback(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    if (viewMode === "month") {
      // Fetch prev month start → next month end for buffer
      return {
        start: new Date(y, m - 1, 1).toISOString(),
        end:   new Date(y, m + 2, 0, 23, 59, 59).toISOString(),
      };
    }
    if (viewMode === "week") {
      const ws = new Date(currentDate);
      ws.setDate(ws.getDate() - ws.getDay());
      ws.setHours(0, 0, 0, 0);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      return { start: ws.toISOString(), end: we.toISOString() };
    }
    // day
    const ds = new Date(currentDate); ds.setHours(0, 0, 0, 0);
    const de = new Date(currentDate); de.setHours(23, 59, 59, 999);
    return { start: ds.toISOString(), end: de.toISOString() };
  }, [currentDate, viewMode]);

  /* ── Fetch from Graph calendarView ── */
  const fetchMeetings = useCallback(async () => {
    if (!calToken) return;
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getFetchWindow();
      const sel = "id,subject,start,end,location,bodyPreview,body,attendees,isOnlineMeeting,onlineMeeting,organizer";
      const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$select=${encodeURIComponent(sel)}&$top=200&$orderby=${encodeURIComponent("start/dateTime asc")}`;
      const resp = await window.fetch(url, {
        headers: { Authorization: `Bearer ${calToken}`, Prefer: 'outlook.timezone="UTC"' },
      });
      if (!resp.ok) throw new Error(`Graph API error ${resp.status}`);
      const data = await resp.json();
      setMeetings((data.value || []).map(normalizeGraphEvent));
    } catch (err) {
      console.error("CalendarView fetchMeetings:", err);
      setError("Failed to load calendar events. " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [calToken, getFetchWindow]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  useEffect(() => {
    const handler = () => fetchMeetings();
    window.addEventListener("meetingUpdated", handler);
    return () => window.removeEventListener("meetingUpdated", handler);
  }, [fetchMeetings]);

  /* ── navigation ── */
  const navigate = (dir) => {
    setAnimDir(dir > 0 ? "left" : "right");
    setTimeout(() => setAnimDir(""), 300);
    if (viewMode === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
    } else if (viewMode === "week") {
      setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + dir * 7); return n; });
    } else {
      setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + dir); return n; });
    }
  };

  const goToday = () => setCurrentDate(new Date());

  /* ── month grid data ── */
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const prevMonthDays   = new Date(year, month, 0).getDate();

  const monthCells = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--)
    monthCells.push({ date: new Date(year, month - 1, prevMonthDays - i), overflow: true });
  for (let d = 1; d <= daysInMonth; d++)
    monthCells.push({ date: new Date(year, month, d), overflow: false });
  while (monthCells.length % 7 !== 0)
    monthCells.push({ date: new Date(year, month + 1, monthCells.length - daysInMonth - firstDayOfMonth + 1), overflow: true });

  /* ── week grid ── */
  const getWeekStart = (d) => { const n = new Date(d); n.setDate(n.getDate() - n.getDay()); n.setHours(0,0,0,0); return n; };
  const weekStart = getWeekStart(currentDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  /* ── helpers ── */
  const getMeetingsForDate = (date) =>
    meetings.filter((m) => { const d = new Date(m.from); return !isNaN(d) && sameDay(d, date); });

  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingMeetings = [...meetings]
    .filter((m) => new Date(m.from) >= today)
    .sort((a, b) => new Date(a.from) - new Date(b.from))
    .slice(0, 10);

  const filteredMeetings = searchQuery.trim()
    ? meetings.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (m.title || "").toLowerCase().includes(q) ||
               (m.location || "").toLowerCase().includes(q) ||
               (m.description || "").toLowerCase().includes(q);
      })
    : null;

  const calTitle =
    viewMode === "month" ? `${MONTHS[month]} ${year}`
    : viewMode === "week" ? `${MONTHS[weekStart.getMonth()].slice(0,3)} ${weekStart.getDate()} – ${MONTHS[weekDays[6].getMonth()].slice(0,3)} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
    : `${MONTHS[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;

  /* ── Sign-in handler ── */
  const handleSignIn = () => {
    instance.loginRedirect({ scopes: CALENDAR_SCOPES }).catch(console.error);
  };

  /* ── RENDER ── */
  return (
    <div className="h-full flex bg-gray-50 overflow-hidden font-[poppins,sans-serif]">
      <style>{`
        @keyframes calFadeLeft  { from { opacity:0; transform:translateX(16px);  } to { opacity:1; transform:none; } }
        @keyframes calFadeRight { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:none; } }
        .cal-fade-left  { animation: calFadeLeft  200ms ease-out forwards; }
        .cal-fade-right { animation: calFadeRight 200ms ease-out forwards; }
        .cal-scroll::-webkit-scrollbar       { width:4px; height:4px; }
        .cal-scroll::-webkit-scrollbar-track { background:transparent; }
        .cal-scroll::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:4px; }
      `}</style>

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-white border-r border-gray-100 shadow-sm z-10">
        <div className="px-4 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-[#6264A7]/10 rounded-lg">
              <Calendar className="w-4 h-4 text-[#6264A7]" />
            </div>
            <span className="text-sm font-bold text-gray-800">Teams Calendar</span>
            {(loading || tokenLoading) && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin ml-auto" />}
          </div>

          {!isSignedIn ? (
            <div className="p-3 bg-[#6264A7]/10 rounded-xl border border-[#6264A7]/20 text-xs text-[#4f518a] space-y-2">
              <p>Sign in to Microsoft to view your Teams Calendar.</p>
              <button onClick={handleSignIn}
                className="w-full py-1.5 bg-[#6264A7] hover:bg-[#4f518a] text-white rounded-lg text-xs font-semibold transition-colors">
                Sign in
              </button>
            </div>
          ) : (
            <div className="p-3 bg-[#6264A7]/10 rounded-xl border border-[#6264A7]/20 text-xs text-[#4f518a]">
              <span className="font-semibold">✓ Connected</span> — showing your Teams Calendar
            </div>
          )}
        </div>

        {/* Mini calendar */}
        <div className="px-3 py-4 border-b border-gray-100">
          <MiniCalendar
            focusDate={currentDate}
            onSelectDate={(d) => { setCurrentDate(d); setViewMode("day"); }}
            meetings={meetings}
          />
        </div>

        {/* Upcoming meetings */}
        <div className="flex-1 overflow-y-auto cal-scroll">
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Upcoming</p>
            {upcomingMeetings.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No upcoming events</p>
            ) : (
              upcomingMeetings.map((m) => {
                const color = getColor(colorIdxFromId(m.id));
                return (
                  <button key={m.id} onClick={() => setSelectedMeeting(m)}
                    className="w-full text-left flex items-start gap-2 py-2 px-1 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${color.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 font-medium truncate group-hover:text-[#6264A7]">{m.title}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(m.from).toLocaleDateString([], { month: "short", day: "numeric" })} · {fmtTime(m.from)}
                        {m.isOnlineMeeting && " 🎥"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CALENDAR AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
          <button onClick={goToday}
            className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
            Today
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => navigate(1)}  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <h1 className="text-lg font-bold text-gray-900 flex-1">{calTitle}</h1>

          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Search events…" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6264A7]/30 bg-gray-50 transition-all"
            />
          </div>

          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
            {["month","week","day"].map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all
                  ${viewMode === v ? "bg-white text-[#6264A7] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {v}
              </button>
            ))}
          </div>

          <button onClick={fetchMeetings} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Not signed in full-page prompt */}
        {!isSignedIn && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="p-5 bg-[#6264A7]/10 rounded-full">
              <Video className="w-12 h-12 text-[#6264A7]" />
            </div>
            <p className="text-xl font-bold text-gray-800">Connect Microsoft Teams</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Sign in with your Microsoft account to see your real Teams Calendar here.
            </p>
            <button onClick={handleSignIn}
              className="px-6 py-2.5 bg-[#6264A7] hover:bg-[#4f518a] text-white rounded-lg font-semibold shadow-md transition-colors">
              Sign in to Microsoft
            </button>
          </div>
        )}

        {/* Error banner */}
        {isSignedIn && error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <span>⚠</span>{error}
          </div>
        )}

        {/* Search results overlay */}
        {filteredMeetings && (
          <div className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">
                {filteredMeetings.length} result{filteredMeetings.length !== 1 ? "s" : ""} for "{searchQuery}"
              </p>
              <button onClick={() => setSearchQuery("")} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredMeetings.map((m) => {
                const color = getColor(colorIdxFromId(m.id));
                return (
                  <button key={m.id} onClick={() => setSelectedMeeting(m)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium hover:shadow-sm ${color.light}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                    {m.title}
                    <span className="opacity-60">· {fmtTime(m.from)}</span>
                    {m.isOnlineMeeting && <Video className="w-2.5 h-2.5 opacity-70" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar grid — only when signed in */}
        {isSignedIn && (
          <div className={`flex-1 min-h-0 overflow-auto cal-scroll ${animDir === "left" ? "cal-fade-left" : animDir === "right" ? "cal-fade-right" : ""}`}>

            {/* ─── MONTH VIEW ─── */}
            {viewMode === "month" && (
              <div className="min-h-full flex flex-col">
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100 flex-shrink-0">
                  {DAYS.map((d) => (
                    <div key={d} className="py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">{d}</div>
                  ))}
                </div>
                <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
                  {monthCells.map(({ date, overflow }, idx) => {
                    const isToday2 = sameDay(date, new Date());
                    const dayMeetings = getMeetingsForDate(date);
                    const MAX_VISIBLE = 3;
                    const extra = dayMeetings.length - MAX_VISIBLE;
                    return (
                      <div key={idx} onClick={() => { setCurrentDate(date); setViewMode("day"); }}
                        className={`border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors group
                          ${overflow ? "bg-gray-50/50" : "bg-white hover:bg-blue-50/20"}`}>
                        <div className="flex items-center justify-end mb-1">
                          <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-semibold
                            ${isToday2 ? "bg-[#6264A7] text-white shadow-sm"
                              : overflow ? "text-gray-300"
                              : "text-gray-700 group-hover:bg-[#6264A7]/10 group-hover:text-[#6264A7]"}`}>
                            {date.getDate()}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayMeetings.slice(0, MAX_VISIBLE).map((m, i) => (
                            <EventChip key={m.id || i} meeting={m} onClick={setSelectedMeeting} compact />
                          ))}
                          {extra > 0 && <p className="text-[10px] text-[#6264A7] font-semibold px-1">+{extra} more</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── WEEK VIEW ─── */}
            {viewMode === "week" && (
              <div className="min-h-full flex flex-col">
                <div className="grid grid-cols-8 bg-white border-b border-gray-100 sticky top-0 z-10 flex-shrink-0 shadow-sm">
                  <div className="py-3 px-2 border-r border-gray-100" />
                  {weekDays.map((d, i) => {
                    const isToday2 = sameDay(d, new Date());
                    return (
                      <div key={i} onClick={() => { setCurrentDate(d); setViewMode("day"); }}
                        className={`py-3 text-center border-r border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors`}>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{DAYS[d.getDay()]}</p>
                        <div className={`text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full mt-0.5
                          ${isToday2 ? "bg-[#6264A7] text-white shadow-sm" : "text-gray-800"}`}>
                          {d.getDate()}
                        </div>
                        {getMeetingsForDate(d).length > 0 && !isToday2 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6264A7] mx-auto mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex-1 grid grid-cols-8" style={{ minHeight: "960px" }}>
                  <div className="border-r border-gray-100 bg-white">
                    {WEEK_HOURS.map((h) => (
                      <div key={h} className="h-10 flex items-start justify-end pr-2 border-b border-gray-50">
                        <span className="text-[10px] text-gray-400 leading-none mt-0.5">
                          {h === 0 ? "" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {weekDays.map((d, di) => {
                    const dayMtgs  = getMeetingsForDate(d);
                    const isToday2 = sameDay(d, new Date());
                    return (
                      <div key={di} className={`relative border-r border-gray-100 ${isToday2 ? "bg-[#6264A7]/5" : "bg-white"}`}>
                        {WEEK_HOURS.map((h) => <div key={h} className="h-10 border-b border-gray-50" />)}
                        {dayMtgs.map((m, mi) => {
                          const color = getColor(colorIdxFromId(m.id));
                          const from  = new Date(m.from);
                          const to    = new Date(m.to);
                          const topPct    = ((from.getHours() * 60 + from.getMinutes()) / (24 * 60)) * 100;
                          const dur       = Math.max(20, (to - from) / 60000);
                          const heightPct = (dur / (24 * 60)) * 100;
                          return (
                            <button key={mi} onClick={() => setSelectedMeeting(m)}
                              style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                              className={`absolute inset-x-1 rounded-lg px-1.5 py-0.5 text-left overflow-hidden border shadow-sm hover:shadow-md hover:-translate-y-px transition-all z-10 ${color.light}`}>
                              <p className="text-[10px] font-bold truncate">{m.title}</p>
                              <p className="text-[9px] opacity-70">{fmtTime(m.from)}</p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── DAY VIEW ─── */}
            {viewMode === "day" && (
              <div className="min-h-full flex flex-col bg-white">
                <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold
                      ${sameDay(currentDate, new Date()) ? "bg-[#6264A7] text-white shadow-lg" : "bg-gray-100 text-gray-800"}`}>
                      {currentDate.getDate()}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {DAYS[currentDate.getDay()]}, {MONTHS[currentDate.getMonth()]} {currentDate.getDate()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {getMeetingsForDate(currentDate).length} event{getMeetingsForDate(currentDate).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 relative" style={{ minHeight: "960px" }}>
                  {WEEK_HOURS.map((h) => (
                    <div key={h} className="absolute w-full h-10 border-b border-gray-50 flex items-start"
                      style={{ top: `${(h / 24) * 100}%` }}>
                      <span className="text-[10px] text-gray-400 w-14 text-right pr-3 flex-shrink-0 leading-none mt-0.5">
                        {h === 0 ? "" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`}
                      </span>
                      <div className="flex-1 border-l border-gray-100" />
                    </div>
                  ))}

                  {getMeetingsForDate(currentDate).map((m, mi) => {
                    const color     = getColor(colorIdxFromId(m.id));
                    const from      = new Date(m.from);
                    const to        = new Date(m.to);
                    const topPct    = ((from.getHours() * 60 + from.getMinutes()) / (24 * 60)) * 100;
                    const dur       = Math.max(30, (to - from) / 60000);
                    const heightPct = (dur / (24 * 60)) * 100;
                    return (
                      <button key={mi} onClick={() => setSelectedMeeting(m)}
                        style={{ top: `${topPct}%`, height: `${heightPct}%`, left: "64px", right: "24px" }}
                        className={`absolute rounded-xl px-4 py-2 text-left overflow-hidden border-l-4 shadow-md hover:shadow-lg hover:-translate-y-px transition-all z-10 ${color.light}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{m.title}</p>
                            <p className="text-xs opacity-70 mt-0.5">
                              {fmtTime(from)} – {fmtTime(to)} · {meetingDuration(from, to)}
                            </p>
                            {m.location && !m.location.startsWith("https://") && (
                              <p className="text-xs opacity-60 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5" />{m.location}
                              </p>
                            )}
                          </div>
                          {m.isOnlineMeeting && (
                            <div className="p-1 bg-current/10 rounded flex-shrink-0"><Video className="w-3.5 h-3.5" /></div>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {getMeetingsForDate(currentDate).length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ top: "200px" }}>
                      <Calendar className="w-12 h-12 text-gray-200 mb-3" />
                      <p className="text-gray-400 text-sm">No events for this day</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MEETING DETAIL PANEL ── */}
      {selectedMeeting && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedMeeting(null)} />
          <MeetingDetailPanel meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />
        </>
      )}
    </div>
  );
}
