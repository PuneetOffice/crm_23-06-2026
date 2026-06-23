import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import { clearMsalCache } from "../auth/msalConfig";
/* ─── Inline SVG icon components (replaces lucide-react) ──────── */
const _S = (paths, filled) => {
  const Comp = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className||"w-4 h-4"}
      viewBox="0 0 24 24" fill={filled?"currentColor":"none"}
      stroke={filled?"none":"currentColor"} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d,i)=><path key={i} d={d}/>)}
    </svg>
  );
  return Comp;
};
const Search       = _S(["M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"]);
const Send         = _S(["M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"]);
const Bell         = _S(["M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"]);
const Users        = _S(["M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"]);
const Video        = _S(["M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"]);
const Calendar     = _S(["M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"]);
const PhoneCall    = _S(["M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"]);
const MoreVertical = _S(["M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z"],true);
const Clock        = _S(["M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"]);
const MapPin       = _S(["M15 10.5a3 3 0 11-6 0 3 3 0 016 0z","M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"]);
const X            = _S(["M6 18L18 6M6 6l12 12"]);
const MessageSquare= _S(["M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"]);
const ChevronLeft  = _S(["M15.75 19.5L8.25 12l7.5-7.5"]);
const ChevronRight = _S(["M8.25 4.5l7.5 7.5-7.5 7.5"]);
const Smile        = _S(["M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm5.25 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z"]);
const Paperclip    = _S(["M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"]);
const Settings     = _S(["M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z","M15 12a3 3 0 11-6 0 3 3 0 016 0z"]);
const RefreshCw    = _S(["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"]);
const AlertCircle  = _S(["M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"]);
const Globe        = _S(["M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"]);
const Check        = _S(["M4.5 12.75l6 6 9-13.5"]);
const Copy         = _S(["M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"]);
// Home icon removed (unused)
const Plus         = _S(["M12 4.5v15m7.5-7.5h-15"]);
const DotSquare    = _S(["M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"]);
const Hash         = _S(["M5.25 8.25h13.5M5.25 12h13.5M10.5 3.75L9 20.25M15 3.75l-1.5 16.5"]);
const BookOpen     = _S(["M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"]);
const Layers       = _S(["M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"]);
const ExternalLink = _S(["M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"]);
const VolumeX      = _S(["M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"]);
const Puzzle       = _S(["M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"]);
const Share2       = _S(["M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"]);
const EyeOff       = _S(["M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"]);
const Link2        = _S(["M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"]);
const Download     = _S(["M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"]);
const Bookmark     = _S(["M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"]);
const Trash2       = _S(["M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"]);
const Pin          = _S(["M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"]);
const Mail         = _S(["M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"]);
const MoreHorizontal=_S(["M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"],true);
const Pencil       = _S(["M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"]);
const Lightbulb    = _S(["M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"]);
const Repeat2      = _S(["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"]);
const Sparkles     = _S(["M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"]);
const FolderOpen   = _S(["M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"]);
const AtSign       = _S(["M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25"]);
const FileText     = _S(["M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"]);
const Mic          = _S(["M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"]);
const MicOff       = _S(["M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z","M3 3l18 18"]);
const VideoOff     = _S(["M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z","M3 3l18 18"]);
const PhoneOff     = _S(["M20.25 3.75a.75.75 0 00-1.06 0l-16.5 16.5a.75.75 0 101.06 1.06l16.5-16.5a.75.75 0 000-1.06z","M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"]);
const Volume2      = _S(["M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"]);
const Lock         = _S(["M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"]);
const ChevronDown  = _S(["M19.5 8.25l-7.5 7.5-7.5-7.5"]);

const CheckSquare  = _S(["M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11","M9 11l3 3 9-9"]);
const Eye          = _S(["M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z","M15 12a3 3 0 11-6 0 3 3 0 016 0z"]);
const LogOut       = _S(["M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"]);
const Tag          = _S(["M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z","M6 6h.008v.008H6V6z"]);

/* ─── Graph API scopes ─────────────────────────────────────────── */
const TEAMS_SCOPES = [
  "https://graph.microsoft.com/User.Read",
  "https://graph.microsoft.com/User.ReadBasic.All",
  // Chat (delegated)
  "https://graph.microsoft.com/Chat.ReadWrite",
  "https://graph.microsoft.com/ChatMessage.Send",
  // Teams & Channels — delegated only (TeamSettings.*.All and ChannelMessage.Read.All are application-only)
  "https://graph.microsoft.com/Team.ReadBasic.All",
  "https://graph.microsoft.com/Channel.ReadBasic.All",
  "https://graph.microsoft.com/ChannelSettings.Read.All",
  "https://graph.microsoft.com/ChannelSettings.ReadWrite.All",
  "https://graph.microsoft.com/ChannelMessage.Send",
  // Meetings & Presence
  "https://graph.microsoft.com/OnlineMeetings.Read",
  "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
  "https://graph.microsoft.com/Presence.Read",
  // Calendar & Files
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "https://graph.microsoft.com/Files.Read",
  "https://graph.microsoft.com/Files.ReadWrite",
  "https://graph.microsoft.com/Sites.Read.All",
  // People & Contacts
  "https://graph.microsoft.com/People.Read",
  "https://graph.microsoft.com/Contacts.Read",
];

/* ─── helpers ─────────────────────────────────────────────────── */
function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d), now = new Date();
  if (dt.toDateString() === now.toDateString()) return fmtTime(d);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dt.toDateString() === y.toDateString()) return "Yesterday";
  return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}
function fmtMeetingDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function fmtMeetingTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function meetingDuration(from, to) {
  if (!from || !to) return "";
  const mins = Math.round((new Date(to) - new Date(from)) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function groupMeetings(meetings) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tmrw  = new Date(today); tmrw.setDate(today.getDate() + 1);
  const week  = new Date(today); week.setDate(today.getDate() + 7);
  const groups = { Past: [], Today: [], Tomorrow: [], "This Week": [], Later: [] };
  [...meetings]
    .sort((a, b) => new Date(a.from) - new Date(b.from))
    .forEach((m) => {
      const day = new Date(new Date(m.from).setHours(0, 0, 0, 0));
      if (day < today)                          groups.Past.push(m);
      else if (day.getTime() === today.getTime()) groups.Today.push(m);
      else if (day.getTime() === tmrw.getTime()) groups.Tomorrow.push(m);
      else if (day <= week)                     groups["This Week"].push(m);
      else                                      groups.Later.push(m);
    });
  return groups;
}

// Normalize a Graph API calendar event into a flat display object
function normalizeGraphEvent(ev) {
  const attendeeList = (ev.attendees || [])
    .map((a) => {
      const name = a.emailAddress?.name || "";
      const addr = a.emailAddress?.address || "";
      return name && name !== addr ? `${name} <${addr}>` : addr;
    })
    .filter(Boolean)
    .join(", ");
  const rawBody   = ev.body?.content || ev.bodyPreview || "";
  const plainBody = rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const parseGDate = (dt, tz) => (!dt ? null : tz === "UTC" ? dt.replace(/Z?$/, "Z") : dt);
  return {
    id:            ev.id,
    title:         ev.subject || "(No title)",
    from:          parseGDate(ev.start?.dateTime, ev.start?.timeZone),
    to:            parseGDate(ev.end?.dateTime,   ev.end?.timeZone),
    timeZone:      ev.start?.timeZone || "UTC",
    location:      ev.location?.displayName || "",
    description:   plainBody.slice(0, 600),
    attendees:     attendeeList,
    isOnlineMeeting: ev.isOnlineMeeting || false,
    teamsJoinUrl:  ev.onlineMeeting?.joinUrl || ev.onlineMeetingUrl || "",
    organizer:     ev.organizer?.emailAddress?.address || "",
  };
}

/* ─── MeetingCard ─────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function MeetingCard({ meeting, isSelected, onClick }) {
  const isPast = meeting.from && new Date(meeting.from) < new Date();
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-white/8 transition-all duration-150 relative
        ${isSelected ? "bg-[#6264A7]/30 border-l-4 border-l-[#6264A7]" : "hover:bg-white/5 border-l-4 border-l-transparent"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
          <div className={`w-2.5 h-2.5 rounded-full ${meeting.isOnlineMeeting ? "bg-[#6264A7]" : "bg-blue-400"}`} />
          <div className="w-px flex-1 min-h-[2rem] bg-white/10 mt-1" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-medium truncate leading-tight ${isPast ? "text-white/50" : "text-white"}`}>
            {meeting.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3 h-3 text-white/40 flex-shrink-0" />
            <span className="text-[11px] text-white/50">
              {fmtMeetingTime(meeting.from)}
              {meeting.to ? ` – ${fmtMeetingTime(meeting.to)}` : ""}
              {meeting.from && meeting.to ? ` · ${meetingDuration(meeting.from, meeting.to)}` : ""}
            </span>
          </div>
          {meeting.location && !meeting.location.startsWith("https://") && (
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
              <span className="text-[11px] text-white/40 truncate">{meeting.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {meeting.isOnlineMeeting && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#6264A7]/40 text-[#c7c9f3] rounded text-[10px]">
                <Video className="w-2.5 h-2.5" /> Teams
              </span>
            )}
            {isPast && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-white/10 text-white/40 rounded text-[10px]">Past</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── MeetingDetail ───────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function MeetingDetail({ meeting, onClose }) {
  if (!meeting) return null;
  return (
    <div className="h-full flex flex-col bg-[#1e1e2e] text-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#6264A7]/30 to-[#464775]/20">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${meeting.isOnlineMeeting ? "bg-[#6264A7]/40" : "bg-blue-500/30"}`}>
            {meeting.isOnlineMeeting ? <Video className="w-5 h-5 text-[#c7c9f3]" /> : <Calendar className="w-5 h-5 text-blue-300" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white leading-tight">{meeting.title}</h3>
            <p className="text-xs text-white/50">{fmtMeetingDate(meeting.from)}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 teams-scrollbar">
        {/* Schedule */}
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <h4 className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Schedule</h4>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-[#6264A7] flex-shrink-0" />
            <div>
              <p className="text-sm text-white">{fmtMeetingDate(meeting.from)}</p>
              <p className="text-xs text-white/60">
                {fmtMeetingTime(meeting.from)}
                {meeting.to ? ` – ${fmtMeetingTime(meeting.to)}` : ""}
                {meeting.from && meeting.to ? ` · ${meetingDuration(meeting.from, meeting.to)}` : ""}
              </p>
            </div>
          </div>
          {meeting.timeZone && (
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-white/30 flex-shrink-0" />
              <p className="text-xs text-white/50">{meeting.timeZone}</p>
            </div>
          )}
        </div>

        {/* Join / Location */}
        {(meeting.isOnlineMeeting || (meeting.location && !meeting.location.startsWith("https://"))) && (
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Join</h4>
            {meeting.isOnlineMeeting && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#6264A7]/40 rounded-lg"><Video className="w-4 h-4 text-[#c7c9f3]" /></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Microsoft Teams Meeting</p>
                  <p className="text-xs text-[#8385c7]">Online meeting</p>
                </div>
                {meeting.teamsJoinUrl ? (
                  <a href={meeting.teamsJoinUrl} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-lg text-xs text-white font-medium transition-colors shadow">
                    Join
                  </a>
                ) : (
                  <span className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-white/40 cursor-not-allowed">No link</span>
                )}
              </div>
            )}
            {meeting.location && !meeting.location.startsWith("https://") && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-white/40 flex-shrink-0" />
                <p className="text-sm text-white/80">{meeting.location}</p>
              </div>
            )}
          </div>
        )}

        {/* Attendees */}
        {meeting.attendees && (
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Attendees</h4>
            <div className="flex flex-wrap gap-2">
              {String(meeting.attendees).split(/[,;]+/).filter(Boolean).map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                  <div className="w-5 h-5 rounded-full bg-[#6264A7]/60 flex items-center justify-center text-[9px] text-white font-medium">
                    {a.trim().charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-white/70">{a.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizer */}
        {meeting.organizer && (
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Organizer</h4>
            <p className="text-sm text-white/70">{meeting.organizer}</p>
          </div>
        )}

        {/* Description */}
        {meeting.description && (
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Description</h4>
            <p className="text-sm text-white/70 leading-relaxed">{meeting.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CallCard ────────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function CallCard({ call, isSelected, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-white/8 transition-all duration-150 relative
        ${isSelected ? "bg-[#6264A7]/30 border-l-4 border-l-[#6264A7]" : "hover:bg-white/5 border-l-4 border-l-transparent"}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#6264A7]/30 flex items-center justify-center flex-shrink-0">
          <Video className="w-4 h-4 text-[#c7c9f3]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white/80 font-medium truncate">{call.title}</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {fmtMeetingDate(call.from)} · {fmtMeetingTime(call.from)}
            {call.from && call.to ? ` · ${meetingDuration(call.from, call.to)}` : ""}
          </p>
        </div>
        <Check className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0" />
      </div>
    </button>
  );
}

/* ─── AuthImage — fetches Teams hosted-content images with Bearer token ─── */
function AuthImage({ src, accessToken, isOwn, onDeleteMessage, messageId, onPreview }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const menuLeaveTimeout = useRef(null);

  useEffect(() => {
    if (!src || !accessToken) { setLoading(false); return; }
    let objectUrl = null;
    window.fetch(src, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setBlobUrl(objectUrl); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, accessToken]);

  useEffect(() => {
    return () => {
      window.clearTimeout(menuLeaveTimeout.current);
    };
  }, []);

  const handleAction = async (action) => {
    const payload = blobUrl || src;
    try {
      if (action === "open") {
        if (payload) window.open(payload, "_blank");
        return;
      }
      if (action === "copy") {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload);
        } else {
          const ta = document.createElement("textarea");
          ta.value = payload;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setStatus("Image link copied.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "forward") {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload);
        } else {
          const ta = document.createElement("textarea");
          ta.value = payload;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setStatus("Forward data copied. Paste in a chat.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "share") {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload);
        } else {
          const ta = document.createElement("textarea");
          ta.value = payload;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setStatus("Ready to share in Outlook.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "pin") {
        setStatus("Pinned for everyone.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "unread") {
        setStatus("Marked as unread.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "translate") {
        setStatus("Translate option selected.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "more") {
        setStatus("More actions available.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
      if (action === "delete" && isOwn) {
        onDeleteMessage?.(messageId);
        setStatus("Message removed.");
        window.setTimeout(() => setStatus(""), 2400);
        return;
      }
    } catch {
      setStatus("Action failed.");
      window.setTimeout(() => setStatus(""), 2400);
    }
  };

  if (loading) return <div className="w-24 h-12 bg-white/10 rounded-lg animate-pulse mt-1" />;
  if (failed || !blobUrl) return (
    <span className="text-[11px] text-white/30 italic mt-1 block">Image unavailable</span>
  );
  return (
    <div className="relative mt-1" onMouseEnter={() => {
      window.clearTimeout(menuLeaveTimeout.current);
      setMenuOpen(true);
    }} onMouseLeave={() => {
      window.clearTimeout(menuLeaveTimeout.current);
      menuLeaveTimeout.current = window.setTimeout(() => setMenuOpen(false), 150);
    }}>
      <img src={blobUrl} alt="media"
        className="max-w-full max-h-52 rounded-lg cursor-pointer object-contain border border-white/10"
        onClick={() => onPreview ? onPreview({ type: "image", url: blobUrl, name: "Image" }) : window.open(blobUrl, "_blank")}
        title="Click to preview"
      />
      {menuOpen && (
        <div
          className="absolute right-2 top-2 w-52 rounded-xl border border-white/10 bg-[#11121a] shadow-xl text-left z-20"
          onMouseEnter={() => {
            window.clearTimeout(menuLeaveTimeout.current);
            setMenuOpen(true);
          }}
          onMouseLeave={() => {
            window.clearTimeout(menuLeaveTimeout.current);
            menuLeaveTimeout.current = window.setTimeout(() => setMenuOpen(false), 150);
          }}>
          <button type="button" onClick={() => handleAction("open")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Open</button>
          <button type="button" onClick={() => handleAction("forward")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Forward</button>
          <button type="button" onClick={() => handleAction("copy")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Copy link</button>
          <button type="button" onClick={() => handleAction("share")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Share to Outlook</button>
          <button type="button" onClick={() => handleAction("pin")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Pin for everyone</button>
          <button type="button" onClick={() => handleAction("unread")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Mark as unread</button>
          <button type="button" onClick={() => handleAction("translate")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">Translate</button>
          <button type="button" onClick={() => handleAction("more")}
            className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10">More actions</button>
          {isOwn && (
            <button type="button" onClick={() => handleAction("delete")}
              className="w-full text-left px-3 py-2 text-xs text-rose-300 hover:bg-white/10">Delete</button>
          )}
        </div>
      )}
      {status && <div className="text-[10px] text-white/50 mt-1">{status}</div>}
    </div>
  );
}

/* ─── ChatBubble ──────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function ChatBubble({ msg, isOwn, accessToken, onDeleteMessage, onPreview }) {
  const [copied, setCopied] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState(null);
  const [attachmentStatus, setAttachmentStatus] = useState("");
  const attachmentLeaveTimeout = useRef(null);

  const rawContent  = msg.body?.content || "";
  const contentType = msg.body?.contentType || "text";

  // Extract src URLs of inline images from HTML body for auth-fetched rendering
  const imgSrcs = useMemo(() => {
    if (contentType !== "html" || !/<img\s/i.test(rawContent)) return [];
    try {
      const doc = new DOMParser().parseFromString(rawContent, "text/html");
      return Array.from(doc.querySelectorAll("img"))
        .map((el) => el.getAttribute("src") || "")
        .filter((s) => s.startsWith("https://"));
    } catch { return []; }
  }, [rawContent, contentType]);

  // Text — strip tags, preserve newlines, decode HTML entities
  const text = useMemo(() => {
    if (!rawContent) return "";
    return rawContent
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi,  "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g,  " ")
      .replace(/&amp;/g,   "&")
      .replace(/&lt;/g,    "<")
      .replace(/&gt;/g,    ">")
      .replace(/&quot;/g,  '"')
      .replace(/&#39;/g,   "'")
      .replace(/\n{3,}/g,  "\n\n")
      .trim();
  }, [rawContent]);

  // Attachments — show all real files; skip system card types and bare message references
  const fileAttachments = useMemo(() =>
    (msg.attachments || []).filter((a) => {
      if (!a.contentType) return false;
      if (a.contentType === "messageReference") return false;
      if (a.contentType.startsWith("application/vnd.microsoft.card")) return false;
      return true; // includes "reference" (OneDrive/SharePoint), images, etc.
    }),
  [msg.attachments]);

  const hasContent = text || imgSrcs.length > 0 || fileAttachments.length > 0;
  const sender     = msg.from?.user?.displayName || "Unknown";
  const time       = fmtTime(msg.createdDateTime);

  const handleCopy = () => {
    if (!text) return;
    // Try modern clipboard API first, fall back to execCommand for older browsers
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  };
  const fallbackCopy = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity  = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const showAttachmentStatus = (message) => {
    setAttachmentStatus(message);
    window.clearTimeout(window.teamsAttachmentStatusTimeout);
    window.teamsAttachmentStatusTimeout = window.setTimeout(() => setAttachmentStatus(""), 2400);
  };

  const copyPayload = async (payload) => {
    if (!payload) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
    } else {
      const ta = document.createElement("textarea");
      ta.value = payload;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const handleAttachmentAction = async (action, attachment) => {
    setActiveAttachment(null);
    const url = attachment?.contentUrl || attachment?.content?.contentUrl || rawContent || attachment?.name || "";
    try {
      if (action === "open") {
        if (url) window.open(url, "_blank");
        return;
      }
      if (action === "download") {
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = attachment?.name || "file";
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        showAttachmentStatus("Download started.");
        return;
      }
      if (action === "copy") {
        await copyPayload(url);
        showAttachmentStatus("Link copied.");
        return;
      }
      if (action === "forward") {
        await copyPayload(url);
        showAttachmentStatus("Forward info copied. Paste in a chat.");
        return;
      }
      if (action === "share") {
        await copyPayload(url);
        showAttachmentStatus("Ready to share in Outlook.");
        return;
      }
      if (action === "pin") {
        showAttachmentStatus("Pinned for everyone.");
        return;
      }
      if (action === "unread") {
        showAttachmentStatus("Marked as unread.");
        return;
      }
      if (action === "translate") {
        showAttachmentStatus("Translate option selected.");
        return;
      }
      if (action === "more") {
        showAttachmentStatus("More actions available.");
        return;
      }
      if (action === "delete" && isOwn) {
        onDeleteMessage?.(msg.id);
        showAttachmentStatus("Message removed.");
        return;
      }
    } catch {
      showAttachmentStatus("Action failed.");
    }
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {!isOwn && (
          <span className="text-[10px] text-white/40 px-1 ml-1">{sender}</span>
        )}

        <div className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm
          ${isOwn
            ? "bg-[#6264A7] text-white rounded-tr-sm"
            : "bg-white/10 text-white rounded-tl-sm border border-white/10"}`}>

          {/* Copy button — floats inside bubble top-right on hover */}
          {text && (
            <button onClick={handleCopy} title={copied ? "Copied!" : "Copy"}
              className={`absolute -top-2 ${isOwn ? "-left-7" : "-right-7"}
                opacity-0 group-hover:opacity-100 transition-opacity
                p-1 rounded-md shadow
                ${isOwn ? "bg-[#4a4c8a] hover:bg-[#5a5ca0]" : "bg-[#2a2a3e] hover:bg-[#3a3a50]"}
                text-white/60 hover:text-white`}>
              {copied
                ? <Check className="w-3 h-3 text-emerald-400" />
                : <Copy className="w-3 h-3" />}
            </button>
          )}

          {/* Plain / formatted text — explicitly selectable */}
          {text && (
            <span className="whitespace-pre-wrap break-words select-text cursor-text text-white">{text}</span>
          )}

          {/* Inline images (auth-fetched from Graph hosted content) */}
          {imgSrcs.map((src, i) => (
            <AuthImage key={i} src={src} accessToken={accessToken} isOwn={isOwn} onDeleteMessage={onDeleteMessage} messageId={msg.id} onPreview={onPreview} />
          ))}

          {/* File attachments (OneDrive/SharePoint references, direct uploads) */}
          {fileAttachments.map((att, i) => {
            const attachId = att.id || `${att.contentUrl || att.name || "attachment"}-${i}`;
            const canOpen = Boolean(att.contentUrl);
            return (
              <div
                key={attachId}
                className="relative"
                onMouseEnter={() => {
                  window.clearTimeout(attachmentLeaveTimeout.current);
                  setActiveAttachment(attachId);
                }}
                onMouseLeave={() => {
                  window.clearTimeout(attachmentLeaveTimeout.current);
                  attachmentLeaveTimeout.current = window.setTimeout(() => setActiveAttachment(null), 150);
                }}>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && canOpen && window.open(att.contentUrl, "_blank")}
                  onClick={() => canOpen && window.open(att.contentUrl, "_blank")}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs mt-1.5 transition-colors cursor-pointer
                    ${isOwn ? "bg-white/15 hover:bg-white/25" : "bg-white/8 border border-white/10 hover:bg-white/15"}`}>
                  <Paperclip className="w-3 h-3 opacity-60 flex-shrink-0" />
                  <span className="truncate max-w-[180px] font-medium">{att.name || "Attachment"}</span>
                  <span className="opacity-40 text-[10px] flex-shrink-0 ml-auto">{canOpen ? "↗" : ""}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAttachment(activeAttachment === attachId ? null : attachId); }}
                    className="p-2 rounded-lg hover:bg-white/15 text-white/70 hover:text-white transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                {activeAttachment === attachId && (
                  <div
                    className="absolute right-2 top-1 w-48 rounded-xl border border-white/10 bg-[#1a1b2e] shadow-2xl text-left z-20 overflow-hidden"
                    onMouseEnter={() => {
                      window.clearTimeout(attachmentLeaveTimeout.current);
                      setActiveAttachment(attachId);
                    }}
                    onMouseLeave={() => {
                      window.clearTimeout(attachmentLeaveTimeout.current);
                      attachmentLeaveTimeout.current = window.setTimeout(() => setActiveAttachment(null), 150);
                    }}>
                    <button type="button" onClick={() => handleAttachmentAction("open", att)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-white/90 hover:bg-white/10 transition-colors">
                      <Globe className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                      Open in Browser
                    </button>
                    <button type="button" onClick={() => handleAttachmentAction("download", att)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-white/90 hover:bg-white/10 transition-colors">
                      <Download className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                      Download
                    </button>
                    <button type="button" onClick={() => handleAttachmentAction("share", att)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-white/90 hover:bg-white/10 transition-colors">
                      <Share2 className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                      Share
                    </button>
                    <button type="button" onClick={() => handleAttachmentAction("copy", att)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-white/90 hover:bg-white/10 transition-colors">
                      <Link2 className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                      Copy link
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {attachmentStatus && (
            <div className="text-[10px] text-white/60 mt-1">{attachmentStatus}</div>
          )}

          {!hasContent && (
            <span className="italic text-white/30 text-xs">Media message</span>
          )}
        </div>

        <div className="flex items-center justify-between px-1 gap-2">
          <span className="text-[10px] text-white/30">{time}</span>
          {isOwn && (
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <Check className="w-3 h-3" /> Delivered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ActivityItem ────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function ActivityItem({ icon: Icon, color, title, sub, time }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5">
      <div className={`p-2 rounded-xl flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/90 font-medium leading-snug">{title}</p>
        {sub && <p className="text-[11px] text-white/40 mt-0.5 truncate">{sub}</p>}
      </div>
      {time && <span className="text-[10px] text-white/30 flex-shrink-0 pt-0.5">{time}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT — full enterprise Teams-like workspace        */
/* ═══════════════════════════════════════════════════════════════ */
export default function TeamsView() {
  const { instance, accounts } = useMsal();
  const isMsalConnected = accounts.length > 0;
  const messagesEndRef = useRef(null);

  /* ── state ── */
  const [section, setSection] = useState("chat");
  const [userStatus, setUserStatus] = useState(null); // null = no manual override, use Graph data

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [readMessages] = useState(new Set());
  const [chatUnreadCounts, setChatUnreadCounts] = useState({});
  const [chatPreviews, setChatPreviews] = useState({});
  const [activeTab, setActiveTab] = useState("chat"); // "chat", "shared", or "storyline"
  const [chatFilter, setChatFilter] = useState("chats"); // "unread", "channels", "chats", "meeting"
  const [expandedSections, setExpandedSections] = useState({
    quickViews: true,
    favorites: true,
    chats: true,
    teamsChannels: false,
  });
  const [fileMenuPos, setFileMenuPos]   = useState(null); // {x,y,file} — Files section
  const [attMenuPos, setAttMenuPos]     = useState(null); // {x,y,att,url} — message attachments
  const [fileHover, setFileHover]       = useState(null); // {x,y,file}
  const fileHoverTimer = useRef(null);
  const [favoriteChats, setFavoriteChats] = useState(new Set());
  const [mutedChats, setMutedChats] = useState(new Set());
  const [hiddenChats, setHiddenChats] = useState(new Set());

  /* ── new section state ── */
  const [msgReactions, setMsgReactions]   = useState({});
  /* ── Calls UI state ── */
  const [callsHistoryFilter, setCallsHistoryFilter] = useState("all");
  const [callsFilterDropdown, setCallsFilterDropdown] = useState(false);
  const [speedDialContacts, setSpeedDialContacts]   = useState([]);
  const [selectedCall, setSelectedCall]             = useState(null);
  const [callContextMenu, setCallContextMenu]       = useState(null); // { item, x, y }
  const [callQuickMsg,  setCallQuickMsg]            = useState("");
  const [showAddSpeedDial, setShowAddSpeedDial]     = useState(false);
  const [callDialInput, setCallDialInput]           = useState("");

  // No mock call history — calls come from Graph API (meetings) only
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFiles, setPendingFiles]   = useState([]);
  const [pendingImages, setPendingImages] = useState([]); // {name, dataUrl, file}
  const fileInputRef  = useRef(null);
  const imageInputRef = useRef(null);
  const composerInputRef = useRef(null);
  const [isRecording, setIsRecording]       = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const recordingTimerRef = useRef(null);
  const [mentionQuery, setMentionQuery]     = useState(null); // null = closed, string = active search
  const [mentionIndex, setMentionIndex]     = useState(0);
  const [mediaPreview, setMediaPreview]     = useState(null); // { type:"image"|"file", url, name }
  const [teamsTab, setTeamsTab]           = useState("all");
  const [expandedTeams, setExpandedTeams] = useState(new Set([1]));
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [filesTab, setFilesTab]           = useState("recent");
  const [copilotQuery, setCopilotQuery]   = useState("");

  /* ── Screen share ── */
  const [isScreenSharing,   setIsScreenSharing]   = useState(false);
  const [screenShareError,  setScreenShareError]  = useState("");
  const [screenShareMinimized, setScreenShareMinimized] = useState(false);
  const screenStreamRef  = useRef(null);
  const screenVideoRef   = useRef(null);

  const startScreenShare = useCallback(async () => {
    setScreenShareError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", displaySurface: "monitor" },
        audio: true,
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      setScreenShareMinimized(false);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopScreenShare();
      });
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        setScreenShareError("Could not start screen sharing: " + err.message);
      }
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    setIsScreenSharing(false);
    setScreenShareError("");
  }, []);

  /* ── Call helpers ── */
  const fmtCallDur = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const endCall = useCallback(() => {
    clearTimeout(callRingTimerRef.current);
    clearInterval(callTimerRef.current);
    setCallLocalStream(prev => { prev?.getTracks().forEach(t => t.stop()); return null; });
    if (callLocalVideoRef.current) callLocalVideoRef.current.srcObject = null;
    setCallModal(null);
    setCallDuration(0);
  }, []);

  const startCall = useCallback(async (type, contact) => {
    endCall();
    const initials = (contact || "?").charAt(0).toUpperCase();
    setCallModal({ type, contact: contact || "Unknown", initials, phase: "calling" });
    setCallMuted(false); setCallCamOff(false); setCallSpeakerOff(false);
    setCallDuration(0); setCallMinimized(false);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: type === "video", audio: true });
      setCallLocalStream(stream);
    } catch { /* permission denied */ }
    callRingTimerRef.current = setTimeout(() => {
      setCallModal(p => p ? { ...p, phase: "ringing" } : null);
      callRingTimerRef.current = setTimeout(() => {
        setCallModal(p => p ? { ...p, phase: "connected" } : null);
        callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
      }, 2500);
    }, 1500);
  }, [endCall]);

  const toggleCallMic = useCallback(() => {
    setCallMuted(m => {
      const next = !m;
      setCallLocalStream(s => { s?.getAudioTracks().forEach(t => { t.enabled = !next; }); return s; });
      return next;
    });
  }, []);

  const toggleCallCam = useCallback(() => {
    setCallCamOff(c => {
      const next = !c;
      setCallLocalStream(s => { s?.getVideoTracks().forEach(t => { t.enabled = !next; }); return s; });
      return next;
    });
  }, []);

  const [copilotHistory, setCopilotHistory] = useState([
    { id: 1, role: "ai", text: "Hi! I'm Copilot. I can summarize conversations, draft messages, create meeting notes, find files, and more. How can I help?" }
  ]);

  /* ── Tasks ── */
  const [tasks, setTasks] = useState([]);
  const [taskList,         setTaskList]         = useState("all");
  const [selectedTask,     setSelectedTask]     = useState(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskForm,      setNewTaskForm]      = useState({ title:"", priority:"medium", dueDate:"", notes:"" });

  /* ── Apps ── */
  const [appsSearch,   setAppsSearch]   = useState("");
  const [appsCategory, setAppsCategory] = useState("all");

  /* ── Settings ── */
  const [settingsTab,   setSettingsTab]   = useState("general");
  const [settingsNotifs, setSettingsNotifs] = useState({ mentions:true, replies:true, reactions:true, meetings:true, tasks:true, desktopBanner:true, soundAlerts:true, emailDigest:"daily", dndEnabled:false, dndStart:"22:00", dndEnd:"08:00" });
  const [settingsPrivacy, setSettingsPrivacy] = useState(() => { try { return JSON.parse(localStorage.getItem("teams_priv")||"{}"); } catch { return {}; } });
  const effPrivacy = { readReceipts:true, sharePresence:true, locationSharing:false, diagnosticData:false, allowDMs:true, showInSearch:true, ...settingsPrivacy };
  const savePrivacy = (upd) => { const n={...effPrivacy,...upd}; setSettingsPrivacy(n); try{localStorage.setItem("teams_priv",JSON.stringify(n));}catch{} };
  const [settingsGeneral, setSettingsGeneral] = useState(() => { try { return JSON.parse(localStorage.getItem("teams_gen")||"{}"); } catch { return {}; } });
  const effGeneral = { theme:"dark", language:"en-US", timeFormat:"12h", startupSection:"chat", density:"comfortable", fontSize:"medium", chatBubble:"modern", ...settingsGeneral };
  const saveGeneral = (upd) => { const n={...effGeneral,...upd}; setSettingsGeneral(n); try{localStorage.setItem("teams_gen",JSON.stringify(n));}catch{} };
  const [settingsProfile, setSettingsProfile] = useState(() => { try { return JSON.parse(localStorage.getItem("teams_profile")||"{}"); } catch { return {}; } });
  const effProfile = { displayName:"", statusMsg:"", jobTitle:"", department:"", phone:"", avatarColor:"#6264A7", ...settingsProfile };
  const saveProfile = (upd) => { const n={...effProfile,...upd}; setSettingsProfile(n); try{localStorage.setItem("teams_profile",JSON.stringify(n));}catch{} };
  const [settingsDevices, setSettingsDevices] = useState({ mic:"Default", speaker:"Default", camera:"Default", noiseSuppression:true, echoCancel:true, hdVideo:false });
  const [settingsAccess, setSettingsAccess] = useState({ fontSize:"medium", highContrast:false, reduceMotion:false, screenReader:false, keyboardMode:false });
  const [settingsSaved, setSettingsSaved] = useState(""); // toast message
  const [settingsMicTest, setSettingsMicTest] = useState(false);
  const [settingsMicLevel, setSettingsMicLevel] = useState(0);
  const settingsMicRef = useRef(null);
  const showSettingsSaved = (msg="Settings saved") => { setSettingsSaved(msg); setTimeout(()=>setSettingsSaved(""),2500); };
  const AVATAR_COLORS = ["#6264A7","#e45c8a","#f4a261","#2ec4b6","#059669","#7c3aed","#0891b2","#d97706","#ef4444","#10b981"];

  /* ── Calendar state ── */
  const [calendarView, setCalendarView]           = useState("month");
  const [calendarDate, setCalendarDate]           = useState(new Date());
  const [miniCalDate, setMiniCalDate]             = useState(new Date());
  const [showMiniCalSidebar, setShowMiniCalSidebar] = useState(true);
  const [showCalNewDropdown, setShowCalNewDropdown]   = useState(false);
  const [showCalMeetNowDropdown, setShowCalMeetNowDropdown] = useState(false);
  const [showCalViewDropdown, setShowCalViewDropdown] = useState(false);
  const [showJoinMeetingModal, setShowJoinMeetingModal] = useState(false);
  const [meetingIdInput, setMeetingIdInput]       = useState("");
  const [meetingPasscode, setMeetingPasscode]     = useState("");
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventForm, setNewEventForm]           = useState({ title:"", date:"", startTime:"09:00", endTime:"10:00", allDay:false, online:true, description:"", attendees:"", location:"", agenda:"" });
  const [busyStatus, setBusyStatus]               = useState("Busy");
  const [showBusyDropdown, setShowBusyDropdown]   = useState(false);
  const [reminder, setReminder]                   = useState("15 minutes before");
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);
  const [category, setCategory]                   = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [privacy, setPrivacy]                     = useState("Not private");
  const [showPrivacyDropdown, setShowPrivacyDropdown]   = useState(false);
  const [localCalEvents, setLocalCalEvents]       = useState([]);
  const [teamsPeople, setTeamsPeople]             = useState([]);
  const [chatContacts, setChatContacts]           = useState([]);
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [attendeeSearch, setAttendeeSearch]       = useState("");
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);

  /* ── Message search ── */
  const [showMsgSearch,    setShowMsgSearch]    = useState(false);
  const [msgSearchQuery,   setMsgSearchQuery]   = useState("");
  const [msgSearchResults, setMsgSearchResults] = useState([]);
  const [msgSearchIdx,     setMsgSearchIdx]     = useState(0);
  const msgSearchInputRef = useRef(null);

  const runMsgSearch = useCallback((q, msgs) => {
    if (!q.trim()) { setMsgSearchResults([]); setMsgSearchIdx(0); return; }
    const lower = q.toLowerCase();
    const hits = (msgs || [])
      .map((m, i) => {
        const raw = m.body?.content || "";
        const plain = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (plain.toLowerCase().includes(lower)) return { index: i, msg: m, plain };
        return null;
      })
      .filter(Boolean)
      .reverse(); // newest first
    setMsgSearchResults(hits);
    setMsgSearchIdx(0);
  }, []);

  /* ── Add Participants ── */
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [addPartSearch,  setAddPartSearch]  = useState("");
  const [addPartPicked,  setAddPartPicked]  = useState([]);
  const [addPartLoading, setAddPartLoading] = useState(false);
  const [addPartError,   setAddPartError]   = useState("");
  const [addPartSuccess, setAddPartSuccess] = useState("");

  /* ── Chat header "More actions" menu ── */
  const [showChatMoreMenu,  setShowChatMoreMenu]  = useState(false);
  const [showMoveToSubmenu, setShowMoveToSubmenu] = useState(false);
  const [unreadChats,       setUnreadChats]       = useState(new Set());
  const [copyLinkToast,     setCopyLinkToast]     = useState(false);

  /* ── Call UI ── */
  const [callModal,       setCallModal]       = useState(null);
  // { type:"audio"|"video", contact:string, initials:string, phase:"calling"|"ringing"|"connected" }
  const [callLocalStream, setCallLocalStream] = useState(null);
  const [callMuted,       setCallMuted]       = useState(false);
  const [callCamOff,      setCallCamOff]      = useState(false);
  const [callSpeakerOff,  setCallSpeakerOff]  = useState(false);
  const [callDuration,    setCallDuration]    = useState(0);
  const [callMinimized,   setCallMinimized]   = useState(false);
  const callLocalVideoRef  = useRef(null);
  const callTimerRef       = useRef(null);
  const callRingTimerRef   = useRef(null);

  const EMOJI_LIST = [
    "😀","😂","😍","🥰","😎","🤔","😅","😭","😊","🤯","🥳","😴",
    "👍","👎","❤️","🔥","🎉","✅","⚠️","💡","🚀","💪","🙌","👏",
    "😆","😮","😢","😤","🤝","💯","⭐","🎯","📌","📎","🔗","💼",
  ];

  // Teams and files come from Graph API — no static mock data

  // Derives file style from OneDrive file object (name extension + mimeType)
  const fileStyle = useCallback((file) => {
    const ext = (file?.name || "").split(".").pop()?.toLowerCase() || "";
    const mime = file?.file?.mimeType || "";
    if (["xlsx","xls","csv"].includes(ext) || mime.includes("excel") || mime.includes("spreadsheet"))
      return { bg:"bg-emerald-500/20", text:"text-emerald-400", label:ext.toUpperCase().slice(0,3)||"XLS" };
    if (["docx","doc"].includes(ext) || mime.includes("word"))
      return { bg:"bg-blue-500/20", text:"text-blue-400", label:ext.toUpperCase().slice(0,3)||"DOC" };
    if (ext==="pdf" || mime.includes("pdf"))
      return { bg:"bg-red-500/20", text:"text-red-400", label:"PDF" };
    if (["zip","rar","7z","tar","gz"].includes(ext))
      return { bg:"bg-yellow-500/20", text:"text-yellow-400", label:"ZIP" };
    if (["mp4","mov","avi","mkv","webm"].includes(ext) || mime.includes("video"))
      return { bg:"bg-purple-500/20", text:"text-purple-400", label:"VID" };
    if (["fig"].includes(ext))
      return { bg:"bg-pink-500/20", text:"text-pink-400", label:"FIG" };
    if (["png","jpg","jpeg","gif","svg","webp"].includes(ext) || mime.includes("image"))
      return { bg:"bg-sky-500/20", text:"text-sky-400", label:"IMG" };
    if (["pptx","ppt"].includes(ext) || mime.includes("presentation"))
      return { bg:"bg-orange-500/20", text:"text-orange-400", label:"PPT" };
    if (ext==="txt" || mime.includes("text"))
      return { bg:"bg-white/10", text:"text-white/60", label:"TXT" };
    return { bg:"bg-white/10", text:"text-white/50", label: ext.toUpperCase().slice(0,4)||"FILE" };
  }, []);

  // Format file size bytes → human readable
  const fmtFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    if (bytes < 1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
    return `${(bytes/1024/1024/1024).toFixed(1)} GB`;
  };

  /* ── close emoji picker on outside click ── */
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      if (!e.target.closest("[data-emoji-picker]")) { setShowEmojiPicker(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  const handleCopilotSend = () => {
    if (!copilotQuery.trim()) return;
    const uid = Date.now();
    setCopilotHistory(p => [...p,
      { id: uid,     role: "user", text: copilotQuery },
      { id: uid + 1, role: "ai",   text: `I can help with: "${copilotQuery}". In production I'd connect to your Microsoft 365 data. I can summarize conversations, draft messages, create meeting notes, and search your files.` },
    ]);
    setCopilotQuery("");
  };

  /* ── graph tokens ── */
  const [accessToken, setAccessToken]     = useState("");
  const [calendarToken, setCalendarToken] = useState("");

  /* ── meetings (Graph calendarView) ── */
  const [meetings, setMeetings]               = useState([]);
  const [, setLoadingMeetings] = useState(false);
  const [, setMeetingsError]                   = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingSearch] = useState("");

  /* ── calls (past Teams online meetings from Graph) ── */
  const [calls, setCalls]               = useState([]);
  const [, setLoadingCalls] = useState(false);
  const [, setCallsError]               = useState("");
  const [callSearch] = useState("");

  /* ── chat ── */
  const [chats, setChats]                   = useState([]);
  const [messages, setMessages]             = useState([]);
  const [selectedChat, setSelectedChat]     = useState(null);
  const [chatMembers, setChatMembers]       = useState([]);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [showExtraChips, setShowExtraChips] = useState(false);
  const [message, setMessage]               = useState("");
  const [loadingChats, setLoadingChats]     = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError]   = useState("");
  const [chatError, setChatError]           = useState("");
  const [sendError, setSendError]           = useState("");
  const [hoveredMsgId, setHoveredMsgId]     = useState(null);
  const [msgEmojiPickerFor, setMsgEmojiPickerFor] = useState(null); // msg.id | null
  const [ctxMenu, setCtxMenu] = useState(null); // {x,y,msg,isOwn,msgText}
  const [savedMessages, setSavedMessages]   = useState(new Set());
  const [savedMsgData, setSavedMsgData]     = useState([]); // [{id,msg,msgText,chatId,chatName,savedAt}]
  const [msgToast, setMsgToast]             = useState("");
  const msgToastTimer = useRef(null);
  const [replyTo, setReplyTo]               = useState(null); // {id,sender,text}
  // Quick views
  const [quickView, setQuickView]             = useState(null); // "mentions"|"discover"|"drafts"|"saved"
  const [selectedQuickItem, setSelectedQuickItem] = useState(null);
  const [qvFilter, setQvFilter]               = useState("all"); // filter pill state per quick view
  const [mentionedMsgs, setMentionedMsgs]     = useState([]);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [discoverGroups, setDiscoverGroups]   = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const prevChatIdRef = useRef(null);
  const messageRef    = useRef("");
  const [forwardModal, setForwardModal]     = useState(null); // {msg,msgText}
  const [forwardSearch, setForwardSearch]   = useState("");
  const [forwardingTo, setForwardingTo]     = useState(null);
  const [forwardSending, setForwardSending] = useState(false);
  const [chatMenuOpen, setChatMenuOpen]     = useState(false);
  const [activeChatContextMenu, setActiveChatContextMenu] = useState(null);
  const [chatCtxPos, setChatCtxPos] = useState({ x: 0, y: 0 });

  /* ── Create-channel modal ── */
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [ccTeamId,   setCcTeamId]   = useState("");
  const [ccName,     setCcName]     = useState("");
  const [ccDesc,     setCcDesc]     = useState("");
  const [ccType,     setCcType]     = useState("");
  const [ccCreating, setCcCreating] = useState(false);
  const [ccError,    setCcError]    = useState("");

  /* ── Create-team modal ── */
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [ctName,      setCtName]      = useState("");
  const [ctDesc,      setCtDesc]      = useState("");
  const [ctVisibility,setCtVisibility]= useState("private");
  const [ctChannel,   setCtChannel]   = useState("");
  const [ctCreating,  setCtCreating]  = useState(false);
  const [ctError,     setCtError]     = useState("");

  /* ── Create-section modal ── */
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [csName,     setCsName]     = useState("");
  const [csCreating, setCsCreating] = useState(false);

  /* ── New message panel ── */
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [nmQuery,      setNmQuery]      = useState("");
  const [nmRecipients, setNmRecipients] = useState([]);
  const [nmBody,       setNmBody]       = useState("");
  const [nmSending,    setNmSending]    = useState(false);
  const [chatContextMoveToOpen, setChatContextMoveToOpen] = useState(false);
  // Tracks whether messages have been loaded at least once for the current chat
  // so background polls don't show the loading spinner
  const hasLoadedMsgsRef = useRef(false);
  const deletedMsgIdsRef = useRef(new Set());

  /* ── activity (built from real Graph data) ── */
  const [, setActivities] = useState([]);
  const [realActivity, setRealActivity] = useState([]);
  const [readActivityIds, setReadActivityIds] = useState(new Set());

  const [selectedActivity, setSelectedActivity] = useState(null);

  const markActivityRead = useCallback((id) => {
    setReadActivityIds(prev => { const n = new Set(prev); n.add(id); return n; });
    setRealActivity(prev => prev.map(a => a.id === id ? { ...a, unread: false } : a));
  }, []);

  /* ── graph extra tokens ── */
  const [filesToken, setFilesToken]       = useState("");
  const [teamsApiToken, setTeamsApiToken] = useState("");
  const [peopleToken, setPeopleToken]     = useState("");
  const [presenceToken, setPresenceToken] = useState("");

  /* ── channel messaging ── */
  const [channelMessages, setChannelMessages]     = useState([]);
  const [loadingChannelMsgs, setLoadingChannelMsgs] = useState(false);
  const [channelInput, setChannelInput]           = useState("");

  /* ── presence ── */
  const [userPresence, setUserPresence] = useState(null);

  /* ── OneDrive files ── */
  const [oneDriveFiles, setOneDriveFiles]   = useState([]);
  const [loadingFiles, setLoadingFiles]     = useState(false);
  const [filesError, setFilesError]         = useState("");

  /* ── Joined Teams & Channels ── */
  const [joinedTeams, setJoinedTeams]       = useState([]);
  const [loadingJoinedTeams, setLoadingJoinedTeams] = useState(false);
  const [joinedTeamsError, setJoinedTeamsError] = useState("");
  const [teamChannels, setTeamChannels]     = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});

  /* ── Storyline: real recent messages from chats ── */
  const [storylineItems, setStorylineItems] = useState([]);

  /* ── Unread tracking (persisted in localStorage) ── */
  const lastReadTimesRef = useRef(
    (() => { try { return JSON.parse(localStorage.getItem("teams_lastRead") || "{}"); } catch { return {}; } })()
  );
  const markChatRead = useCallback((chatId) => {
    lastReadTimesRef.current[chatId] = new Date().toISOString();
    try { localStorage.setItem("teams_lastRead", JSON.stringify(lastReadTimesRef.current)); } catch {}
    setChatUnreadCounts(p => ({...p, [chatId]: 0}));
  }, []);

  /* ── Acquire tokens ── */
  // Use accountId string (not the array) so the effect only re-runs when the
  // actual signed-in user changes — not on every MSAL internal state update.
  const accountId = accounts[0]?.localAccountId ?? null;
  const tokenFetchingRef = useRef(false);

  useEffect(() => {
    if (!accountId) {
      // User not signed in — clear tokens; do NOT call ssoSilent here (causes 400s)
      setAccessToken(""); setCalendarToken(""); setFilesToken("");
      setTeamsApiToken(""); setPeopleToken(""); setPresenceToken("");
      tokenFetchingRef.current = false;
      return;
    }
    // Prevent concurrent/duplicate fetches triggered by rapid re-renders
    if (tokenFetchingRef.current) return;
    tokenFetchingRef.current = true;

    const acct = accounts[0];
    const silent = (scopes, setter) =>
      instance.acquireTokenSilent({ account: acct, scopes })
        .then(r => setter(r.accessToken))
        .catch(err => {
          // InteractionRequiredAuthError is expected when consent is needed — skip silently
          // Other errors (invalid_grant, etc.) log a single warning, no retry loop
          if (err?.name !== "InteractionRequiredAuthError") {
            console.warn("[MSAL] Silent token failed for scopes", scopes[0], "—", err?.errorCode || err?.name);
          }
        });

    Promise.allSettled([
      silent(["https://graph.microsoft.com/User.Read","https://graph.microsoft.com/Chat.ReadWrite","https://graph.microsoft.com/ChatMessage.Send"], setAccessToken),
      silent(["https://graph.microsoft.com/OnlineMeetings.Read","https://graph.microsoft.com/OnlineMeetings.ReadWrite"], tok => setAccessToken(prev => prev || tok)),
      silent(["https://graph.microsoft.com/Calendars.ReadWrite"], setCalendarToken),
      silent(["https://graph.microsoft.com/Files.Read","https://graph.microsoft.com/Files.ReadWrite"], setFilesToken),
      silent(["https://graph.microsoft.com/ChannelMessage.Send"], setTeamsApiToken),
      silent(["https://graph.microsoft.com/Contacts.Read"], setPeopleToken),
      silent(["https://graph.microsoft.com/Presence.Read"], setPresenceToken),
    ]).finally(() => { tokenFetchingRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]); // accountId is a stable string — only re-runs on user change

  /* ── Fetch org people + contacts for attendee picker ── */
  useEffect(() => {
    if (!peopleToken) return;
    const fetchPeople = async () => {
      try {
        const headers = { Authorization: `Bearer ${peopleToken}` };

        // /me/contacts only — Contacts.Read is user-delegated, no admin consent needed
        const contactsRes = await window.fetch(
          "https://graph.microsoft.com/v1.0/me/contacts?$top=200&$select=displayName,emailAddresses,jobTitle,companyName&$orderby=displayName",
          { headers }
        );

        const seen = new Set();
        const merged = [];

        if (contactsRes.ok) {
          const d = await contactsRes.json();
          for (const c of (d.value || [])) {
            const email = c.emailAddresses?.[0]?.address;
            if (!email || seen.has(email.toLowerCase())) continue;
            seen.add(email.toLowerCase());
            merged.push({
              name:  c.displayName || email,
              email,
              title: c.jobTitle || c.companyName || "",
              source: "contact",
            });
          }
        }

        setTeamsPeople(merged);
      } catch(e) {}
    };
    fetchPeople();
  }, [peopleToken]);

  /* ── Fetch meetings (Graph calendarView — upcoming 3 months) ── */
  const fetchMeetings = useCallback(async () => {
    if (!calendarToken) return;
    setLoadingMeetings(true);
    setMeetingsError("");
    try {
      const start = new Date(); start.setMonth(start.getMonth() - 1); // 1 month back
      const end   = new Date(); end.setMonth(end.getMonth() + 3);     // 3 months ahead
      const sel   = "id,subject,start,end,location,bodyPreview,body,attendees,isOnlineMeeting,onlineMeeting,organizer";
      const url   = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}&$select=${encodeURIComponent(sel)}&$top=200&$orderby=${encodeURIComponent("start/dateTime asc")}`;
      const resp  = await window.fetch(url, {
        headers: { Authorization: `Bearer ${calendarToken}`, Prefer: 'outlook.timezone="UTC"' },
      });
      if (!resp.ok) throw new Error(`Graph API ${resp.status}`);
      const data = await resp.json();
      const evts = (data.value || []).map(normalizeGraphEvent);
      setMeetings(evts);
      // Build activity feed from recent meetings
      const acts = evts
        .filter((m) => new Date(m.from) > new Date(Date.now() - 7 * 86400000))
        .slice(0, 20)
        .map((m) => ({
          id: m.id, icon: Calendar,
          color: "bg-[#6264A7]/30 text-[#c7c9f3]",
          title: m.title,
          sub: `${fmtMeetingDate(m.from)} · ${m.isOnlineMeeting ? "Teams Meeting" : "Calendar event"}`,
          time: fmtDate(m.from),
        }));
      setActivities(acts);
    } catch (err) {
      setMeetingsError("Failed to load calendar. " + (err?.message || ""));
    } finally {
      setLoadingMeetings(false);
    }
  }, [calendarToken]);

  /* ── Fetch calls (past Teams online meetings from last 90 days) ── */
  const fetchCalls = useCallback(async () => {
    if (!calendarToken) return;
    setLoadingCalls(true);
    setCallsError("");
    try {
      const end   = new Date();
      const start = new Date(); start.setDate(start.getDate() - 90); // last 90 days
      const sel   = "id,subject,start,end,location,bodyPreview,attendees,isOnlineMeeting,onlineMeeting,organizer";
      // calendarView does NOT support $filter — fetch all events in range and filter client-side
      const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}&$select=${encodeURIComponent(sel)}&$top=200&$orderby=${encodeURIComponent("start/dateTime desc")}`;
      const resp = await window.fetch(url, {
        headers: { Authorization: `Bearer ${calendarToken}`, Prefer: 'outlook.timezone="UTC"' },
      });
      if (!resp.ok) throw new Error(`Graph API ${resp.status}`);
      const data = await resp.json();
      setCalls(
        (data.value || [])
          .filter((ev) => ev.isOnlineMeeting)   // client-side filter — no 400 risk
          .map(normalizeGraphEvent)
          .sort((a, b) => new Date(b.from) - new Date(a.from))
      );
    } catch (err) {
      setCallsError("Failed to load Teams calls. " + (err?.message || ""));
    } finally {
      setLoadingCalls(false);
    }
  }, [calendarToken]);

  useEffect(() => {
    if (calendarToken) { fetchMeetings(); fetchCalls(); }
  }, [calendarToken, fetchMeetings, fetchCalls]);

  // Refresh when a meeting is added from ContactEmailLogs
  useEffect(() => {
    const handler = () => { fetchMeetings(); fetchCalls(); };
    window.addEventListener("meetingUpdated", handler);
    return () => window.removeEventListener("meetingUpdated", handler);
  }, [fetchMeetings, fetchCalls]);

  /* ── Fetch chats ── */
  const fetchChats = useCallback(async () => {
    if (!accessToken) return;
    setLoadingChats(true);
    setChatError("");
    try {
      // Step 1: fetch chats with member expansion
      // NOTE: $orderby is NOT supported on /me/chats — omit it to avoid 400
      const res = await window.fetch(
        "https://graph.microsoft.com/v1.0/me/chats?$top=50&$expand=members",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || String(res.status));
      }
      const data = await res.json();
      const chatList = data.value || [];
      setChats(chatList);

      // Extract unique chat participants for the attendee picker
      const meEmail = accounts[0]?.username?.toLowerCase() || "";
      const meId    = accounts[0]?.localAccountId || "";
      const seen = new Set();
      const extracted = [];
      for (const chat of chatList) {
        const chatName = chat.topic || "";
        for (const m of (chat.members || [])) {
          const email = (m.email || "").toLowerCase();
          const uid   = m.userId || "";
          if (!m.displayName || !email) continue;
          if (email === meEmail || uid === meId) continue;
          if (seen.has(email)) continue;
          seen.add(email);
          extracted.push({
            name:   m.displayName,
            email:  m.email,
            title:  chatName ? `From: ${chatName}` : "Teams contact",
            source: "chat",
          });
        }
      }
      setChatContacts(extracted);

      // Step 2: fetch lastMessagePreview separately (not always in $expand)
      // Try to get last message preview for each chat to build unread counts & storyline
      const previewResults = await Promise.allSettled(
        chatList.slice(0, 20).map(chat =>
          window.fetch(
            `https://graph.microsoft.com/v1.0/chats/${chat.id}/messages?$top=1`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ).then(r => r.ok ? r.json() : null).catch(() => null)
        )
      );

      const counts = {};
      const storyline = [];
      const previews = {};

      chatList.slice(0, 20).forEach((chat, idx) => {
        const result = previewResults[idx];
        if (result.status !== "fulfilled" || !result.value?.value?.length) return;
        const lastMsg = result.value.value[0];
        if (!lastMsg) return;

        // Unread tracking
        const msgTime = new Date(lastMsg.createdDateTime).getTime();
        const lastRead = lastReadTimesRef.current[chat.id];
        const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
        if (msgTime > lastReadTime) counts[chat.id] = 1;

        const sender  = lastMsg.from?.user?.displayName || "Unknown";
        const initials = sender.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
        const rawText = (lastMsg.body?.content || "")
          .replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&")
          .trim().slice(0, 80);

        // Chat list preview (text + time for sidebar display)
        previews[chat.id] = {
          text: rawText || "",
          time: fmtDate(lastMsg.createdDateTime),
        };

        // Storyline
        if (rawText) {
          storyline.push({
            id: chat.id,
            name: sender,
            status: fmtDate(lastMsg.createdDateTime),
            avatar: initials,
            time: fmtTime(lastMsg.createdDateTime),
            message: rawText,
          });
        }
      });

      setChatUnreadCounts(counts);
      setChatPreviews(previews);
      if (storyline.length > 0) setStorylineItems(storyline);

    } catch (e) {
      const msg = e.message || "";
      setChatError(
        msg.includes("403") || msg.includes("Forbidden")
          ? "Chat.Read permission required — please sign in again."
          : msg.includes("401") || msg.includes("Unauthorized")
          ? "Session expired — please sign in again."
          : `Unable to load chats: ${msg}`
      );
    } finally {
      setLoadingChats(false);
    }
  }, [accessToken]);

  // Fetch chats when entering chat section OR when token arrives
  useEffect(() => { if (section === "chat" && accessToken) fetchChats(); }, [section, accessToken, fetchChats]);

  // Mark all activity items as read when user opens Activity section
  useEffect(() => {
    if (section === "activity") {
      setReadActivityIds(prev => { const n = new Set(prev); realActivity.forEach(a => n.add(a.id)); return n; });
      setRealActivity(prev => prev.map(a => ({ ...a, unread: false })));
    }
  }, [section]);

  // Keep messageRef in sync with message state (used by draft auto-save)
  useEffect(() => { messageRef.current = message; }, [message]);

  /* ── Reset message state when switching chats + auto-save/restore draft ── */
  useEffect(() => {
    const prevId = prevChatIdRef.current;
    // Save draft for the chat we're leaving
    if (prevId) {
      const txt = messageRef.current.trim();
      try {
        if (txt) localStorage.setItem(`teams_draft_${prevId}`, txt);
        else      localStorage.removeItem(`teams_draft_${prevId}`);
      } catch {}
    }
    // Restore draft (or clear) for the chat we're entering
    const draft = selectedChat?.id
      ? (() => { try { return localStorage.getItem(`teams_draft_${selectedChat.id}`) || ""; } catch { return ""; } })()
      : "";
    setMessage(draft);
    prevChatIdRef.current = selectedChat?.id || null;
    hasLoadedMsgsRef.current = false;
    setMessages([]);
    setMessagesError("");
    setReplyTo(null);
  }, [selectedChat?.id]);

  /* ── Fetch messages ── */
  const fetchMessages = useCallback(async () => {
    if (!selectedChat || !accessToken) return;
    const isFirstLoad = !hasLoadedMsgsRef.current;
    if (isFirstLoad) { setLoadingMessages(true); setMessagesError(""); }
    try {
      const res  = await window.fetch(
        `https://graph.microsoft.com/v1.0/chats/${selectedChat.id}/messages?$top=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const code = res.status;
        throw new Error(
          code === 403 ? "Access denied — Chat.Read permission may not be consented."
          : code === 401 ? "Session expired — please sign in again."
          : errBody?.error?.message || `Error ${code}`
        );
      }
      const data = await res.json();
      const fresh = (data.value || []).reverse().filter(m => !deletedMsgIdsRef.current.has(m.id));
      hasLoadedMsgsRef.current = true;
      setMessages((prev) => {
        if (!prev.length) return fresh;
        const lastOld = prev[prev.length - 1]?.id;
        const lastNew = fresh[fresh.length - 1]?.id;
        if (lastOld === lastNew && prev.length === fresh.length) return prev;
        return fresh;
      });
    } catch (e) {
      if (isFirstLoad) setMessagesError(e.message || "Failed to load messages.");
    }
    finally { if (isFirstLoad) setLoadingMessages(false); }
  }, [selectedChat, accessToken]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => {
    if (!selectedChat) return;
    const iv = setInterval(fetchMessages, 30000);
    return () => clearInterval(iv);
  }, [selectedChat, fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (callLocalVideoRef.current && callLocalStream) callLocalVideoRef.current.srcObject = callLocalStream;
  }, [callLocalStream, callModal]);

  /* ── Fetch chat members for @mention ── */
  useEffect(() => {
    if (!selectedChat || !accessToken) { setChatMembers([]); return; }
    window.fetch(`https://graph.microsoft.com/v1.0/chats/${selectedChat.id}/members`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.value) return;
        const myId = accounts[0]?.localAccountId;
        const members = data.value
          .filter(m => m.userId !== myId)
          .map(m => ({
            name: m.displayName || m.email || "Unknown",
            email: m.email || "",
            userId: m.userId || "",
          }));
        setChatMembers(members);
      })
      .catch(() => {});
  }, [selectedChat, accessToken, accounts]);

  /* ── Send message ── */
  const handleSend = async () => {
    if ((!message.trim() && pendingFiles.length === 0 && pendingImages.length === 0) || !selectedChat) return;
    setSendError("");
    try {
      const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");

      // Upload pending files to OneDrive, collect links
      const fileLinks = [];
      if (pendingFiles.length > 0 && filesToken) {
        for (const f of pendingFiles) {
          try {
            const uploadRes = await window.fetch(
              `https://graph.microsoft.com/v1.0/me/drive/root:/TeamsUploads/${encodeURIComponent(f.name)}:/content`,
              { method: "PUT", headers: { Authorization: `Bearer ${filesToken}`, "Content-Type": f.type || "application/octet-stream" }, body: f }
            );
            if (uploadRes.ok) {
              const item = await uploadRes.json();
              fileLinks.push({ name: f.name, url: item.webUrl || "" });
            }
          } catch {}
        }
      }

      // Build hostedContents for images (Teams Graph API embeds images directly)
      const hostedContents = pendingImages.map((img, i) => ({
        "@microsoft.graph.temporaryId": String(i + 1),
        contentBytes: img.dataUrl.split(",")[1] || "",
        contentType: img.dataUrl.split(";")[0].split(":")[1] || "image/png",
      }));

      // Build HTML body — text + embedded images + file links
      let bodyHtml = message.trim() ? `<p>${esc(message)}</p>` : "";

      // Embed each image inline using hostedContents reference
      if (pendingImages.length > 0) {
        const imgsHtml = pendingImages.map((img, i) =>
          `<p><img src="../hostedContents/${i + 1}/$value" style="max-width:400px;max-height:300px;border-radius:6px;" alt="${esc(img.name)}"></p>`
        ).join("");
        bodyHtml += imgsHtml;
      }

      if (fileLinks.length > 0) {
        const linksHtml = fileLinks.map(fl =>
          fl.url
            ? `<p>📎 <a href="${fl.url}" target="_blank">${esc(fl.name)}</a></p>`
            : `<p>📎 ${esc(fl.name)}</p>`
        ).join("");
        bodyHtml += linksHtml;
      }
      // Files with no token — just mention names
      if (pendingFiles.length > 0 && !filesToken) {
        const namesHtml = pendingFiles.map(f => `<p>📎 ${esc(f.name)}</p>`).join("");
        bodyHtml += namesHtml;
      }

      let bodyPayload;
      if (replyTo) {
        const quoteHtml = `<div data-reply="1" style="border-left:3px solid #6264A7;padding:4px 10px;margin-bottom:8px;border-radius:0 6px 6px 0;background:rgba(98,100,167,0.08)"><strong style="color:#8385c7;font-size:11px">${esc(replyTo.sender)}</strong><br><span style="font-size:12px;opacity:0.7">${esc((replyTo.text||"[Media]").slice(0,200))}</span></div>${bodyHtml}`;
        bodyPayload = { contentType: "html", content: quoteHtml };
        setReplyTo(null);
      } else {
        bodyPayload = { contentType: "html", content: bodyHtml || `<p>${esc(message)}</p>` };
      }

      const msgPayload = { body: bodyPayload };
      if (hostedContents.length > 0) msgPayload.hostedContents = hostedContents;

      await window.fetch(`https://graph.microsoft.com/v1.0/chats/${selectedChat.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(msgPayload),
      });
      setMessage(""); setPendingFiles([]); setPendingImages([]); fetchMessages();
    } catch { setSendError("Failed to send."); }
  };

  const handleRecordToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    setSendError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);
        setIsRecording(false);
        const ext = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
        setPendingFiles(p => [...p, file]);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      setSendError("Microphone access denied.");
    }
  };

  const handleDeleteMessage = (messageId) => {
    deletedMsgIdsRef.current.add(messageId);
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    if (selectedChat && accessToken) {
      window.fetch(
        `https://graph.microsoft.com/v1.0/chats/${selectedChat.id}/messages/${messageId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      ).catch(() => {});
    }
  };

  // Maps display emoji → Teams API reactionType (Graph API supports these 6 strings)
  const EMOJI_TO_REACTION = { "👍":"like","❤️":"heart","😆":"laugh","😮":"surprised","😢":"sad","😡":"angry" };

  const sendReaction = useCallback((msg, emoji) => {
    // Update local state optimistically
    setMsgReactions(p => {
      const r = p[msg.id] || {};
      const c = r[emoji] || 0;
      return { ...p, [msg.id]: { ...r, [emoji]: c > 0 ? c - 1 : c + 1 } };
    });

    // Call Graph API if this is a supported Teams reaction type
    const reactionType = EMOJI_TO_REACTION[emoji];
    if (!reactionType || !selectedChat || !accessToken) return;

    const current = (msgReactions[msg.id] || {})[emoji] || 0;
    const endpoint = current > 0 ? "unsetReaction" : "setReaction";
    window.fetch(
      `https://graph.microsoft.com/v1.0/chats/${selectedChat.id}/messages/${msg.id}/${endpoint}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType }),
      }
    ).catch(() => {});
  }, [selectedChat, accessToken, msgReactions]);

  const copyToClipboard = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const showMsgToast = (text) => {
    clearTimeout(msgToastTimer.current);
    setMsgToast(text);
    msgToastTimer.current = setTimeout(() => setMsgToast(""), 2400);
  };

  /* ── Sign in — try silent SSO first; popup only if needed ── */
  const handleTeamsLogin = async () => {
    try {
      await instance.ssoSilent({ scopes: TEAMS_SCOPES });
    } catch {
      try {
        await instance.loginPopup({ scopes: TEAMS_SCOPES });
      } catch (e) {
        console.error(e);
      }
    }
  };

  /* ── Fetch OneDrive recent files ── */
  const fetchOneDriveFiles = useCallback(async () => {
    if (!filesToken) return;
    setLoadingFiles(true); setFilesError("");
    try {
      const res = await window.fetch(
        "https://graph.microsoft.com/v1.0/me/drive/recent?$top=25&$select=id,name,size,lastModifiedDateTime,lastModifiedBy,file,folder,webUrl,parentReference",
        { headers: { Authorization: `Bearer ${filesToken}` } }
      );
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setOneDriveFiles(data.value || []);
    } catch (e) {
      setFilesError(e.message?.includes("403") ? "Files.Read permission required." : "Unable to load files.");
    } finally { setLoadingFiles(false); }
  }, [filesToken]);

  useEffect(() => { if (filesToken && section === "files") fetchOneDriveFiles(); }, [filesToken, section, fetchOneDriveFiles]);

  /* ── Fetch joined Teams ── */
  const fetchJoinedTeams = useCallback(async () => {
    if (!teamsApiToken) return;
    setLoadingJoinedTeams(true); setJoinedTeamsError("");
    try {
      const res = await window.fetch(
        "https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName,description,visibility",
        { headers: { Authorization: `Bearer ${teamsApiToken}` } }
      );
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setJoinedTeams(data.value || []);
    } catch (e) {
      setJoinedTeamsError(e.message?.includes("403") ? "Team.ReadBasic.All permission required." : "Unable to load teams.");
    } finally { setLoadingJoinedTeams(false); }
  }, [teamsApiToken]);

  useEffect(() => { if (teamsApiToken && (section === "teams" || section === "files" || section === "chat")) fetchJoinedTeams(); }, [teamsApiToken, section, fetchJoinedTeams]);

  /* ── Fetch channels for a Team ── */
  const fetchTeamChannels = useCallback(async (teamId) => {
    if (!teamsApiToken || teamChannels[teamId]) return;
    setLoadingChannels(p => ({...p, [teamId]: true}));
    try {
      const res = await window.fetch(
        `https://graph.microsoft.com/v1.0/teams/${teamId}/channels?$select=id,displayName,membershipType,description`,
        { headers: { Authorization: `Bearer ${teamsApiToken}` } }
      );
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setTeamChannels(p => ({...p, [teamId]: data.value || []}));
    } catch { /* silent */ }
    finally { setLoadingChannels(p => ({...p, [teamId]: false})); }
  }, [teamsApiToken, teamChannels]);

  /* ── Fetch channel messages (ChannelMessage.Read.All) ── */
  const fetchChannelMessages = useCallback(async (teamId, channelId) => {
    if (!teamsApiToken) return;
    setLoadingChannelMsgs(true);
    try {
      const res = await window.fetch(
        `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages?$top=50`,
        { headers: { Authorization: `Bearer ${teamsApiToken}` } }
      );
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setChannelMessages((data.value || []).reverse());
    } catch { setChannelMessages([]); }
    finally { setLoadingChannelMsgs(false); }
  }, [teamsApiToken]);

  /* ── Send channel message (ChannelMessage.Send) ── */
  const sendChannelMessage = async () => {
    const text = channelInput.trim();
    if (!text || !selectedChannel?.teamId) return;
    const { teamId, id: channelId } = selectedChannel;
    try {
      await window.fetch(
        `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${teamsApiToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ body: { content: text } }),
        }
      );
      setChannelInput("");
      setTimeout(() => fetchChannelMessages(teamId, channelId), 1200);
    } catch { /* silent */ }
  };

  /* ── Re-fetch messages when channel changes ── */
  useEffect(() => {
    if (selectedChannel?.teamId && selectedChannel?.id) {
      setChannelMessages([]);
      fetchChannelMessages(selectedChannel.teamId, selectedChannel.id);
    }
  }, [selectedChannel, fetchChannelMessages]);

  /* ── Fetch user presence (Presence.Read) ── */
  useEffect(() => {
    if (!presenceToken) return;
    const fetchPresence = () =>
      window.fetch("https://graph.microsoft.com/v1.0/me/presence", {
        headers: { Authorization: `Bearer ${presenceToken}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setUserPresence(d); })
        .catch(() => {});
    fetchPresence();
    const timer = setInterval(fetchPresence, 60000);
    return () => clearInterval(timer);
  }, [presenceToken]);

  /* ── Build real activity feed from Graph data ── */
  useEffect(() => {
    const items = [];

    // From calendar events
    meetings.slice(0, 8).forEach((m, i) => {
      const isRecent = m.from && new Date(m.from) > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      items.push({
        id: `mtg-${m.id}`,
        type: "meeting",
        text: m.title,
        sub: `${fmtMeetingDate(m.from)} · ${m.isOnlineMeeting ? "Teams Meeting" : "Calendar event"}`,
        time: fmtDate(m.from),
        unread: isRecent && i < 3,
        clr: "bg-[#6264A7]/30 text-[#c7c9f3]",
        Ico: Video,
        data: m,
      });
    });

    // From OneDrive recent files
    oneDriveFiles.slice(0, 5).forEach(f => {
      const author = f.lastModifiedBy?.user?.displayName || "Someone";
      items.push({
        id: `file-${f.id}`,
        type: "file",
        text: `${author} modified ${f.name}`,
        sub: f.webUrl ? "Click to open in OneDrive" : f.parentReference?.path || "",
        time: fmtDate(f.lastModifiedDateTime),
        unread: false,
        clr: "bg-yellow-500/20 text-yellow-300",
        Ico: FileText,
        url: f.webUrl,
        data: f,
      });
    });

    // From recent chat previews
    chats.slice(0, 5).forEach(c => {
      const preview = c.lastMessagePreview;
      if (!preview?.body?.content) return;
      const sender = preview.from?.user?.displayName || "Someone";
      const rawText = (preview.body?.content || "").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").trim().slice(0,60);
      if (!rawText) return;
      items.push({
        id: `chat-${c.id}`,
        type: "message",
        text: `${sender} sent a message`,
        sub: rawText,
        time: fmtDate(preview.createdDateTime),
        unread: !!chatUnreadCounts[c.id],
        clr: "bg-blue-500/20 text-blue-300",
        Ico: MessageSquare,
        data: { chat: c, sender, rawText },
      });
    });

    // Sort by time (most recent first)
    items.sort((a, b) => {
      const ta = a.time === "Now" ? Date.now() : 0;
      const tb = b.time === "Now" ? Date.now() : 0;
      return tb - ta;
    });

    setRealActivity(items.map(item => ({
      ...item,
      unread: readActivityIds.has(item.id) ? false : item.unread,
    })));
  }, [meetings, oneDriveFiles, chats, chatUnreadCounts, readActivityIds]);

  /* ── Filtered data ── */
  const filteredMeetings = meetings.filter((m) => {
    if (!meetingSearch.trim()) return true;
    const q = meetingSearch.toLowerCase();
    return m.title.toLowerCase().includes(q) || (m.location || "").toLowerCase().includes(q);
  });
  // eslint-disable-next-line no-unused-vars
  const groupedMeetings = groupMeetings(filteredMeetings);
  // eslint-disable-next-line no-unused-vars
  const GROUP_ORDER = ["Today", "Tomorrow", "This Week", "Later", "Past"];

  const filteredCalls = calls.filter((c) => {
    if (!callSearch.trim()) return true;
    return c.title.toLowerCase().includes(callSearch.toLowerCase());
  });

  // Build a display name for a chat that excludes the logged-in user
  const currentUserId = accounts[0]?.localAccountId;
  const currentEmail  = (accounts[0]?.username || "").toLowerCase();
  const getChatName = (chat) => {
    if (chat.topic) return chat.topic;
    const others = (chat.members || []).filter((m) => {
      if (currentUserId && m.userId === currentUserId) return false;
      if (currentEmail  && (m.email || "").toLowerCase() === currentEmail) return false;
      return Boolean(m.displayName);
    });
    if (others.length > 0) return others.map((m) => m.displayName).join(", ");
    return (chat.members || []).map((m) => m.displayName).filter(Boolean).join(", ") || "Chat";
  };

  const filteredChats = chats.filter((c) => {
    if (hiddenChats.has(c.id)) return false;
    const name = getChatName(c).toLowerCase();
    if (chatSearch.trim() && !name.includes(chatSearch.toLowerCase())) return false;
    const unread = (chatUnreadCounts[c.id] || 0) > 0;
    switch (chatFilter) {
      case "unread":   return unread;
      case "read":     return !unread;
      case "groups":   return c.chatType === "group";
      case "chats":    return c.chatType === "oneOnOne";
      case "channels": return c.chatType === "channel";
      case "meetings": return c.chatType === "meeting";
      default:         return true;
    }
  });

  /* ── calendar helpers (after meetings/localCalEvents are declared) ── */
  const calNav = useCallback((dir) => {
    setCalendarDate(prev => {
      const d = new Date(prev);
      if (calendarView === "month")     d.setMonth(d.getMonth() + dir);
      else if (calendarView === "week") d.setDate(d.getDate() + dir * 7);
      else                              d.setDate(d.getDate() + dir);
      return d;
    });
  }, [calendarView]);

  const getCalendarTitle = useCallback(() => {
    if (calendarView === "month") return calendarDate.toLocaleDateString("en-US", {month:"long",year:"numeric"});
    if (calendarView === "week") {
      const ws = new Date(calendarDate); ws.setDate(ws.getDate() - ws.getDay());
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      return ws.getMonth() === we.getMonth()
        ? `${ws.toLocaleDateString("en-US",{month:"long"})} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
        : `${ws.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${we.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    }
    return calendarDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  }, [calendarView, calendarDate]);

  const getEventsForDay = useCallback((date) => {
    return [...meetings, ...localCalEvents].filter(ev =>
      new Date(ev.from || ev.date || "").toDateString() === date.toDateString()
    );
  }, [meetings, localCalEvents]);

  /* ── derived ── */
  const totalUnreadBadge    = Object.values(chatUnreadCounts).reduce((s,c) => s+(c||0), 0);
  const activityUnreadBadge = realActivity.filter(a => a.unread).length;
  const graphAvailability   = userPresence?.availability?.toLowerCase() || "";
  // userStatus (manual pick) always wins; fall back to Graph data; default to "available"
  const effectiveStatus     = userStatus || graphAvailability || "available";

  // Graph API availability → dot color
  const PRESENCE_COLOR = {
    available:        "bg-green-400",
    availableidle:    "bg-green-400",
    busy:             "bg-red-400",
    busyidle:         "bg-red-400",
    donotdisturb:     "bg-red-400",
    away:             "bg-yellow-400",
    berightback:      "bg-yellow-400",
    offline:          "bg-gray-400",
    presenceunknown:  "bg-gray-400",
  };
  const statusColor = PRESENCE_COLOR[effectiveStatus] || (
    userStatus === "available" ? "bg-green-400"
    : userStatus === "busy"    ? "bg-red-400"
    : userStatus === "away"    ? "bg-yellow-400"
    : "bg-gray-400"
  );

  // Human-readable label — prefer Graph activity (e.g. "In a Call") over raw availability
  const PRESENCE_LABEL = {
    available:            "Available",
    availableidle:        "Available (Idle)",
    busy:                 "Busy",
    busyidle:             "Busy (Idle)",
    donotdisturb:         "Do Not Disturb",
    away:                 "Away",
    berightback:          "Be Right Back",
    offline:              "Offline",
    presenceunknown:      "Unknown",
  };
  const ACTIVITY_LABEL = {
    inacall:              "In a Call",
    inaconferencecall:    "In a Conference Call",
    inameeting:           "In a Meeting",
    presenting:           "Presenting",
    urgentinterruptionsonly: "Do Not Disturb",
    outofoffice:          "Out of Office",
    offwork:              "Off Work",
    inactive:             "Inactive",
  };
  const graphActivity   = userPresence?.activity?.toLowerCase() || "";
  const presenceLabel   = userStatus
    ? (PRESENCE_LABEL[userStatus] || userStatus)
    : graphAvailability
      ? (ACTIVITY_LABEL[graphActivity] || PRESENCE_LABEL[graphAvailability] || userPresence?.availability || "")
      : "Available";
  const NAV_ITEMS = [
    { id:"activity", Icon:Bell,          label:"Activity",  badge:activityUnreadBadge },
    { id:"chat",     Icon:MessageSquare, label:"Chat",      badge:totalUnreadBadge||null },
    { id:"calendar", Icon:Calendar,      label:"Calendar" },
    { id:"calls",    Icon:PhoneCall,     label:"Calls" },
    { id:"files",    Icon:FolderOpen,    label:"Files" },
    { id:"tasks",    Icon:CheckSquare,   label:"Tasks" },
    { id:"apps",     Icon:Puzzle,        label:"Apps" },
    { id:"copilot",  Icon:Sparkles,      label:"Copilot" },
  ];

  /* ─── RENDER ─────────────────────────────────────────────── */
  return (
    <>
    <div className="flex h-full w-full overflow-hidden bg-[#1e1e2e] text-white">
      <style>{`
        .teams-scrollbar{scroll-behavior:smooth}
        .teams-scrollbar::-webkit-scrollbar{width:6px;height:6px}
        .teams-scrollbar::-webkit-scrollbar-track{background:transparent}
        .teams-scrollbar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        .teams-scrollbar::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.3)}
      `}</style>

      {/* ══ LEFT NAV RAIL — 9 icons ════════════════════════════ */}
      <div className="w-14 bg-[#141424] border-r border-white/5 flex flex-col items-center py-3 gap-0.5 flex-shrink-0 z-40">
        {/* User avatar */}
        <div className="relative group mb-2">
          <div onClick={() => setStatusMenuOpen(!statusMenuOpen)}
            className="w-9 h-9 rounded-xl bg-[#6264A7] flex items-center justify-center cursor-pointer hover:bg-[#7375b5] transition-all shadow-lg text-sm font-bold select-none">
            {accounts[0]?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full ${statusColor} border-2 border-[#141424]`} />
          <div className="absolute left-12 top-1/2 -translate-y-1/2 ml-1 bg-[#2a2a3a] text-white text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 shadow-xl">
            {accounts[0]?.name || "Sign in"} · {presenceLabel}
          </div>
          {statusMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusMenuOpen(false)} />
              <div className="absolute left-12 top-0 w-52 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#6264A7]/10">
                  <div className="relative w-8 h-8 rounded-full bg-[#6264A7] flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {accounts[0]?.name?.charAt(0)||"U"}
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1a1a2e] ${statusColor}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{accounts[0]?.name||"User"}</p>
                    <p className="text-[10px] text-white/50 truncate">{presenceLabel}</p>
                  </div>
                </div>
                {[["available","bg-green-400","Available"],["busy","bg-red-400","Busy"],["away","bg-yellow-400","Away"],["offline","bg-gray-400","Appear offline"]].map(([s,c,l])=>(
                  <button key={s} onClick={()=>{setUserStatus(s);setStatusMenuOpen(false);}}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-sm transition-colors ${effectiveStatus===s?"bg-white/5":""}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${c} flex-shrink-0`}/>{l}
                    {effectiveStatus===s&&<Check className="w-3.5 h-3.5 ml-auto text-[#6264A7]"/>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Nav icons */}
        {NAV_ITEMS.map(({id,Icon,label,badge})=>(
          <div key={id} className="relative group w-full flex justify-center">
            {section===id&&<div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"/>}
            <button onClick={()=>setSection(id)} title={label}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                section===id?"bg-[#6264A7] text-white shadow-lg shadow-[#6264A7]/25":"text-white/40 hover:text-white/80 hover:bg-white/10"
              }`}>
              <Icon className="w-5 h-5"/>
              {badge>0&&<span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">{badge>99?"99+":badge}</span>}
            </button>
            <div className="absolute left-14 top-1/2 -translate-y-1/2 ml-1 bg-[#2a2a3a] text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 shadow-xl">{label}</div>
          </div>
        ))}

        <div className="flex-1"/>

        <div className="relative group w-full flex justify-center">
          {section==="settings"&&<div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"/>}
          <button onClick={()=>setSection("settings")}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${section==="settings"?"bg-[#6264A7] text-white shadow-lg shadow-[#6264A7]/25":"text-white/40 hover:text-white/80 hover:bg-white/10"}`}>
            <Settings className="w-5 h-5"/>
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 ml-1 bg-[#2a2a3a] text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 shadow-xl">Settings</div>
        </div>
      </div>

      {/* ══ ACTIVITY ═══════════════════════════════════════════ */}
      {section === "activity" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold">Activity</h2>
                <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/50"><Search className="w-4 h-4"/></button>
              </div>
              <p className="text-xs text-white/40">{realActivity.filter(a=>a.unread).length} unread notifications</p>
            </div>
            <div className="flex-1 overflow-y-auto teams-scrollbar">
              {realActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  {isMsalConnected ? (
                    <><Bell className="w-8 h-8 text-white/15"/><p className="text-sm text-white/30">No activity yet</p></>
                  ) : (
                    <><Bell className="w-8 h-8 text-white/15"/>
                      <p className="text-sm text-white/40 mb-1">Sign in to see activity</p>
                      <button onClick={handleTeamsLogin} className="px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium transition-colors">Sign in</button>
                    </>
                  )}
                </div>
              ) : realActivity.map(item=>(
                <div key={item.id}
                  onClick={() => { markActivityRead(item.id); setSelectedActivity(item); }}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5
                    ${selectedActivity?.id === item.id ? "bg-[#6264A7]/20 border-l-2 border-l-[#6264A7]" : item.unread ? "bg-[#6264A7]/5" : ""}`}>
                  <div className={`p-2 rounded-xl flex-shrink-0 ${item.clr}`}><item.Ico className="w-3.5 h-3.5"/></div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] leading-tight ${item.unread?"text-white font-medium":"text-white/70"}`}>{item.text}</p>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">{item.sub}</p>
                    <p className="text-[10px] text-white/25 mt-1">{item.time}</p>
                  </div>
                  {item.unread&&<div className="w-2 h-2 rounded-full bg-[#6264A7] mt-1 flex-shrink-0"/>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Activity detail body ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
            {!selectedActivity ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#6264A7]/20 flex items-center justify-center"><Bell className="w-7 h-7 text-[#6264A7]"/></div>
                <p className="text-sm text-white/35">Select a notification to view details</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto teams-scrollbar p-6">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6 pb-5 border-b border-white/10">
                  <div className={`p-3 rounded-2xl flex-shrink-0 ${selectedActivity.clr}`}>
                    <selectedActivity.Ico className="w-5 h-5"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-white leading-snug">{selectedActivity.text}</h2>
                    <p className="text-xs text-white/40 mt-1">{selectedActivity.time}</p>
                  </div>
                  <button onClick={() => setSelectedActivity(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                </div>

                {/* Meeting detail */}
                {selectedActivity.type === "meeting" && selectedActivity.data && (() => {
                  const m = selectedActivity.data;
                  return (
                    <div className="space-y-4">
                      {(m.from || m.to) && (
                        <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                          <Clock className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                          <div>
                            <p className="text-xs text-white/40 mb-0.5">Date & Time</p>
                            <p className="text-sm text-white">{fmtMeetingDate(m.from)}</p>
                            <p className="text-xs text-white/60">{fmtMeetingTime(m.from)}{m.to ? ` – ${fmtMeetingTime(m.to)}` : ""}{m.from && m.to ? ` · ${meetingDuration(m.from, m.to)}` : ""}</p>
                          </div>
                        </div>
                      )}
                      {m.location && (
                        <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                          <MapPin className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                          <div>
                            <p className="text-xs text-white/40 mb-0.5">Location</p>
                            <p className="text-sm text-white">{m.location}</p>
                          </div>
                        </div>
                      )}
                      {m.attendees && (
                        <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                          <Users className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                          <div className="min-w-0">
                            <p className="text-xs text-white/40 mb-0.5">Attendees</p>
                            <p className="text-sm text-white/80 break-words">{m.attendees}</p>
                          </div>
                        </div>
                      )}
                      {m.description && (
                        <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                          <MessageSquare className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                          <div className="min-w-0">
                            <p className="text-xs text-white/40 mb-0.5">Description</p>
                            <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{m.description}</p>
                          </div>
                        </div>
                      )}
                      {m.teamsJoinUrl && (
                        <a href={m.teamsJoinUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-[#6264A7] hover:bg-[#7375b5] text-white rounded-xl text-sm font-medium transition-colors">
                          <Video className="w-4 h-4"/>Join Teams Meeting
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* File detail */}
                {selectedActivity.type === "file" && selectedActivity.data && (() => {
                  const f = selectedActivity.data;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                        <FileText className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                        <div className="min-w-0">
                          <p className="text-xs text-white/40 mb-0.5">File</p>
                          <p className="text-sm text-white font-medium truncate">{f.name}</p>
                          {f.parentReference?.path && <p className="text-xs text-white/40 mt-0.5 truncate">{f.parentReference.path}</p>}
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                        <Clock className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                        <div>
                          <p className="text-xs text-white/40 mb-0.5">Last Modified</p>
                          <p className="text-sm text-white">{f.lastModifiedBy?.user?.displayName || "Someone"}</p>
                          <p className="text-xs text-white/50">{fmtDate(f.lastModifiedDateTime)}</p>
                        </div>
                      </div>
                      {f.webUrl && (
                        <a href={f.webUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-[#6264A7] hover:bg-[#7375b5] text-white rounded-xl text-sm font-medium transition-colors">
                          <ExternalLink className="w-4 h-4"/>Open in OneDrive
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* Message detail */}
                {selectedActivity.type === "message" && selectedActivity.data && (() => {
                  const { chat, sender, rawText } = selectedActivity.data;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                        <MessageSquare className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0"/>
                        <div className="min-w-0">
                          <p className="text-xs text-white/40 mb-0.5">From</p>
                          <p className="text-sm text-white font-medium">{sender}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-white/40 mb-2">Message Preview</p>
                        <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{rawText}</p>
                      </div>
                      <button onClick={() => { setSection("chat"); setSelectedChat(chat); }}
                        className="flex items-center gap-2 px-4 py-3 bg-[#6264A7] hover:bg-[#7375b5] text-white rounded-xl text-sm font-medium transition-colors w-full justify-center">
                        <MessageSquare className="w-4 h-4"/>Open Chat
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TEAMS ════════════════════════════════════════════════ */}
      {section === "teams" && (
        <>
          <div className="w-72 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">Teams</h2>
                <div className="flex gap-1">
                  <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/50"><Search className="w-4 h-4"/></button>
                  <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/50"><Plus className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex gap-1.5">
                {["all","channels","hidden"].map(t=>(
                  <button key={t} onClick={()=>setTeamsTab(t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border capitalize ${teamsTab===t?"border-[#6264A7]/60 bg-[#6264A7]/20 text-white":"border-white/15 text-white/40 hover:text-white/70"}`}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto teams-scrollbar p-2">
              {!isMsalConnected ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Users className="w-8 h-8 text-white/15"/>
                  <p className="text-sm text-white/40 mb-1">Sign in to view your teams</p>
                  <button onClick={handleTeamsLogin} className="px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium">Sign in</button>
                </div>
              ) : loadingJoinedTeams ? (
                <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/></div>
              ) : joinedTeamsError ? (
                <div className="mx-3 p-3 bg-red-900/20 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-300">{joinedTeamsError}</p>
                  <button onClick={fetchJoinedTeams} className="text-xs text-[#6264A7] mt-1">Retry</button>
                </div>
              ) : joinedTeams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Users className="w-8 h-8 text-white/15"/>
                  <p className="text-sm text-white/30">No teams found</p>
                </div>
              ) : (
                joinedTeams.map((team, idx) => {
                  const abbr = team.displayName?.slice(0,2)?.toUpperCase() || "TM";
                  const TEAM_COLORS = ["#6264A7","#e45c8a","#f4a261","#2ec4b6","#059669","#7c3aed","#0891b2","#d97706"];
                  const color = TEAM_COLORS[idx % TEAM_COLORS.length];
                  const channels = teamChannels[team.id] || [];
                  const isExpanded = expandedTeams.has(team.id);
                  return (
                    <div key={team.id} className="mb-0.5">
                      <button onClick={() => {
                        setExpandedTeams(p=>{const s=new Set(p);s.has(team.id)?s.delete(team.id):s.add(team.id);return s;});
                        if (!teamChannels[team.id]) fetchTeamChannels(team.id);
                      }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 transition-all">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow" style={{backgroundColor:color+"30",color}}>{abbr}</div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{team.displayName}</p>
                          <p className="text-[11px] text-white/40 capitalize">{team.visibility || "team"}</p>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 text-white/30 transition-transform ${isExpanded?"rotate-90":""}`}/>
                      </button>
                      {isExpanded && (
                        <div className="ml-5 space-y-0.5 mb-1">
                          {loadingChannels[team.id] ? (
                            <div className="flex items-center gap-2 px-3 py-2"><div className="w-3 h-3 border border-[#6264A7] border-t-transparent rounded-full animate-spin"/><span className="text-xs text-white/30">Loading channels…</span></div>
                          ) : channels.length === 0 ? (
                            <p className="text-xs text-white/25 px-3 py-2">No channels found</p>
                          ) : channels.map(ch => (
                            <button key={ch.id} onClick={()=>setSelectedChannel({...ch, teamId: team.id, teamName: team.displayName})}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${selectedChannel?.id===ch.id?"bg-[#6264A7]/25 text-white":"hover:bg-white/8 text-white/55 hover:text-white"}`}>
                              {ch.membershipType==="private"?<Lock className="w-3 h-3 flex-shrink-0 text-white/30"/>:<Hash className="w-3.5 h-3.5 flex-shrink-0 text-white/35"/>}
                              <span className="text-xs flex-1 text-left truncate">{ch.displayName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div className="px-3 mt-2">
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/8 text-white/40 hover:text-white/70 text-xs transition-colors border border-dashed border-white/10">
                  <Plus className="w-3.5 h-3.5"/> Join or create a team
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 bg-[#1e1e2e] flex flex-col overflow-hidden">
            {selectedChannel ? (
              <>
                {/* Channel header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-[#1a1a2e] flex-shrink-0">
                  <Hash className="w-4 h-4 text-[#6264A7]"/>
                  <div>
                    <p className="text-sm font-semibold">{selectedChannel.displayName}</p>
                    <p className="text-[11px] text-white/40">{selectedChannel.teamName}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto teams-scrollbar px-5 py-4 space-y-4">
                  {loadingChannelMsgs ? (
                    <div className="flex justify-center py-10">
                      <div className="w-5 h-5 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/>
                    </div>
                  ) : channelMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Hash className="w-10 h-10 text-white/10"/>
                      <p className="text-sm text-white/30">No messages yet. Start the conversation!</p>
                    </div>
                  ) : channelMessages.map(msg => {
                    const sender = msg.from?.user?.displayName || "Unknown";
                    const initials = sender.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                    const bodyText = (msg.body?.content || "").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim();
                    const ts = msg.createdDateTime ? new Date(msg.createdDateTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "";
                    return (
                      <div key={msg.id} className="flex gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-[#6264A7]/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#c7c9f3]">{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold">{sender}</span>
                            <span className="text-[11px] text-white/35">{ts}</span>
                          </div>
                          <p className="text-sm text-white/75 mt-0.5 leading-relaxed">{bodyText || <em className="text-white/30">attachment</em>}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compose box */}
                <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-[#2a2a3a] rounded-xl px-4 py-2 border border-white/10">
                    <input
                      value={channelInput}
                      onChange={e => setChannelInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChannelMessage())}
                      placeholder={`Message #${selectedChannel.displayName}`}
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                    />
                    <button
                      onClick={sendChannelMessage}
                      disabled={!channelInput.trim()}
                      className="p-1.5 rounded-lg bg-[#6264A7] hover:bg-[#7375b5] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 text-white"/>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#6264A7]/20 flex items-center justify-center"><Users className="w-7 h-7 text-[#6264A7]"/></div>
                <div className="text-center"><p className="text-sm font-semibold text-white/40">Select a channel</p><p className="text-xs text-white/25 mt-1">Choose a team and channel to get started</p></div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ FILES ════════════════════════════════════════════════ */}
      {section === "files" && (
        <>
          <div className="w-64 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-white/10">
              <h2 className="text-base font-semibold mb-3">Files</h2>
              <div className="flex gap-1.5">
                {["recent","shared","downloads"].map(t=>(
                  <button key={t} onClick={()=>setFilesTab(t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize transition-all ${filesTab===t?"border-[#6264A7]/60 bg-[#6264A7]/20 text-white":"border-white/15 text-white/40 hover:text-white/70"}`}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto teams-scrollbar p-2 space-y-0.5">
              {!isMsalConnected ? null : loadingJoinedTeams ? (
                <div className="flex justify-center py-6"><div className="w-4 h-4 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/></div>
              ) : joinedTeams.length > 0 ? (
                joinedTeams.map((team, idx) => {
                  const TEAM_COLORS = ["#6264A7","#e45c8a","#f4a261","#2ec4b6","#059669","#7c3aed","#0891b2","#d97706"];
                  const color = TEAM_COLORS[idx % TEAM_COLORS.length];
                  return (
                    <button key={team.id} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 transition-all">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor:color+"22",color}}>
                        <span className="text-[11px] font-bold">{team.displayName?.slice(0,2)?.toUpperCase()||"TM"}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-white/80 truncate">{team.displayName}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center py-8 gap-2">
                  <FolderOpen className="w-7 h-7 text-white/15"/>
                  <p className="text-[11px] text-white/30">No teams</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 bg-[#1e1e2e] overflow-y-auto teams-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-white/70">Recent files</h3>
                  <p className="text-[11px] text-white/35 mt-0.5">From your OneDrive</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={fetchOneDriveFiles} title="Refresh" className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 transition-colors"><RefreshCw className="w-4 h-4"/></button>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-lg text-xs text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors"><Plus className="w-3.5 h-3.5"/>Upload</button>
                </div>
              </div>
              {!isMsalConnected ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FolderOpen className="w-10 h-10 text-white/15"/>
                  <p className="text-sm text-white/35 mb-1">Sign in to see your files</p>
                  <button onClick={handleTeamsLogin} className="px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium">Sign in</button>
                </div>
              ) : loadingFiles ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/></div>
              ) : filesError ? (
                <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-300">{filesError}</p>
                  <button onClick={fetchOneDriveFiles} className="text-xs text-[#6264A7] mt-1">Retry</button>
                </div>
              ) : oneDriveFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FolderOpen className="w-10 h-10 text-white/15"/>
                  <p className="text-sm text-white/30">No recent files found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {oneDriveFiles.map(file => {
                    const s = fileStyle(file);
                    const author = file.lastModifiedBy?.user?.displayName || "";
                    return (
                      <div key={file.id}
                        onClick={() => file.webUrl && setMediaPreview({ type: "file", url: file.webUrl, name: file.name, ext: (file.name||"").split(".").pop().toUpperCase() || "FILE" })}
                        onMouseEnter={e => {
                          clearTimeout(fileHoverTimer.current);
                          fileHoverTimer.current = setTimeout(() => setFileHover({ x: e.clientX, y: e.clientY, file }), 350);
                        }}
                        onMouseMove={e => {
                          if (!fileHover || fileHover.file?.id !== file.id) {
                            clearTimeout(fileHoverTimer.current);
                            fileHoverTimer.current = setTimeout(() => setFileHover({ x: e.clientX, y: e.clientY, file }), 350);
                          }
                        }}
                        onMouseLeave={() => { clearTimeout(fileHoverTimer.current); setFileHover(null); }}
                        className="flex items-center gap-4 p-3.5 bg-[#1a1a2e] rounded-xl border border-white/8 hover:border-[#6264A7]/30 cursor-pointer transition-all group">
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-[11px] font-bold ${s.text}`}>{s.label}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {file.size && <span className="text-[11px] text-white/35">{fmtFileSize(file.size)}</span>}
                            {file.size && <span className="text-white/20">·</span>}
                            <span className="text-[11px] text-white/35">{fmtDate(file.lastModifiedDateTime)}</span>
                            {author && <><span className="text-white/20">·</span><span className="text-[11px] text-white/35">{author}</span></>}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); file.webUrl && setMediaPreview({ type: "file", url: file.webUrl, name: file.name, ext: (file.name||"").split(".").pop().toUpperCase() || "FILE" }); }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#6264A7]/30 hover:bg-[#6264A7]/55 text-white/80 hover:text-white text-xs font-medium transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                          Open
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setFileMenuPos({ x: e.clientX, y: e.clientY, file }); }}
                          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors flex-shrink-0" title="More options">
                          <MoreHorizontal className="w-5 h-5"/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══ COPILOT ══════════════════════════════════════════════ */}
      {section === "copilot" && (
        <div className="flex-1 flex flex-col bg-[#1e1e2e] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 bg-[#1a1a2e] flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6264A7] to-[#c77dff] flex items-center justify-center shadow-lg shadow-purple-500/20 text-lg">✨</div>
            <div>
              <h2 className="text-base font-semibold">Copilot</h2>
              <p className="text-xs text-white/40">AI-powered Microsoft 365 assistant</p>
            </div>
          </div>
          <div className="px-5 py-2.5 border-b border-white/8 bg-[#191928] flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {["Summarize chats","Draft message","Meeting notes","Find files","Create tasks","Translate"].map(cap=>(
                <button key={cap} onClick={()=>setCopilotQuery(cap)}
                  className="px-2.5 py-1 bg-[#6264A7]/15 hover:bg-[#6264A7]/25 border border-[#6264A7]/25 rounded-full text-xs text-[#c7c9f3] transition-colors">{cap}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto teams-scrollbar p-5 space-y-4">
            {copilotHistory.map(item=>(
              <div key={item.id} className={`flex gap-3 ${item.role==="user"?"justify-end":""}`}>
                {item.role==="ai"&&<div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6264A7] to-[#c77dff] flex items-center justify-center text-sm flex-shrink-0 shadow-md">✨</div>}
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${item.role==="ai"?"bg-[#2a2a3a] text-white/85 rounded-tl-sm border border-white/8":"bg-[#6264A7] text-white rounded-tr-sm"}`}>
                  {item.text}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 pt-3 border-t border-white/8 flex-shrink-0">
            <div className="bg-[#2a2a3a] border border-white/12 rounded-xl overflow-hidden focus-within:border-[#6264A7]/50 transition-colors">
              <div className="px-4 pt-3 pb-1">
                <input type="text" placeholder="Ask Copilot anything…" value={copilotQuery}
                  onChange={e=>setCopilotQuery(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&handleCopilotSend()}
                  className="w-full bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"/>
              </div>
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex items-center gap-0.5">
                  <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors"><Paperclip className="w-4 h-4"/></button>
                  <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors"><Mic className="w-4 h-4"/></button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-px h-5 bg-white/12"/>
                  <button onClick={handleCopilotSend} disabled={!copilotQuery.trim()}
                    className={`p-1.5 rounded-lg transition-colors ${copilotQuery.trim()?"text-[#6264A7] hover:bg-[#6264A7]/15":"text-white/15 cursor-not-allowed"}`}>
                    <Send className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-white/20 text-center mt-2">Copilot uses AI — verify important information</p>
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ════════════════════════════════════════ */}
      {section === "chat" && (
        <>
          {/* Chat List */}
          <div className="w-80 bg-[#1a1a2e] border-r border-white/10 flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10">
              {/* Title row */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h2 className="text-[15px] font-bold text-white">Chat</h2>
                <div className="flex items-center gap-0.5 relative">
                  {/* More (…) */}
                  <button onClick={() => setChatMenuOpen(!chatMenuOpen)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4"/>
                  </button>
                  {/* Search */}
                  <button onClick={() => { setChatSearchOpen(o => !o); setChatSearch(""); }}
                    className={`p-1.5 rounded-lg transition-colors ${chatSearchOpen ? "text-[#6264A7]" : "hover:bg-white/10 text-white/60 hover:text-white"}`}>
                    <Search className="w-4 h-4"/>
                  </button>
                  {/* Compose / New message */}
                  <button onClick={() => { setNmQuery(""); setNmRecipients([]); setNmBody(""); setShowNewMessage(true); setSelectedChat(null); }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors" title="New message">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                    </svg>
                  </button>
                  {/* Chevron down */}
                  <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                    <ChevronDown className="w-4 h-4"/>
                  </button>

                  {/* Dropdown Menu */}
                  {chatMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#2a2a3a] border border-white/10 rounded-lg shadow-xl z-50 py-2">
                      <button onClick={() => { setChatMenuOpen(false); setNmQuery(""); setNmRecipients([]); setNmBody(""); setShowNewMessage(true); setSelectedChat(null); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-all text-white text-sm">
                        <MessageSquare className="w-4 h-4" />
                        <span>New message</span>
                      </button>
                      <button onClick={() => { setChatMenuOpen(false); setCcTeamId(""); setCcName(""); setCcDesc(""); setCcType(""); setCcError(""); setShowCreateChannel(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-all text-white text-sm">
                        <Hash className="w-4 h-4" />
                        <span>New channel</span>
                      </button>
                      <button onClick={() => { setChatMenuOpen(false); setSection("chat"); setChatFilter("all"); setTimeout(() => { const el = document.getElementById("teams-storyline-section"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 200); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-all text-white text-sm">
                        <BookOpen className="w-4 h-4" />
                        <span>New storyline post</span>
                      </button>
                      <div className="border-t border-white/10 my-1"/>
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-all text-white text-sm">
                        <Users className="w-4 h-4" />
                        <span>Join team</span>
                      </button>
                      <button onClick={() => { setChatMenuOpen(false); setCtName(""); setCtDesc(""); setCtVisibility("private"); setCtChannel(""); setCtError(""); setShowCreateTeam(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-all text-white text-sm">
                        <Plus className="w-4 h-4" />
                        <span>New team</span>
                      </button>
                      <button onClick={() => { setChatMenuOpen(false); setCsName(""); setShowCreateSection(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-all text-white text-sm">
                        <Layers className="w-4 h-4" />
                        <span>New section</span>
                      </button>
                    </div>
                  )}
                  {chatMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setChatMenuOpen(false)}/>}
                </div>
              </div>

              {/* Search input — underline style, shown when chatSearchOpen */}
              {chatSearchOpen && (
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2 border-b-2 border-[#6264A7] pb-1">
                    <input
                      autoFocus
                      value={chatSearch}
                      onChange={e => setChatSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === "Escape") { setChatSearchOpen(false); setChatSearch(""); } }}
                      placeholder="Filter by person, chat or channel"
                      className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
                    />
                    {chatSearch && (
                      <button onClick={() => setChatSearch("")} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                        <X className="w-3.5 h-3.5"/>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Filter chips — always visible below search/title */}
              {(() => {
                const chips = [
                  { key: "unread",   label: "Unread" },
                  { key: "channels", label: "Channels" },
                  { key: "chats",    label: "Chats" },
                ];
                const extraChips = [
                  { key: "all",      label: "All" },
                  { key: "read",     label: "Read" },
                  { key: "groups",   label: "Groups" },
                  { key: "meetings", label: "Meeting chats" },
                ];
                const visibleChips = showExtraChips ? [...chips, ...extraChips] : chips;
                return (
                  <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
                    {visibleChips.map(({ key, label }) => {
                      const active = chatFilter === key;
                      return (
                        <button key={key}
                          onClick={() => setChatFilter(active ? "all" : key)}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap
                            ${active
                              ? "border-[#6264A7]/60 bg-[#6264A7]/20 text-white"
                              : "border-white/20 text-white/65 hover:border-white/40 hover:text-white"}`}>
                          {label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setShowExtraChips(p => !p)}
                      className="p-1 rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white/40 transition-colors flex-shrink-0">
                      <ChevronDown className={`w-3 h-3 transition-transform ${showExtraChips ? "rotate-180" : ""}`}/>
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto teams-scrollbar">
              {!isMsalConnected ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white/50 text-sm mb-2">Sign in to Teams</p>
                  <button
                    onClick={handleTeamsLogin}
                    className="px-3 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg transition-all">
                    Sign in
                  </button>
                </div>
              ) : (
                <div className="p-2">
                  {/* Copilot */}
                  <button onClick={() => setSection("copilot")}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/8 transition-all text-white/65 hover:text-white mb-1">
                    <div className="w-7 h-7 rounded-lg bg-[#6264A7]/35 flex items-center justify-center text-sm flex-shrink-0">✨</div>
                    <span className="text-sm font-medium">Copilot</span>
                  </button>

                  {/* Quick views */}
                  <div className="mb-3">
                    <button onClick={() => setExpandedSections(p => ({...p, quickViews: !p.quickViews}))}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-white/45 hover:text-white/75 transition-all">
                      <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${expandedSections.quickViews ? "rotate-90" : ""}`}/>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Quick views</span>
                    </button>
                    {expandedSections.quickViews && (
                      <div className="space-y-0.5">
                        {[
                          [AtSign,   "Mentions", "mentions"],
                          [Globe,    "Discover",  "discover"],
                          [Pencil,   "Drafts",    "drafts"],
                          [Bookmark, "Saved",     "saved"],
                        ].map(([Icon, label, key]) => (
                          <button key={key}
                            onClick={() => { setQuickView(key); setSelectedChat(null); setSelectedQuickItem(null); setQvFilter("all"); }}
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/8 transition-all text-sm ${quickView === key ? "bg-[#6264A7]/20 text-white" : "text-white/55 hover:text-white"}`}>
                            <Icon className="w-3.5 h-3.5 flex-shrink-0"/>{label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Favorites Section */}
                  <div className="mb-4">
                    <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, favorites: !prev.favorites }))}
                      className="w-full flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-all">
                      <ChevronLeft className={`w-4 h-4 transition-transform ${expandedSections.favorites ? "rotate-90" : ""}`} />
                      <span className="text-xs font-medium">Favourites</span>
                    </button>
                    {expandedSections.favorites && favoriteChats.size > 0 && (
                      <div className="px-2 space-y-1">
                        {filteredChats.filter(chat => favoriteChats.has(chat.id)).map((chat) => (
                          <button
                            key={chat.id}
                            onClick={() => {
                              setSelectedChat(chat);
                              markChatRead(chat.id);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                              selectedChat?.id === chat.id 
                                ? "bg-[#6264A7]/40 text-white" 
                                : "hover:bg-white/10 text-white/70 hover:text-white"
                            }`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 relative ${
                              selectedChat?.id === chat.id ? "bg-[#6264A7]" : "bg-[#6264A7]/50"
                            }`}>
                              {getChatName(chat)?.charAt(0)?.toUpperCase() || "?"}
                              <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border-2 border-[#1a1a2e]" />
                            </div>
                            <span className="text-sm truncate flex-1">{getChatName(chat)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chats Section */}
                  <div>
                    <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, chats: !prev.chats }))}
                      className="w-full flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-all">
                      <ChevronLeft className={`w-4 h-4 transition-transform ${expandedSections.chats ? "rotate-90" : ""}`} />
                      <span className="text-xs font-medium">Chats</span>
                    </button>
                    {expandedSections.chats && (
                      loadingChats ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-4 h-4 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : chatError ? (
                        <div className="m-2 p-2 bg-red-900/30 border border-red-500/20 rounded-lg">
                          <p className="text-xs text-red-300">{chatError}</p>
                        </div>
                      ) : filteredChats.length === 0 ? (
                        <div className="flex items-center justify-center py-4 px-4 text-center">
                          <p className="text-xs text-white/40">No chats found</p>
                        </div>
                      ) : (
                        <div className="px-2 space-y-1">
                          {/* New message entry */}
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                              showNewMessage ? "bg-white/8" : "hover:bg-white/8"
                            }`}
                            onClick={() => { setNmQuery(""); setNmRecipients([]); setNmBody(""); setShowNewMessage(true); setSelectedChat(null); }}>
                            <div className="w-8 h-8 rounded-full bg-[#2a2a3a] border border-white/15 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                              </svg>
                            </div>
                            <span className={`text-sm font-semibold ${showNewMessage ? "text-white" : "text-white/80"}`}>New message</span>
                          </div>

                          {filteredChats.map((chat) => {
                            const unreadCount = chatUnreadCounts[chat.id] || 0;
                            const preview = chatPreviews[chat.id];
                            const hasContextMenu = activeChatContextMenu === chat.id;
                            const isMutedChat  = mutedChats.has(chat.id);
                            const isManualUnread = unreadChats.has(chat.id);
                            return (
                              <div
                                key={chat.id}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group relative ${
                                  selectedChat?.id === chat.id
                                    ? "bg-[#6264A7]/40"
                                    : "hover:bg-white/10"
                                }`}>
                                <button
                                  onClick={() => {
                                    setSelectedChat(chat);
                                    setQuickView(null);
                                    markChatRead(chat.id);
                                    setShowNewMessage(false);
                                  }}
                                  className="flex-1 flex items-center gap-3 min-w-0">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 relative ${
                                    selectedChat?.id === chat.id ? "bg-[#6264A7]" : "bg-[#6264A7]/50"
                                  }`}>
                                    {getChatName(chat)?.charAt(0)?.toUpperCase() || "?"}
                                    <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border-2 border-[#1a1a2e]" />
                                  </div>
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className={`text-sm truncate ${(unreadCount > 0 || isManualUnread) ? "font-semibold text-white" : "text-white/80"}`}>{getChatName(chat)}</p>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {isMutedChat && <VolumeX className="w-3 h-3 text-white/30"/>}
                                        {preview?.time && <span className="text-[10px] text-white/30">{preview.time}</span>}
                                      </div>
                                    </div>
                                    {preview?.text ? (
                                      <p className={`text-[11px] truncate mt-0.5 ${(unreadCount > 0 || isManualUnread) ? "text-white/70" : "text-white/40"}`}>{preview.text}</p>
                                    ) : null}
                                  </div>
                                  {(unreadCount > 0 || isManualUnread) && (
                                    <span className="text-[10px] font-bold text-white bg-red-500 min-w-[18px] h-[18px] flex items-center justify-center rounded-full flex-shrink-0 px-1">
                                      {unreadCount > 0 ? unreadCount : "•"}
                                    </span>
                                  )}
                                </button>
                                
                                {/* Three-dot — visible only on row hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setChatCtxPos({ x: rect.left, y: rect.bottom + 4 });
                                      setActiveChatContextMenu(hasContextMenu ? null : chat.id);
                                    }}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="More options">
                                    <MoreVertical className="w-4 h-4 text-white/70" />
                                  </button>
                                </div>

                                {/* Context Menu Dropdown */}
                                {hasContextMenu && (
                                  <div className="fixed z-[200] w-60 bg-[#1e1f35] border border-white/10 rounded-xl shadow-2xl py-1.5 overflow-hidden"
                                    style={{
                                      left: Math.min(chatCtxPos.x, window.innerWidth - 256),
                                      top: Math.min(chatCtxPos.y, window.innerHeight - 440),
                                    }}
                                    onClick={e => e.stopPropagation()}>

                                    {/* Open in new window */}
                                    <button
                                      onClick={() => {
                                        window.open(`https://teams.microsoft.com/l/chat/${chat.id}`, "_blank");
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <ExternalLink className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>Open in new window</span>
                                    </button>

                                    {/* Mark as unread */}
                                    <button
                                      onClick={() => {
                                        setChatUnreadCounts(p => ({ ...p, [chat.id]: (p[chat.id] || 0) > 0 ? 0 : 1 }));
                                        showMsgToast((chatUnreadCounts[chat.id] || 0) > 0 ? "Marked as read." : "Marked as unread.");
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <EyeOff className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>{(chatUnreadCounts[chat.id] || 0) > 0 ? "Mark as read" : "Mark as unread"}</span>
                                    </button>

                                    {/* Move to (with submenu) */}
                                    <div className="relative group/moveto">
                                      <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                        <div className="flex items-center gap-3">
                                          <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25"/></svg>
                                          <span>Move to</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-white/40"/>
                                      </button>
                                      {/* Submenu */}
                                      <div className="absolute left-full top-0 w-44 bg-[#1e1f35] border border-white/10 rounded-xl shadow-2xl py-1.5 hidden group-hover/moveto:block z-[210]">
                                        <button
                                          onClick={() => {
                                            setFavoriteChats(prev => { const s = new Set(prev); s.has(chat.id) ? s.delete(chat.id) : s.add(chat.id); return s; });
                                            showMsgToast(favoriteChats.has(chat.id) ? "Removed from Favourites." : "Added to Favourites.");
                                            setActiveChatContextMenu(null);
                                          }}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                          <svg className="w-4 h-4 text-white/50" fill={favoriteChats.has(chat.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
                                          {favoriteChats.has(chat.id) ? "Remove from Favourites" : "Favourites"}
                                        </button>
                                        <button
                                          onClick={() => { showMsgToast("Moved to General section."); setActiveChatContextMenu(null); }}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                          <Hash className="w-4 h-4 text-white/50"/>
                                          General
                                        </button>
                                      </div>
                                    </div>

                                    {/* Mute */}
                                    <button
                                      onClick={() => {
                                        setMutedChats(prev => { const s = new Set(prev); s.has(chat.id) ? s.delete(chat.id) : s.add(chat.id); return s; });
                                        showMsgToast(mutedChats.has(chat.id) ? "Chat unmuted." : "Chat muted.");
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <VolumeX className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>{mutedChats.has(chat.id) ? "Unmute" : "Mute"}</span>
                                    </button>

                                    {/* Notify when available */}
                                    <button
                                      onClick={() => {
                                        showMsgToast(`You'll be notified when ${getChatName(chat)} is available.`);
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <Bell className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>Notify when available</span>
                                    </button>

                                    {/* Manage apps */}
                                    <button
                                      onClick={() => {
                                        window.open("https://teams.microsoft.com/_#/apps", "_blank");
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"/></svg>
                                      <span>Manage apps</span>
                                    </button>

                                    {/* Workflows */}
                                    <button
                                      onClick={() => {
                                        window.open("https://make.powerautomate.com/", "_blank");
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <Share2 className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>Workflows</span>
                                    </button>

                                    {/* Copy link */}
                                    <button
                                      onClick={() => {
                                        const link = `https://teams.microsoft.com/l/chat/${chat.id}`;
                                        navigator.clipboard.writeText(link).catch(() => {});
                                        showMsgToast("Chat link copied to clipboard.");
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <Link2 className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>Copy link</span>
                                    </button>

                                    <div className="border-t border-white/10 my-1"/>

                                    {/* Remove chat history */}
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Remove chat history with ${getChatName(chat)}? This cannot be undone.`)) {
                                          showMsgToast("Chat history removed.");
                                        }
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-rose-300/80 hover:text-rose-300 text-sm">
                                      <Trash2 className="w-4 h-4 flex-shrink-0"/>
                                      <span>Remove chat history</span>
                                    </button>

                                    {/* Hide */}
                                    <button
                                      onClick={() => {
                                        setHiddenChats(prev => { const s = new Set(prev); s.add(chat.id); return s; });
                                        if (selectedChat?.id === chat.id) setSelectedChat(null);
                                        showMsgToast(`${getChatName(chat)} hidden.`);
                                        setActiveChatContextMenu(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors text-white/90 text-sm">
                                      <EyeOff className="w-4 h-4 text-white/50 flex-shrink-0"/>
                                      <span>Hide</span>
                                    </button>
                                  </div>
                                )}

                                {/* Close menu when clicking outside */}
                                {hasContextMenu && (
                                  <div className="fixed inset-0 z-[199]" onClick={() => setActiveChatContextMenu(null)}/>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      )
                    )}
                  </div>

                  {/* Teams and channels */}
                  <div className="mt-3">
                    <button onClick={() => setExpandedSections(p => ({...p, teamsChannels: !p.teamsChannels}))}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-white/45 hover:text-white/75 transition-all">
                      <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${expandedSections.teamsChannels ? "rotate-90" : ""}`}/>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Teams and channels</span>
                    </button>
                    {expandedSections.teamsChannels && (
                      loadingJoinedTeams ? (
                        <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/></div>
                      ) : joinedTeams.length === 0 ? (
                        <p className="text-xs text-white/25 px-4 py-2">No teams found</p>
                      ) : (
                        <div className="space-y-0.5">
                          {joinedTeams.map((team, idx) => {
                            const TCOLORS = ["#6264A7","#e45c8a","#f4a261","#2ec4b6","#059669","#7c3aed","#0891b2","#d97706"];
                            const color = TCOLORS[idx % TCOLORS.length];
                            const isExp = expandedTeams.has(team.id);
                            const channels = teamChannels[team.id] || [];
                            return (
                              <div key={team.id}>
                                <button onClick={() => {
                                  setExpandedTeams(p => { const s = new Set(p); s.has(team.id) ? s.delete(team.id) : s.add(team.id); return s; });
                                  if (!teamChannels[team.id]) fetchTeamChannels(team.id);
                                }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/8 transition-all">
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                    style={{backgroundColor:color+"25",color}}>
                                    {team.displayName?.slice(0,2)?.toUpperCase()||"TM"}
                                  </div>
                                  <span className="text-sm text-white/70 truncate flex-1 text-left">{team.displayName}</span>
                                  <ChevronRight className={`w-3 h-3 text-white/25 flex-shrink-0 transition-transform ${isExp?"rotate-90":""}`}/>
                                </button>
                                {isExp && (
                                  <div className="ml-5 space-y-0.5 mb-1">
                                    {loadingChannels[team.id] ? (
                                      <div className="flex justify-center py-2"><div className="w-3 h-3 border border-[#6264A7] border-t-transparent rounded-full animate-spin"/></div>
                                    ) : channels.slice(0,6).map(ch => (
                                      <button key={ch.id}
                                        onClick={() => { setSelectedChannel(ch); setSection("teams"); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/8 transition-all text-left">
                                        <Hash className="w-3 h-3 text-white/25 flex-shrink-0"/>
                                        <span className="text-xs text-white/50 truncate">{ch.displayName}</span>
                                      </button>
                                    ))}
                                    {channels.length > 6 && (
                                      <button onClick={() => setSection("teams")}
                                        className="w-full px-3 py-1.5 text-xs text-[#6264A7] hover:text-[#8385c7] text-left transition-colors">
                                        See all channels
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* Toast notification */}
          {msgToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 bg-[#2a2a3a] border border-white/15 rounded-xl shadow-2xl text-sm text-white/90 pointer-events-none">
              {msgToast}
            </div>
          )}

          {/* ── Media / File preview lightbox ── */}
          {mediaPreview && (
            <div
              className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setMediaPreview(null)}>
              <div
                className="relative max-w-4xl w-full mx-4 bg-[#1a1b2e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                  <p className="text-sm font-medium text-white/80 truncate">{mediaPreview.name}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={mediaPreview.url} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 text-xs bg-[#6264A7] hover:bg-[#7375b5] text-white rounded-lg transition-colors">
                      Open
                    </a>
                    <a href={mediaPreview.url} download={mediaPreview.name}
                      className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors">
                      Download
                    </a>
                    <button onClick={() => setMediaPreview(null)}
                      className="p-1.5 rounded-lg hover:bg-white/15 text-white/50 hover:text-white transition-colors">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
                {/* Content */}
                <div className="flex items-center justify-center p-6 min-h-[200px] max-h-[80vh] overflow-auto">
                  {mediaPreview.type === "image" ? (
                    <img src={mediaPreview.url} alt={mediaPreview.name}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="w-20 h-20 rounded-2xl bg-[#6264A7]/20 flex items-center justify-center">
                        <span className="text-2xl font-bold text-[#8385c7]">{(mediaPreview.ext || mediaPreview.name?.split(".").pop()?.toUpperCase() || "FILE").slice(0,4)}</span>
                      </div>
                      <p className="text-white/70 text-sm font-medium text-center">{mediaPreview.name}</p>
                      <p className="text-white/30 text-xs text-center">Click Open to view or Download to save</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Fixed context menu (rendered outside scroll container so no overflow clipping) ── */}
          {ctxMenu && (
            <>
              <div className="fixed inset-0 z-[199]" onClick={() => setCtxMenu(null)} />
              <div
                className="fixed w-56 bg-[#1a1b2e] border border-white/10 rounded-xl shadow-2xl z-[200] py-1 overflow-hidden"
                style={{
                  left: Math.min(ctxMenu.x, window.innerWidth - 236),
                  top:  Math.min(ctxMenu.y, window.innerHeight - 400),
                }}>

                <button onClick={() => {
                  setReplyTo({
                    id:     ctxMenu.msg.id,
                    sender: ctxMenu.msg.from?.user?.displayName || "Someone",
                    text:   ctxMenu.msgText || "",
                  });
                  setCtxMenu(null);
                  setTimeout(() => composerInputRef.current?.focus(), 50);
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" /> Reply with quote
                </button>

                <button onClick={() => {
                  setForwardModal({ msg: ctxMenu.msg, msgText: ctxMenu.msgText });
                  setForwardSearch("");
                  setForwardingTo(null);
                  setCtxMenu(null);
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Share2 className="w-4 h-4 flex-shrink-0" /> Forward
                </button>

                <button onClick={() => {
                  copyToClipboard(ctxMenu.msgText || ctxMenu.msg.id);
                  setCtxMenu(null);
                  showMsgToast("Message text copied.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Link2 className="w-4 h-4 flex-shrink-0" /> Copy link
                </button>

                <button onClick={() => {
                  const isSaved = savedMessages.has(ctxMenu.msg.id);
                  setSavedMessages(prev => { const s = new Set(prev); isSaved ? s.delete(ctxMenu.msg.id) : s.add(ctxMenu.msg.id); return s; });
                  if (isSaved) {
                    setSavedMsgData(prev => prev.filter(d => d.id !== ctxMenu.msg.id));
                  } else {
                    setSavedMsgData(prev => [...prev, {
                      id: ctxMenu.msg.id,
                      msg: ctxMenu.msg,
                      msgText: ctxMenu.msgText || "",
                      chatId: selectedChat?.id || "",
                      chatName: selectedChat ? getChatName(selectedChat) : "Unknown",
                      savedAt: new Date().toISOString(),
                    }]);
                  }
                  setCtxMenu(null);
                  showMsgToast(isSaved ? "Removed from saved." : "Message saved.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Bookmark className={`w-4 h-4 flex-shrink-0 ${savedMessages.has(ctxMenu.msg.id) ? "text-[#6264A7]" : ""}`} />
                  {savedMessages.has(ctxMenu.msg.id) ? "Unsave message" : "Save this message"}
                </button>

                {ctxMenu.isOwn && (
                  <button onClick={() => {
                    handleDeleteMessage(ctxMenu.msg.id);
                    setCtxMenu(null);
                    showMsgToast("Message deleted.");
                  }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-rose-300 text-xs transition-colors">
                    <Trash2 className="w-4 h-4 flex-shrink-0" /> Delete
                  </button>
                )}

                <div className="border-t border-white/10 my-1" />

                <button onClick={() => {
                  setCtxMenu(null);
                  showMsgToast("Pinned for everyone.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Pin className="w-4 h-4 flex-shrink-0" /> Pin for everyone
                </button>

                <button onClick={() => {
                  if (selectedChat) {
                    setChatUnreadCounts(p => ({...p, [selectedChat.id]: 1}));
                    lastReadTimesRef.current[selectedChat.id] = new Date(ctxMenu.msg.createdDateTime || Date.now() - 1000).toISOString();
                    try { localStorage.setItem("teams_lastRead", JSON.stringify(lastReadTimesRef.current)); } catch {}
                  }
                  setCtxMenu(null);
                  showMsgToast("Marked as unread.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <EyeOff className="w-4 h-4 flex-shrink-0" /> Mark as unread
                </button>

                <button onClick={() => {
                  const sender = ctxMenu.msg.from?.user?.displayName || "Someone";
                  const body = ctxMenu.msgText || "[Media message]";
                  window.open(`mailto:?subject=${encodeURIComponent(`Message from ${sender}`)}&body=${encodeURIComponent(body)}`, "_blank");
                  setCtxMenu(null);
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Mail className="w-4 h-4 flex-shrink-0" /> Share to Outlook
                </button>

                <button onClick={() => {
                  const text = ctxMenu.msgText;
                  if (text) { copyToClipboard(text); showMsgToast("Text copied — paste into translator."); }
                  else showMsgToast("No text to translate.");
                  setCtxMenu(null);
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Globe className="w-4 h-4 flex-shrink-0" /> Translation
                </button>

                <button onClick={() => setCtxMenu(null)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/40 text-xs transition-colors">
                  <MoreHorizontal className="w-4 h-4 flex-shrink-0" /> More actions
                </button>
              </div>
            </>
          )}

          {/* ── Forward chat-picker modal ── */}
          {forwardModal && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-[420px] bg-[#1a1a2e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">Forward message</h3>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">"{(forwardModal.msgText || "[Media message]").slice(0,60)}"</p>
                  </div>
                  <button onClick={() => setForwardModal(null)} className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                </div>
                {/* Search */}
                <div className="px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-[#6264A7]/50 transition-colors">
                    <Search className="w-3.5 h-3.5 text-white/30 flex-shrink-0"/>
                    <input
                      autoFocus
                      placeholder="Search people or chats…"
                      value={forwardSearch}
                      onChange={e => setForwardSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                  </div>
                </div>
                {/* Chat list */}
                <div className="flex-1 overflow-y-auto teams-scrollbar">
                  {chats
                    .filter(c => getChatName(c).toLowerCase().includes(forwardSearch.toLowerCase()))
                    .map(chat => (
                      <button key={chat.id}
                        onClick={() => setForwardingTo(chat)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition-all ${forwardingTo?.id === chat.id ? "bg-[#6264A7]/20" : ""}`}>
                        <div className="w-9 h-9 rounded-full bg-[#6264A7]/40 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {getChatName(chat).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-white/85 truncate font-medium">{getChatName(chat)}</p>
                          {chatPreviews[chat.id]?.text && (
                            <p className="text-[11px] text-white/35 truncate">{chatPreviews[chat.id].text}</p>
                          )}
                        </div>
                        {forwardingTo?.id === chat.id && <Check className="w-4 h-4 text-[#6264A7] flex-shrink-0"/>}
                      </button>
                    ))}
                  {chats.filter(c => getChatName(c).toLowerCase().includes(forwardSearch.toLowerCase())).length === 0 && (
                    <div className="flex flex-col items-center py-10 gap-2">
                      <MessageSquare className="w-8 h-8 text-white/15"/>
                      <p className="text-xs text-white/30">No chats found</p>
                    </div>
                  )}
                </div>
                {/* Footer */}
                <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between gap-3">
                  <p className="text-xs text-white/30">{forwardingTo ? `Send to: ${getChatName(forwardingTo)}` : "Select a chat to forward to"}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setForwardModal(null); setForwardingTo(null); setForwardSearch(""); }}
                      className="px-4 py-1.5 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                      Cancel
                    </button>
                    <button
                      disabled={!forwardingTo || forwardSending}
                      onClick={async () => {
                        if (!forwardingTo || !accessToken) return;
                        setForwardSending(true);
                        try {
                          const sender = forwardModal.msg.from?.user?.displayName || "Someone";
                          const text = forwardModal.msgText || "[Media message]";
                          const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
                          const fwdHtml = `<div style="border-left:3px solid #6264A7;padding:4px 10px;margin-bottom:6px;border-radius:0 6px 6px 0;background:rgba(98,100,167,0.08)"><span style="font-size:10px;color:#8385c7;font-weight:600">↪ Forwarded from ${esc(sender)}</span><br><span style="font-size:12px;opacity:0.72">${esc(text.slice(0,400))}</span></div>`;
                          const res = await window.fetch(`https://graph.microsoft.com/v1.0/chats/${forwardingTo.id}/messages`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ body: { contentType: "html", content: fwdHtml } }),
                          });
                          if (!res.ok) throw new Error(res.status);
                          showMsgToast(`Forwarded to ${getChatName(forwardingTo)}.`);
                          setForwardModal(null); setForwardingTo(null); setForwardSearch("");
                        } catch {
                          showMsgToast("Failed to forward. Check permissions.");
                        } finally {
                          setForwardSending(false);
                        }
                      }}
                      className={`px-4 py-1.5 text-xs text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                        forwardingTo && !forwardSending ? "bg-[#6264A7] hover:bg-[#7375b5]" : "bg-white/10 cursor-not-allowed text-white/40"
                      }`}>
                      {forwardSending ? (
                        <><div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin"/>Sending…</>
                      ) : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── File hover info card ── */}
          {fileHover && (() => {
            const f = fileHover.file;
            const s = fileStyle(f);
            const ext = (f.name || "").split(".").pop()?.toUpperCase() || "";
            const mime = f.file?.mimeType || "";
            const author = f.lastModifiedBy?.user?.displayName || "—";
            const modDate = f.lastModifiedDateTime
              ? new Date(f.lastModifiedDateTime).toLocaleString([], { weekday:"short", year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })
              : "—";
            const path = (() => {
              const raw = f.parentReference?.path || "";
              const idx = raw.indexOf("/root:/");
              return idx !== -1 ? raw.slice(idx + 7) || "My Files" : raw || "OneDrive";
            })();
            const cardW = 280, cardH = 220;
            const left = Math.min(fileHover.x + 18, window.innerWidth - cardW - 8);
            const top  = Math.min(fileHover.y - 30, window.innerHeight - cardH - 8);
            return (
              <div
                className="fixed z-[199] pointer-events-none"
                style={{ left, top, width: cardW }}>
                <div className="bg-[#1a1b2e] border border-white/12 rounded-2xl shadow-2xl overflow-hidden">
                  {/* Header strip */}
                  <div className={`px-4 py-3 flex items-center gap-3 ${s.bg} bg-opacity-30`}>
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-[11px] font-bold ${s.text}`}>{s.label}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight break-all line-clamp-2">{f.name}</p>
                      {ext && <p className="text-[10px] text-white/40 mt-0.5">{ext} file{mime ? ` · ${mime}` : ""}</p>}
                    </div>
                  </div>
                  {/* Details */}
                  <div className="px-4 py-3 space-y-2">
                    {f.size != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/35 uppercase tracking-wide">Size</span>
                        <span className="text-[11px] text-white/70 font-medium">{fmtFileSize(f.size)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/35 uppercase tracking-wide">Modified</span>
                      <span className="text-[11px] text-white/70 font-medium text-right max-w-[160px] truncate">{modDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/35 uppercase tracking-wide">By</span>
                      <span className="text-[11px] text-white/70 font-medium truncate max-w-[160px]">{author}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] text-white/35 uppercase tracking-wide flex-shrink-0">Location</span>
                      <span className="text-[11px] text-white/55 text-right truncate max-w-[160px]">{path}</span>
                    </div>
                  </div>
                  {f.webUrl && (
                    <div className="px-4 pb-3">
                      <p className="text-[10px] text-[#6264A7] truncate">{f.webUrl.replace(/^https?:\/\//, "").slice(0, 45)}…</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Message attachment menu (fixed, three-dot on hover) ── */}
          {attMenuPos && (
            <>
              <div className="fixed inset-0 z-[199]" onClick={() => setAttMenuPos(null)}/>
              <div className="fixed w-52 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-[200] py-1 overflow-hidden"
                style={{
                  left: Math.min(attMenuPos.x, window.innerWidth - 220),
                  top:  Math.min(attMenuPos.y, window.innerHeight - 200),
                }}>
                <button onClick={() => { if (attMenuPos.url) window.open(attMenuPos.url, "_blank"); setAttMenuPos(null); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Globe className="w-4 h-4 flex-shrink-0 text-white/60"/> Open in Browser
                </button>
                <button onClick={() => {
                  if (attMenuPos.url) {
                    const a = document.createElement("a");
                    a.href = attMenuPos.url; a.download = attMenuPos.att.name || "file"; a.target = "_blank";
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  }
                  setAttMenuPos(null); showMsgToast("Download started.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Download className="w-4 h-4 flex-shrink-0 text-white/60"/> Download
                </button>
                <button onClick={() => {
                  copyToClipboard(attMenuPos.url || attMenuPos.att.name || "");
                  setAttMenuPos(null); showMsgToast("Link copied — ready to share.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Share2 className="w-4 h-4 flex-shrink-0 text-white/60"/> Share
                </button>
                <button onClick={() => {
                  copyToClipboard(attMenuPos.url || attMenuPos.att.name || "");
                  setAttMenuPos(null); showMsgToast("Link copied.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Link2 className="w-4 h-4 flex-shrink-0 text-white/60"/> Copy link
                </button>
              </div>
            </>
          )}

          {/* ── File context menu (fixed, works across all sections) ── */}
          {fileMenuPos && (
            <>
              <div className="fixed inset-0 z-[199]" onClick={() => setFileMenuPos(null)}/>
              <div className="fixed w-52 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-[200] py-1 overflow-hidden"
                style={{
                  left: Math.min(fileMenuPos.x, window.innerWidth - 220),
                  top:  Math.min(fileMenuPos.y, window.innerHeight - 185),
                }}>
                <button onClick={() => { window.open(fileMenuPos.file.webUrl, "_blank"); setFileMenuPos(null); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Globe className="w-4 h-4 flex-shrink-0 text-white/60"/> Open in Browser
                </button>
                <button onClick={() => {
                  const a = document.createElement("a");
                  a.href = fileMenuPos.file.webUrl; a.download = fileMenuPos.file.name || "file"; a.target = "_blank";
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  setFileMenuPos(null); showMsgToast("Download started.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Download className="w-4 h-4 flex-shrink-0 text-white/60"/> Download
                </button>
                <button onClick={() => {
                  copyToClipboard(fileMenuPos.file.webUrl || "");
                  setFileMenuPos(null); showMsgToast("Link copied — ready to share.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Share2 className="w-4 h-4 flex-shrink-0 text-white/60"/> Share
                </button>
                <button onClick={() => {
                  copyToClipboard(fileMenuPos.file.webUrl || "");
                  setFileMenuPos(null); showMsgToast("Link copied.");
                }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-xs transition-colors">
                  <Link2 className="w-4 h-4 flex-shrink-0 text-white/60"/> Copy link
                </button>
              </div>
            </>
          )}

          {/* Chat Main Area */}
          <div className="flex-1 flex flex-col bg-[#1e1e2e] overflow-hidden">
            {quickView ? (
              /* ═══ QUICK VIEW PANEL — two-panel split (matches Teams screenshots) ═══ */
              <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT PANEL: list ── */}
                <div className="w-[380px] flex-shrink-0 bg-[#1a1a2e] border-r border-white/8 flex flex-col overflow-hidden">

                  {/* Title + filter pills */}
                  <div className="px-5 pt-5 pb-3 border-b border-white/8">
                    <h2 className="text-base font-semibold text-white mb-3">
                      {quickView === "mentions" ? "Mentions" : quickView === "discover" ? "Discover" : quickView === "drafts" ? "Drafts" : "Saved"}
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                      {(quickView === "mentions"
                        ? [["all","Unread"],["channels","Channels"],["chats","Chats"]]
                        : [["channels","Channels"],["chats","Chats"]]
                      ).map(([k,label]) => (
                        <button key={k} onClick={() => { setQvFilter(k); setSelectedQuickItem(null); }}
                          className={`px-3 py-1 rounded-full text-xs border transition-all ${qvFilter===k ? "border-white/40 bg-white/10 text-white" : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* List area */}
                  <div className="flex-1 overflow-y-auto teams-scrollbar">

                    {/* ── MENTIONS list ── */}
                    {quickView === "mentions" && (
                      loadingMentions ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <div className="w-5 h-5 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/>
                          <p className="text-xs text-white/40">Searching your chats…</p>
                        </div>
                      ) : (() => {
                        const filtered = mentionedMsgs.filter(item =>
                          qvFilter === "channels" ? false
                          : qvFilter === "chats" ? true
                          : true
                        );
                        return filtered.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                              <AtSign className="w-8 h-8 text-white/20"/>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-white/60 mb-1">No mentions</p>
                              <p className="text-xs text-white/30">Messages where you're @mentioned will appear here.</p>
                            </div>
                            <button onClick={async () => {
                              if (!accessToken || !accounts.length) return;
                              setLoadingMentions(true);
                              const userId = accounts[0]?.localAccountId;
                              const userName = (accounts[0]?.name || "").toLowerCase();
                              const results = [];
                              await Promise.allSettled(chats.slice(0,20).map(async chat => {
                                try {
                                  const res = await window.fetch(`https://graph.microsoft.com/v1.0/chats/${chat.id}/messages?$top=30`, { headers: { Authorization: `Bearer ${accessToken}` } });
                                  if (!res.ok) return;
                                  const data = await res.json();
                                  for (const msg of (data.value||[])) {
                                    const m = (msg.mentions||[]).some(x => x.mentioned?.user?.id===userId || (x.mentioned?.user?.displayName||"").toLowerCase()===userName);
                                    const b = userName && (msg.body?.content||"").toLowerCase().includes(`@${userName}`);
                                    if (m||b) results.push({ msg, chatId: chat.id, chatName: getChatName(chat), chat: chats.find(c=>c.id===chat.id) });
                                  }
                                } catch {}
                              }));
                              setMentionedMsgs(results.sort((a,b)=>new Date(b.msg.createdDateTime)-new Date(a.msg.createdDateTime)));
                              setLoadingMentions(false);
                            }} className="px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium transition-colors">
                              Search now
                            </button>
                          </div>
                        ) : filtered.map((item, i) => {
                          const sender = item.msg.from?.user?.displayName || "Unknown";
                          const initials = sender.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                          const text = (item.msg.body?.content||"").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim().slice(0,120);
                          const ACOLORS = ["#e45c8a","#f4a261","#2ec4b6","#6264A7","#059669","#7c3aed"];
                          const color = ACOLORS[sender.charCodeAt(0) % ACOLORS.length];
                          const isSelected = selectedQuickItem?.id === item.msg.id;
                          return (
                            <button key={i} onClick={() => setSelectedQuickItem({...item, type:"mention"})}
                              className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isSelected?"bg-[#6264A7]/15 border-l-2 border-l-[#6264A7]":""}`}>
                              <div className="flex items-start gap-3">
                                <div className="relative flex-shrink-0">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{backgroundColor:color+"55",border:`1px solid ${color}40`}}>
                                    {initials}
                                  </div>
                                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#1a1a2e]"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <p className="text-sm font-semibold text-white truncate">{sender}</p>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <span className="text-[10px] text-white/35">{fmtDate(item.msg.createdDateTime)}</span>
                                      <button onClick={e=>{e.stopPropagation();}} className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"><MoreHorizontal className="w-5 h-5"/></button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Bell className="w-3 h-3 text-white/30 flex-shrink-0"/>
                                    <p className="text-[11px] text-white/45 truncate">{item.chatName}</p>
                                  </div>
                                  <p className="text-xs text-white/65 line-clamp-2 leading-relaxed">{text || "[Media message]"}</p>
                                </div>
                              </div>
                            </button>
                          );
                        });
                      })()
                    )}

                    {/* ── DISCOVER list ── */}
                    {quickView === "discover" && (
                      loadingDiscover ? (
                        <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/></div>
                      ) : discoverGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <Globe className="w-8 h-8 text-white/20"/>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-white/60 mb-1">No public groups found</p>
                            <p className="text-xs text-white/30">Public groups in your organisation appear here.</p>
                          </div>
                          <button onClick={async () => {
                            if (!teamsApiToken) return;
                            setLoadingDiscover(true);
                            try {
                              const res = await window.fetch("https://graph.microsoft.com/v1.0/groups?$filter=visibility eq 'Public'&$select=id,displayName,description,visibility,mail&$top=20", { headers: { Authorization: `Bearer ${teamsApiToken}` } });
                              if (res.ok) { const d = await res.json(); const j=new Set(joinedTeams.map(t=>t.id)); setDiscoverGroups((d.value||[]).filter(g=>!j.has(g.id))); }
                            } catch {} finally { setLoadingDiscover(false); }
                          }} className="px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium transition-colors">
                            Load groups
                          </button>
                        </div>
                      ) : discoverGroups.map((g,i) => {
                        const initials = g.displayName?.slice(0,2)?.toUpperCase()||"GR";
                        const ACOLORS = ["#6264A7","#e45c8a","#f4a261","#2ec4b6","#059669"];
                        const color = ACOLORS[i%ACOLORS.length];
                        const isSelected = selectedQuickItem?.id === g.id;
                        return (
                          <button key={g.id} onClick={() => setSelectedQuickItem({...g, type:"group"})}
                            className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isSelected?"bg-[#6264A7]/15 border-l-2 border-l-[#6264A7]":""}`}>
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{backgroundColor:color+"35",color}}>
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-sm font-semibold text-white truncate">{g.displayName}</p>
                                  <button onClick={e=>e.stopPropagation()} className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"><MoreHorizontal className="w-5 h-5"/></button>
                                </div>
                                {g.description && <p className="text-xs text-white/45 mt-0.5 line-clamp-2">{g.description}</p>}
                                {g.mail && <p className="text-[10px] text-white/25 mt-0.5">{g.mail}</p>}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}

                    {/* ── DRAFTS list ── */}
                    {quickView === "drafts" && (() => {
                      const drafts = [];
                      try {
                        for (let i=0;i<localStorage.length;i++){
                          const k=localStorage.key(i);
                          if(k?.startsWith("teams_draft_")){
                            const chatId=k.slice(12); const text=localStorage.getItem(k)||"";
                            if(text.trim()){ const chat=chats.find(c=>c.id===chatId); drafts.push({chatId,text,chatName:chat?getChatName(chat):"Unknown chat",chat}); }
                          }
                        }
                      } catch {}
                      return drafts.length===0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
                          <div className="text-7xl">✅</div>
                          <p className="text-sm font-bold text-white text-center">You have no draft messages.</p>
                        </div>
                      ) : drafts.map((d,i) => {
                        const isSelected = selectedQuickItem?.chatId === d.chatId;
                        return (
                          <button key={i} onClick={() => setSelectedQuickItem({...d, type:"draft"})}
                            className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isSelected?"bg-[#6264A7]/15 border-l-2 border-l-[#6264A7]":""}`}>
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                                <Pencil className="w-4 h-4 text-yellow-400/70"/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <p className="text-sm font-semibold text-white truncate">{d.chatName}</p>
                                  <button onClick={e=>e.stopPropagation()} className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"><MoreHorizontal className="w-5 h-5"/></button>
                                </div>
                                <p className="text-xs text-yellow-400/60 mb-0.5">Draft</p>
                                <p className="text-xs text-white/55 line-clamp-2">{d.text}</p>
                              </div>
                            </div>
                          </button>
                        );
                      });
                    })()}

                    {/* ── SAVED list ── */}
                    {quickView === "saved" && (
                      savedMsgData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <Bookmark className="w-8 h-8 text-white/20"/>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-white/60 mb-1">Nothing saved yet</p>
                            <p className="text-xs text-white/30">Bookmark messages using the ··· menu.</p>
                          </div>
                        </div>
                      ) : [...savedMsgData].reverse().map((d,i) => {
                        const sender = d.msg.from?.user?.displayName || "Unknown";
                        const initials = sender.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                        const ACOLORS = ["#e45c8a","#6264A7","#f4a261","#2ec4b6","#059669"];
                        const color = ACOLORS[sender.charCodeAt(0)%ACOLORS.length];
                        const isSelected = selectedQuickItem?.id === d.id;
                        return (
                          <button key={i} onClick={() => setSelectedQuickItem({...d, type:"saved"})}
                            className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isSelected?"bg-[#6264A7]/15 border-l-2 border-l-[#6264A7]":""}`}>
                            <div className="flex items-start gap-3">
                              <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{backgroundColor:color+"55"}}>
                                  {initials}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 border-2 border-[#1a1a2e] flex items-center justify-center">
                                  <Bookmark className="w-2 h-2 text-[#1a1a2e]"/>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <p className="text-sm font-semibold text-white truncate">{sender}</p>
                                  <button onClick={e=>e.stopPropagation()} className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"><MoreHorizontal className="w-5 h-5"/></button>
                                </div>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Bell className="w-3 h-3 text-white/30 flex-shrink-0"/>
                                  <p className="text-[11px] text-white/45 truncate">Chat with {sender}</p>
                                </div>
                                <p className="text-xs text-white/65 line-clamp-2">{d.msgText || "[Media message]"}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}

                  </div>
                </div>

                {/* ── RIGHT PANEL: detail or empty state ── */}
                <div className="flex-1 bg-[#1e1e2e] flex items-center justify-center flex-col gap-5 overflow-y-auto teams-scrollbar p-8">
                  {selectedQuickItem ? (
                    /* Detail view */
                    <div className="w-full max-w-2xl">
                      {selectedQuickItem.type === "mention" && (
                        <div className="bg-[#1a1a2e] rounded-2xl border border-white/8 overflow-hidden">
                          <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
                            <AtSign className="w-4 h-4 text-[#6264A7]"/>
                            <p className="text-xs text-white/50">Mentioned you in <span className="text-white/70 font-medium">{selectedQuickItem.chatName}</span></p>
                            <span className="ml-auto text-[10px] text-white/30">{fmtDate(selectedQuickItem.msg.createdDateTime)}</span>
                          </div>
                          <div className="px-6 py-5">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-9 h-9 rounded-full bg-[#6264A7]/40 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                {(selectedQuickItem.msg.from?.user?.displayName||"?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{selectedQuickItem.msg.from?.user?.displayName||"Unknown"}</p>
                                <p className="text-[10px] text-white/35">{new Date(selectedQuickItem.msg.createdDateTime).toLocaleString()}</p>
                              </div>
                            </div>
                            <p className="text-sm text-white/80 leading-relaxed">{(selectedQuickItem.msg.body?.content||"").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim() || "[Media message]"}</p>
                          </div>
                          <div className="px-6 py-3 border-t border-white/8 flex gap-2 justify-end">
                            <button onClick={() => { const c = selectedQuickItem.chat || chats.find(x=>x.id===selectedQuickItem.chatId); if(c){setSelectedChat(c);setQuickView(null);markChatRead(c.id);} }} className="px-4 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium transition-colors">Open chat</button>
                          </div>
                        </div>
                      )}
                      {selectedQuickItem.type === "group" && (
                        <div className="bg-[#1a1a2e] rounded-2xl border border-white/8 overflow-hidden">
                          <div className="px-6 py-5 border-b border-white/8">
                            <p className="text-base font-semibold text-white">{selectedQuickItem.displayName}</p>
                            {selectedQuickItem.description && <p className="text-sm text-white/50 mt-1">{selectedQuickItem.description}</p>}
                            {selectedQuickItem.mail && <p className="text-xs text-white/30 mt-2">{selectedQuickItem.mail}</p>}
                          </div>
                          <div className="px-6 py-3 flex gap-2 justify-end">
                            <span className="px-3 py-1 rounded-full text-[10px] border border-white/15 text-white/45">{selectedQuickItem.visibility}</span>
                          </div>
                        </div>
                      )}
                      {selectedQuickItem.type === "draft" && (
                        <div className="bg-[#1a1a2e] rounded-2xl border border-white/8 overflow-hidden">
                          <div className="px-6 py-4 border-b border-white/8 flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-yellow-400/70"/>
                            <p className="text-sm font-semibold text-white">{selectedQuickItem.chatName}</p>
                            <span className="ml-2 text-xs text-yellow-400/60">Draft</span>
                          </div>
                          <div className="px-6 py-5">
                            <p className="text-sm text-white/75 leading-relaxed">{selectedQuickItem.text}</p>
                          </div>
                          <div className="px-6 py-3 border-t border-white/8 flex gap-2 justify-end">
                            <button onClick={() => { try{localStorage.removeItem(`teams_draft_${selectedQuickItem.chatId}`);}catch{} setSelectedQuickItem(null); showMsgToast("Draft discarded."); }} className="px-4 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Discard</button>
                            <button onClick={() => { if(selectedQuickItem.chat){setSelectedChat(selectedQuickItem.chat);setQuickView(null);setMessage(selectedQuickItem.text);setTimeout(()=>composerInputRef.current?.focus(),100);} }} className="px-4 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium transition-colors">Continue editing</button>
                          </div>
                        </div>
                      )}
                      {selectedQuickItem.type === "saved" && (
                        <div className="bg-[#1a1a2e] rounded-2xl border border-white/8 overflow-hidden">
                          <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
                            <Bookmark className="w-4 h-4 text-[#6264A7]"/>
                            <p className="text-xs text-white/50">Saved from <span className="text-white/70 font-medium">{selectedQuickItem.chatName}</span></p>
                            <span className="ml-auto text-[10px] text-white/30">{fmtDate(selectedQuickItem.savedAt)}</span>
                          </div>
                          <div className="px-6 py-5">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-9 h-9 rounded-full bg-[#6264A7]/40 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                {(selectedQuickItem.msg.from?.user?.displayName||"?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{selectedQuickItem.msg.from?.user?.displayName||"Unknown"}</p>
                                <p className="text-[10px] text-white/35">{new Date(selectedQuickItem.msg.createdDateTime).toLocaleString()}</p>
                              </div>
                            </div>
                            <p className="text-sm text-white/80 leading-relaxed">{selectedQuickItem.msgText || "[Media message]"}</p>
                          </div>
                          <div className="px-6 py-3 border-t border-white/8 flex gap-2 justify-end">
                            <button onClick={() => { setSavedMessages(p=>{const s=new Set(p);s.delete(selectedQuickItem.id);return s;}); setSavedMsgData(p=>p.filter(x=>x.id!==selectedQuickItem.id)); setSelectedQuickItem(null); showMsgToast("Removed from saved."); }} className="px-4 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Unsave</button>
                            <button onClick={() => { const c=chats.find(x=>x.id===selectedQuickItem.chatId); if(c){setSelectedChat(c);setQuickView(null);markChatRead(c.id);} }} className="px-4 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg font-medium transition-colors">Go to chat</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Empty state — matches Teams screenshot style */
                    <div className="flex flex-col items-center gap-5 select-none">
                      {quickView === "mentions" && (
                        <>
                          <div className="relative w-28 h-28">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#181825] flex items-center justify-center shadow-2xl">
                              <div className="flex items-center -space-x-2">
                                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center shadow-lg z-10"><Users className="w-5 h-5 text-white"/></div>
                                <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center shadow-lg z-20"><Users className="w-3.5 h-3.5 text-white"/></div>
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center shadow-xl border-2 border-[#1e1e2e]">
                              <AtSign className="w-5 h-5 text-white"/>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-white">When you select an @mention, it'll show up here</p>
                        </>
                      )}
                      {quickView === "discover" && (
                        <>
                          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#6264A7]/30 to-[#2a2a3a] flex items-center justify-center shadow-2xl">
                            <Globe className="w-12 h-12 text-[#6264A7]/70"/>
                          </div>
                          <p className="text-sm font-semibold text-white">Select a group to view details</p>
                        </>
                      )}
                      {quickView === "drafts" && (
                        <>
                          <div className="relative w-28 h-28">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#181825] flex items-center justify-center shadow-2xl">
                              <div className="relative">
                                <MessageSquare className="w-12 h-12 text-white/15"/>
                                <div className="absolute -top-1 -right-2 flex gap-0.5">
                                  <div className="w-2 h-2 rounded-full bg-purple-400"/>
                                  <div className="w-2 h-2 rounded-full bg-green-400"/>
                                  <div className="w-2 h-2 rounded-full bg-yellow-400"/>
                                </div>
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-xl border-2 border-[#1e1e2e]">
                              <Pencil className="w-4 h-4 text-white"/>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-white">Select a draft to edit and send.</p>
                        </>
                      )}
                      {quickView === "saved" && (
                        <>
                          <div className="relative w-28 h-28">
                            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-[#2a2a3a] to-[#181825] flex items-center justify-center shadow-2xl">
                              <Mail className="w-12 h-12 text-white/15"/>
                            </div>
                            <div className="absolute -top-2 -right-2 flex gap-1">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 shadow-lg"/>
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg"/>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-white">When you select a saved item, it'll show up here.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ) : selectedChat ? (
              <>
                <div className="flex flex-col bg-[#1a1a2e] border-b border-white/10 flex-shrink-0">
                  {/* Header Row */}
                  <div className="h-14 flex items-center justify-between px-5 border-b border-white/8">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-full bg-[#6264A7] flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {getChatName(selectedChat)?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold leading-tight">{getChatName(selectedChat)}</h2>
                        <p className="text-[11px] text-white/40">{selectedChat?.chatType === "oneOnOne" ? "Teams Chat" : "Group Chat"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button title="Audio call" onClick={()=>startCall("audio", getChatName(selectedChat))}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <PhoneCall className="w-4 h-4"/>
                      </button>
                      <button title="Video call" onClick={()=>startCall("video", getChatName(selectedChat))}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <Video className="w-4 h-4"/>
                      </button>
                      <button title="Add participants" onClick={()=>{ setAddPartSearch(""); setAddPartPicked([]); setAddPartError(""); setAddPartSuccess(""); setShowAddParticipants(true); }}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <Users className="w-4 h-4"/>
                      </button>
                      <div className="w-px h-5 bg-white/10 mx-1"/>
                      <button title={isScreenSharing ? "Stop sharing" : "Share screen"}
                        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                        className={`p-2 rounded-lg transition-all ${isScreenSharing ? "bg-red-500/20 text-red-300 hover:bg-red-500/30 animate-pulse" : "hover:bg-white/20 text-white/70 hover:text-white"}`}>
                        <Share2 className="w-5 h-5"/>
                      </button>
                      <button title="Search messages"
                        onClick={()=>{ setShowMsgSearch(p=>{ if(!p){setMsgSearchQuery("");setMsgSearchResults([]);setMsgSearchIdx(0);} return !p; }); setTimeout(()=>msgSearchInputRef.current?.focus(),80); }}
                        className={`p-2 rounded-lg transition-all ${showMsgSearch?"bg-[#6264A7]/25 text-[#c7c9f3]":"hover:bg-white/20 text-white/70 hover:text-white"}`}>
                        <Search className="w-5 h-5"/>
                      </button>
                      {/* ── Three-dot "More actions" dropdown ── */}
                      <div className="relative">
                        <button title="More actions"
                          onClick={()=>{ setShowChatMoreMenu(p=>!p); setShowMoveToSubmenu(false); }}
                          className={`p-2 rounded-lg transition-all ${showChatMoreMenu?"bg-[#6264A7]/25 text-[#c7c9f3]":"hover:bg-white/20 text-white/70 hover:text-white"}`}>
                          <MoreVertical className="w-5 h-5"/>
                        </button>

                        {showChatMoreMenu && selectedChat && (()=>{
                          const isMuted  = mutedChats.has(selectedChat.id);
                          const isUnread = unreadChats.has(selectedChat.id);
                          const chatLink = `${window.location.origin}${window.location.pathname}#chat-${selectedChat.id}`;
                          return (
                            <>
                              <div className="fixed inset-0 z-[159]" onClick={()=>{ setShowChatMoreMenu(false); setShowMoveToSubmenu(false); }}/>
                              <div className="absolute right-0 top-full mt-1 w-60 bg-[#1e1f2e] border border-white/12 rounded-xl shadow-2xl z-[160] py-1 overflow-visible">

                                {/* Open in new window */}
                                <button onClick={()=>{ setShowChatMoreMenu(false); window.open(window.location.href,"_blank"); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-white/50"/> Open in new window
                                </button>

                                {/* Schedule meeting */}
                                <button onClick={()=>{
                                  setShowChatMoreMenu(false);
                                  setNewEventForm(p=>({ ...p, date:new Date().toISOString().split("T")[0], title:"Meeting with "+getChatName(selectedChat), attendees:getChatName(selectedChat) }));
                                  setSection("calendar");
                                  setTimeout(()=>setShowNewEventModal(true), 80);
                                }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                  <Calendar className="w-4 h-4 flex-shrink-0 text-white/50"/> Schedule meeting
                                </button>

                                {/* Screen sharing */}
                                <button onClick={()=>{ setShowChatMoreMenu(false); isScreenSharing ? stopScreenShare() : startScreenShare(); }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/10 hover:text-white transition-colors ${isScreenSharing?"text-red-300":"text-white/80"}`}>
                                  <Share2 className="w-4 h-4 flex-shrink-0 text-white/50"/> {isScreenSharing ? "Stop screen sharing" : "Screen sharing"}
                                </button>

                                <div className="h-px bg-white/10 my-1"/>

                                {/* Mark as unread */}
                                <button onClick={()=>{
                                  setShowChatMoreMenu(false);
                                  setUnreadChats(prev=>{ const s=new Set(prev); s.has(selectedChat.id)?s.delete(selectedChat.id):s.add(selectedChat.id); return s; });
                                }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                  <Bell className="w-4 h-4 flex-shrink-0 text-white/50"/> {isUnread ? "Mark as read" : "Mark as unread"}
                                </button>

                                {/* Move to (with submenu) */}
                                <div className="relative"
                                  onMouseEnter={()=>setShowMoveToSubmenu(true)}
                                  onMouseLeave={()=>setShowMoveToSubmenu(false)}>
                                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                    <FolderOpen className="w-4 h-4 flex-shrink-0 text-white/50"/> Move to
                                    <ChevronRight className="w-3.5 h-3.5 text-white/40 ml-auto flex-shrink-0"/>
                                  </button>
                                  {showMoveToSubmenu && (
                                    <div className="absolute left-full top-0 ml-1 w-44 bg-[#1e1f2e] border border-white/12 rounded-xl shadow-2xl z-[161] py-1">
                                      {["Favorites","General","Archived","Work","Personal"].map(cat=>(
                                        <button key={cat} onClick={()=>{ setShowChatMoreMenu(false); setShowMoveToSubmenu(false); }}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                          <Hash className="w-3.5 h-3.5 text-white/40 flex-shrink-0"/> {cat}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Mute */}
                                <button onClick={()=>{
                                  setShowChatMoreMenu(false);
                                  setMutedChats(prev=>{ const s=new Set(prev); s.has(selectedChat.id)?s.delete(selectedChat.id):s.add(selectedChat.id); return s; });
                                }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                  <VolumeX className="w-4 h-4 flex-shrink-0 text-white/50"/> {isMuted ? "Unmute" : "Mute"}
                                </button>

                                {/* Copy link */}
                                <button onClick={()=>{
                                  setShowChatMoreMenu(false);
                                  navigator.clipboard.writeText(chatLink).catch(()=>{});
                                  setCopyLinkToast(true);
                                  setTimeout(()=>setCopyLinkToast(false), 2500);
                                }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                  <Link2 className="w-4 h-4 flex-shrink-0 text-white/50"/> Copy link
                                </button>

                                <div className="h-px bg-white/10 my-1"/>

                                {/* Remove chat history */}
                                <button onClick={()=>{
                                  setShowChatMoreMenu(false);
                                  if(window.confirm("Clear all messages in this chat? This cannot be undone.")) setMessages([]);
                                }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                                  <Trash2 className="w-4 h-4 flex-shrink-0"/> Remove chat history
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* ── Inline message search bar ── */}
                  {showMsgSearch && (
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#14142a]">
                      <Search className="w-4 h-4 text-white/30 flex-shrink-0"/>
                      <input
                        ref={msgSearchInputRef}
                        value={msgSearchQuery}
                        onChange={e=>{ setMsgSearchQuery(e.target.value); runMsgSearch(e.target.value, messages); }}
                        onKeyDown={e=>{
                          if(e.key==="Escape"){ setShowMsgSearch(false); setMsgSearchQuery(""); setMsgSearchResults([]); }
                          if(e.key==="Enter"&&msgSearchResults.length){
                            const next=(msgSearchIdx+1)%msgSearchResults.length;
                            setMsgSearchIdx(next);
                            const hit=msgSearchResults[next];
                            if(hit){
                              const el=document.getElementById(`msg-${hit.msg.id}`);
                              el?.scrollIntoView({behavior:"smooth",block:"center"});
                            }
                          }
                        }}
                        placeholder="Search in this conversation…"
                        className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
                      />
                      {msgSearchQuery && (
                        <span className="text-xs text-white/30 flex-shrink-0 tabular-nums">
                          {msgSearchResults.length===0 ? "No results" : `${msgSearchIdx+1} / ${msgSearchResults.length}`}
                        </span>
                      )}
                      {msgSearchResults.length>1 && (
                        <>
                          <button onClick={()=>{
                            const prev=(msgSearchIdx-1+msgSearchResults.length)%msgSearchResults.length;
                            setMsgSearchIdx(prev);
                            const el=document.getElementById(`msg-${msgSearchResults[prev].msg.id}`);
                            el?.scrollIntoView({behavior:"smooth",block:"center"});
                          }} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4"/>
                          </button>
                          <button onClick={()=>{
                            const next=(msgSearchIdx+1)%msgSearchResults.length;
                            setMsgSearchIdx(next);
                            const el=document.getElementById(`msg-${msgSearchResults[next].msg.id}`);
                            el?.scrollIntoView({behavior:"smooth",block:"center"});
                          }} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4"/>
                          </button>
                        </>
                      )}
                      <button onClick={()=>{ setShowMsgSearch(false); setMsgSearchQuery(""); setMsgSearchResults([]); }}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  )}

                  {/* Tabs — Chat, Shared, Files, Storyline, Notes, Tasks */}
                  <div className="flex items-center h-11 px-5 gap-5">
                    {["Chat","Shared","Files","Storyline","Notes","Tasks"].map(tab=>(
                      <button key={tab} onClick={()=>setActiveTab(tab.toLowerCase())}
                        className={`text-xs font-medium transition-all pb-2.5 pt-1 relative ${activeTab===tab.toLowerCase()?"text-white":"text-white/40 hover:text-white/70"}`}>
                        {tab}
                        {activeTab===tab.toLowerCase()&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6264A7] rounded-full"/>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto teams-scrollbar bg-[#1c1c2c]">
                  {activeTab === "chat" ? (
                    <div className="p-6 space-y-3">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-5 h-5 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : messagesError ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
                          <AlertCircle className="w-10 h-10 text-red-400/50" />
                          <p className="text-red-300 text-sm text-center max-w-xs">{messagesError}</p>
                          <button onClick={fetchMessages} className="px-4 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] text-white text-xs rounded-lg transition-colors">Retry</button>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                          <MessageSquare className="w-12 h-12 text-white/10 mb-3" />
                          <p className="text-white/30">No messages yet</p>
                        </div>
                      ) : (
                        messages.map((msg, idx) => {
                          const isOwn = msg.from?.user?.id === accounts[0]?.localAccountId;
                          const isConsecutive = idx > 0 && messages[idx - 1]?.from?.user?.id === msg.from?.user?.id;

                          const msgDate = msg.createdDateTime ? new Date(msg.createdDateTime) : null;
                          const prevDate = idx > 0 && messages[idx-1]?.createdDateTime ? new Date(messages[idx-1].createdDateTime) : null;
                          const todayStr = new Date().toDateString();
                          const showDateSep = msgDate && (!prevDate || msgDate.toDateString() !== prevDate.toDateString());
                          const dateLabel = msgDate?.toDateString() === todayStr ? "Today" : msgDate?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
                          const isFirstUnread = !readMessages.has(msg.id) && (idx === 0 || readMessages.has(messages[idx-1]?.id));

                          // Extract reply-quote block before stripping HTML
                          let quoteInfo = null;
                          let _rawHtml = msg.body?.content || "";
                          if (msg.body?.contentType === "html" && _rawHtml.includes('data-reply="1"')) {
                            try {
                              const _doc = new DOMParser().parseFromString(_rawHtml, "text/html");
                              const _el = _doc.querySelector('[data-reply="1"]');
                              if (_el) {
                                quoteInfo = {
                                  sender: _el.querySelector("strong")?.textContent?.trim() || "",
                                  text:   _el.querySelector("span")?.textContent?.trim() || "",
                                };
                                _el.remove();
                                _rawHtml = _doc.body.innerHTML;
                              }
                            } catch {}
                          }
                          const msgText = _rawHtml
                            .replace(/<br\s*\/?>/gi, "\n")
                            .replace(/<\/p>/gi, "\n")
                            .replace(/<\/div>/gi, "\n")
                            .replace(/<[^>]+>/g, "")
                            .replace(/&nbsp;/g, " ")
                            .replace(/&amp;/g, "&")
                            .replace(/&lt;/g, "<")
                            .replace(/&gt;/g, ">")
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/\n{3,}/g, "\n\n")
                            .trim();
                          const isSearchHit = showMsgSearch && msgSearchQuery && msgSearchResults.some(r=>r.msg.id===msg.id);
                          const isActiveHit = isSearchHit && msgSearchResults[msgSearchIdx]?.msg.id===msg.id;
                          return (
                            <React.Fragment key={msg.id}>
                              {isFirstUnread && (
                                <div className="flex items-center gap-3 py-3 px-2">
                                  <div className="flex-1 h-px bg-[#6264A7]/60" />
                                  <span className="text-[11px] font-semibold text-[#8385c7] px-3 tracking-wide">Last read</span>
                                  <div className="flex-1 h-px bg-[#6264A7]/60" />
                                </div>
                              )}
                              {showDateSep && (
                                <div className="flex items-center gap-3 py-3 px-2">
                                  <div className="flex-1 h-px bg-white/10" />
                                  <span className="text-[11px] font-medium text-white/40 px-3 bg-[#1c1c2c] border border-white/10 rounded-full py-1">{dateLabel}</span>
                                  <div className="flex-1 h-px bg-white/10" />
                                </div>
                              )}
                            <div
                              id={`msg-${msg.id}`}
                              className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 group rounded-xl transition-all ${isActiveHit ? "bg-yellow-400/10 ring-1 ring-yellow-400/40 -mx-2 px-2" : isSearchHit ? "bg-white/5 -mx-2 px-2" : ""}`}
                              onMouseEnter={() => setHoveredMsgId(msg.id)}
                              onMouseLeave={() => setHoveredMsgId(null)}>
                              <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} max-w-[70%]`}>
                                {!isOwn && !isConsecutive && (
                                  <div className="w-8 h-8 rounded-full bg-[#6264A7]/50 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-5">
                                    {msg.from?.user?.displayName?.charAt(0)?.toUpperCase()}
                                  </div>
                                )}
                                {!isOwn && isConsecutive && <div className="w-8 flex-shrink-0" />}

                                <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} relative`}>
                                  {!isOwn && !isConsecutive && (
                                    <span className="text-xs text-white/50 mb-1 ml-2">{msg.from?.user?.displayName || "Unknown"}</span>
                                  )}

                                  {/* ── Hover Toolbar ── */}
                                  {hoveredMsgId === msg.id && (
                                    <div className={`absolute ${isOwn ? "right-0" : "left-0"} -top-9 z-20
                                      flex items-center bg-[#1a1b2e] border border-white/10 rounded-lg shadow-xl px-1.5 py-1 gap-0.5 select-none`}>
                                      {["👍","❤️","😆","😮","😢"].map(emoji => (
                                        <button key={emoji}
                                          onClick={() => { sendReaction(msg, emoji); setHoveredMsgId(null); }}
                                          className={`text-sm px-1 py-0.5 rounded hover:bg-white/15 transition-colors hover:scale-125 ${(msgReactions[msg.id]?.[emoji]||0)>0?"bg-[#6264A7]/20":""}`}>
                                          {emoji}
                                        </button>
                                      ))}
                                      <button title="More reactions"
                                        onClick={e=>{ e.stopPropagation(); setMsgEmojiPickerFor(p => p===msg.id ? null : msg.id); }}
                                        className={`p-1 rounded hover:bg-white/15 transition-colors ${msgEmojiPickerFor===msg.id?"text-[#6264A7] bg-[#6264A7]/15":"text-white/50"}`}>
                                        <Smile className="w-3.5 h-3.5" />
                                      </button>
                                      <div className="w-px h-4 bg-white/15 mx-0.5" />
                                      {isOwn && (
                                        <button className="p-1 rounded hover:bg-white/15 text-white/50 transition-colors" title="Edit">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (ctxMenu?.msg?.id === msg.id) { setCtxMenu(null); return; }
                                          const plainText = (msg.body?.content || "")
                                            .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
                                            .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
                                            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
                                          setCtxMenu({ x: e.clientX, y: e.clientY, msg, isOwn, msgText: plainText });
                                          setHoveredMsgId(null);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-white/15 text-white/65 hover:text-white transition-colors" title="More options">
                                        <MoreHorizontal className="w-5 h-5" />
                                      </button>
                                    </div>
                                  )}

                                  {/* ── Full emoji reaction picker ── */}
                                  {msgEmojiPickerFor === msg.id && (
                                    <>
                                      <div className="fixed inset-0 z-[39]" onClick={()=>setMsgEmojiPickerFor(null)}/>
                                      <div className={`absolute ${isOwn?"right-0":"left-0"} -top-[calc(theme(spacing.9)+theme(spacing.44))] z-40
                                        w-72 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl p-3`}
                                        style={{top: "auto", bottom:"calc(100% + 4px)"}}>
                                        <p className="text-[10px] text-white/30 mb-2 font-medium tracking-wide uppercase">React with emoji</p>
                                        <div className="grid grid-cols-9 gap-0.5 max-h-36 overflow-y-auto teams-scrollbar">
                                          {EMOJI_LIST.map(em=>(
                                            <button key={em}
                                              onClick={()=>{
                                                sendReaction(msg, em);
                                                setMsgEmojiPickerFor(null);
                                                setHoveredMsgId(null);
                                              }}
                                              className={`text-base p-1 rounded hover:bg-white/15 transition-all hover:scale-125 ${(msgReactions[msg.id]?.[em]||0)>0?"bg-[#6264A7]/20":""}`}>
                                              {em}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* ── Message Bubble ── */}
                                  {(() => {
                                    const imgSrcs = (() => {
                                      if (msg.body?.contentType !== "html" || !/<img\s/i.test(msg.body?.content || "")) return [];
                                      try {
                                        const doc = new DOMParser().parseFromString(msg.body.content, "text/html");
                                        return Array.from(doc.querySelectorAll("img"))
                                          .map(el => el.getAttribute("src") || "")
                                          .filter(s => s.startsWith("https://"));
                                      } catch { return []; }
                                    })();
                                    const fileAtts = (msg.attachments || []).filter(a =>
                                      a.contentType && a.contentType !== "messageReference" && !a.contentType.startsWith("application/vnd.microsoft.card")
                                    );
                                    return (
                                      <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm max-w-full
                                        ${isOwn ? "bg-[#6264A7] text-white rounded-tr-sm" : "bg-[#2a2a3a] text-white/90 rounded-tl-sm border border-white/8"}`}>
                                        {quoteInfo && (
                                          <div className={`mb-2 border-l-2 border-[#6264A7]/80 pl-2 pr-1 py-1 rounded-r ${isOwn ? "bg-white/10" : "bg-white/5"}`}>
                                            <p className="text-[10px] font-semibold text-[#8385c7] mb-0.5 truncate">{quoteInfo.sender}</p>
                                            <p className="text-[11px] opacity-60 truncate leading-tight">{quoteInfo.text || "[Media]"}</p>
                                          </div>
                                        )}
                                        {msgText && (
                                          <span className="whitespace-pre-wrap break-words select-text">
                                            {isSearchHit && msgSearchQuery
                                              ? (() => {
                                                  const lower = msgSearchQuery.toLowerCase();
                                                  const parts = [];
                                                  let remaining = msgText, key = 0;
                                                  while (remaining.length) {
                                                    const pos = remaining.toLowerCase().indexOf(lower);
                                                    if (pos === -1) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
                                                    if (pos > 0) parts.push(<React.Fragment key={key++}>{remaining.slice(0, pos)}</React.Fragment>);
                                                    parts.push(<mark key={key++} className={`rounded px-0.5 ${isActiveHit?"bg-yellow-400 text-black":"bg-yellow-400/40 text-white"}`}>{remaining.slice(pos, pos+lower.length)}</mark>);
                                                    remaining = remaining.slice(pos + lower.length);
                                                  }
                                                  return parts;
                                                })()
                                              : msgText}
                                          </span>
                                        )}
                                        {imgSrcs.map((src, i) => (
                                          <AuthImage key={i} src={src} accessToken={accessToken}
                                            isOwn={isOwn} onDeleteMessage={handleDeleteMessage} messageId={msg.id}
                                            onPreview={setMediaPreview} />
                                        ))}
                                        {fileAtts.map((att, i) => {
                                          const url = att.contentUrl || att.content?.contentUrl || "";
                                          const ext = (att.name || "").split(".").pop()?.toUpperCase() || "FILE";
                                          const extColors = {
                                            PDF:  "text-red-400 bg-red-500/15",
                                            ZIP:  "text-yellow-400 bg-yellow-500/15",
                                            DOC:  "text-blue-400 bg-blue-500/15", DOCX: "text-blue-400 bg-blue-500/15",
                                            XLS:  "text-emerald-400 bg-emerald-500/15", XLSX: "text-emerald-400 bg-emerald-500/15",
                                            PNG:  "text-purple-400 bg-purple-500/15", JPG:  "text-purple-400 bg-purple-500/15",
                                            JPEG: "text-purple-400 bg-purple-500/15",
                                          };
                                          const cls = extColors[ext] || "text-white/60 bg-white/10";
                                          return (
                                            <div key={i}
                                              className={`group/att flex items-center gap-2.5 mt-2 px-3 py-2 rounded-xl border transition-colors
                                                ${isOwn ? "bg-white/15 hover:bg-white/22 border-white/20" : "bg-white/5 hover:bg-white/9 border-white/10"}`}>
                                              {/* File icon */}
                                              <div className={`w-9 h-9 rounded-xl ${cls} flex items-center justify-center flex-shrink-0`}>
                                                <span className="text-[10px] font-bold">{ext.slice(0,3)}</span>
                                              </div>
                                              {/* Name — clicking opens preview */}
                                              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => url && setMediaPreview({ type: "file", url, name: att.name || "Attachment", ext })}>
                                                <p className="text-xs font-semibold truncate text-white/90">{att.name || "Attachment"}</p>
                                                <p className="text-[10px] text-white/40 mt-0.5">{ext} file</p>
                                              </div>
                                              {/* Hover actions: Open label + three-dot */}
                                              <div className="flex items-center gap-1.5 opacity-0 group-hover/att:opacity-100 transition-opacity flex-shrink-0">
                                                {url && (
                                                  <button title="Open" onClick={e => { e.stopPropagation(); setMediaPreview({ type: "file", url, name: att.name || "Attachment", ext }); }}
                                                    className="px-2.5 py-1 rounded-lg bg-[#6264A7]/30 hover:bg-[#6264A7]/55 text-white/80 hover:text-white text-xs font-medium transition-colors">
                                                    Open
                                                  </button>
                                                )}
                                                <button title="More options"
                                                  onClick={e => { e.stopPropagation(); setAttMenuPos({ x: e.clientX, y: e.clientY, att, url }); }}
                                                  className="p-2 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                                                  <MoreHorizontal className="w-5 h-5"/>
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {!msgText && imgSrcs.length === 0 && fileAtts.length === 0 && (
                                          <span className="italic text-sm opacity-40">Media message</span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Reaction pills */}
                                  {Object.entries(msgReactions[msg.id]||{}).filter(([,c])=>c>0).length>0&&(
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {Object.entries(msgReactions[msg.id]).filter(([,c])=>c>0).map(([emoji,count])=>(
                                        <button key={emoji}
                                          onClick={()=>setMsgReactions(p=>{const r=p[msg.id]||{};return{...p,[msg.id]:{...r,[emoji]:(r[emoji]||1)-1}};})}
                                          className="inline-flex items-center gap-1 bg-[#2a2a3a] border border-white/15 rounded-full px-2 py-0.5 text-xs hover:bg-[#3a3a4a] transition-colors">
                                          {emoji}<span className="text-white/55">{count}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-0.5 px-0.5">
                                    <span className="text-[10px] text-white/30">{fmtTime(msg.createdDateTime)}</span>
                                    {savedMessages.has(msg.id) && <Bookmark className="w-2.5 h-2.5 text-[#6264A7]" />}
                                    {msg.from?.user?.id===accounts[0]?.localAccountId&&<span className="text-[10px] text-white/25 flex items-center gap-0.5"><Check className="w-2.5 h-2.5"/>Delivered</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            </React.Fragment>
                          );
                        })
                      )}
                    </div>
                  ) : activeTab === "shared" ? (
                    <div className="p-6">
                      <div className="text-center py-16">
                        <Copy className="w-12 h-12 text-white/10 mb-3 mx-auto" />
                        <p className="text-white/30">No shared files yet</p>
                        <p className="text-white/20 text-xs mt-2">Share files and links in the chat to see them here</p>
                      </div>
                    </div>
                  ) : activeTab === "files" ? (
                    <div className="p-5">
                      <p className="text-xs text-white/40 mb-3 font-medium">Files shared in this conversation</p>
                      {oneDriveFiles.length > 0 ? (
                        <div className="space-y-2">
                          {oneDriveFiles.slice(0,5).map(f => {
                            const s = fileStyle(f);
                            return (
                              <div key={f.id} onClick={()=>f.webUrl&&setMediaPreview({ type: "file", url: f.webUrl, name: f.name, ext: (f.name||"").split(".").pop().toUpperCase() || "FILE" })}
                                className="flex items-center gap-3 p-3 bg-[#2a2a3a] rounded-xl border border-white/8 hover:border-[#6264A7]/30 cursor-pointer transition-all group">
                                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                                  <span className={`text-[10px] font-bold ${s.text}`}>{s.label}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{f.name}</p>
                                  <p className="text-[11px] text-white/40">{fmtFileSize(f.size)} · {fmtDate(f.lastModifiedDateTime)}</p>
                                </div>
                                <button onClick={e=>{e.stopPropagation();f.webUrl&&setMediaPreview({ type: "file", url: f.webUrl, name: f.name, ext: (f.name||"").split(".").pop().toUpperCase() || "FILE" });}}
                                  className="px-2.5 py-1 bg-[#6264A7]/30 hover:bg-[#6264A7]/55 rounded-lg text-white/80 hover:text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">Open</button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-8 gap-2">
                          <FolderOpen className="w-8 h-8 text-white/15"/>
                          <p className="text-xs text-white/30">No shared files</p>
                        </div>
                      )}
                    </div>
                  ) : activeTab === "storyline" ? (
                    <div className="p-5 space-y-3">
                      {storylineItems.map((item) => (
                        <div key={item.id} className="p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 cursor-pointer transition-all">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#6264A7] flex items-center justify-center text-xs font-semibold flex-shrink-0">{item.avatar}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className="text-sm font-semibold">{item.name}</p>
                                <span className="text-[10px] text-white/30">{item.time}</span>
                              </div>
                              <p className="text-[11px] text-white/40 mb-1">{item.status}</p>
                              <p className="text-sm text-white/70">{item.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                      <FileText className="w-10 h-10 text-white/12"/>
                      <p className="text-white/30 text-sm">Nothing here yet</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-4 pt-2 pb-4 bg-[#1e1e2e] border-t border-white/8 flex-shrink-0">
                  {/* Quick replies */}
                  <div className="flex items-center gap-2 mb-2">
                    {["Thanks","Oh, ok","Got it"].map((reply)=>(
                      <button key={reply} onClick={()=>setMessage(reply)}
                        className="px-3 py-1 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/12 rounded-full text-xs text-white/65 hover:text-white transition-colors">{reply}</button>
                    ))}
                    <button className="p-1 hover:bg-white/10 rounded-full text-white/25 transition-colors"><Lightbulb className="w-3.5 h-3.5"/></button>
                  </div>

                  {/* Hidden file inputs */}
                  <input ref={fileInputRef} type="file" multiple
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.zip,.txt,.ppt,.pptx"
                    className="hidden"
                    onChange={e => {
                      Array.from(e.target.files||[]).forEach(f => setPendingFiles(p=>[...p,f]));
                      e.target.value = "";
                    }}
                  />
                  <input ref={imageInputRef} type="file" multiple accept="image/*"
                    className="hidden"
                    onChange={e => {
                      Array.from(e.target.files||[]).forEach(f => {
                        const reader = new FileReader();
                        reader.onload = ev => setPendingImages(p=>[...p,{name:f.name,dataUrl:ev.target.result,file:f}]);
                        reader.readAsDataURL(f);
                      });
                      e.target.value = "";
                    }}
                  />

                  {/* Composer */}
                  <div className="bg-[#2a2a3a] border border-white/12 rounded-xl overflow-hidden focus-within:border-[#6264A7]/50 transition-colors relative">

                    {/* Pending image previews */}
                    {pendingImages.length > 0 && (
                      <div className="px-3 pt-3 pb-1 flex flex-wrap gap-2">
                        {pendingImages.map((img,i) => (
                          <div key={i} className="relative group">
                            <img src={img.dataUrl} alt={img.name}
                              className="w-16 h-16 object-cover rounded-lg border border-white/15"/>
                            <button onClick={()=>setPendingImages(p=>p.filter((_,j)=>j!==i))}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-2.5 h-2.5"/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pending file list */}
                    {pendingFiles.length > 0 && (
                      <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5">
                        {pendingFiles.map((f,i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-[#3a3a4a] border border-white/10 rounded-lg px-2 py-1 text-xs">
                            <Paperclip className="w-3 h-3 text-white/50"/>
                            <span className="text-white/75 max-w-[100px] truncate">{f.name}</span>
                            <button onClick={()=>setPendingFiles(p=>p.filter((_,j)=>j!==i))} className="text-white/40 hover:text-rose-400 ml-0.5 transition-colors">
                              <X className="w-3 h-3"/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply-quote preview bar */}
                    {replyTo && (
                      <div className="px-3 pt-2">
                        <div className="flex items-start gap-2 bg-[#6264A7]/10 border-l-2 border-[#6264A7] rounded-r-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[#8385c7] mb-0.5">Replying to {replyTo.sender}</p>
                            <p className="text-[11px] text-white/50 truncate">{replyTo.text || "[Media]"}</p>
                          </div>
                          <button onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 mt-0.5">
                            <X className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Text input */}
                    <div className="px-4 pt-3 pb-1 relative">
                      {/* Mention picker dropdown */}
                      {mentionQuery !== null && (() => {
                        // Priority: actual chat members → teamsPeople contacts
                        const seen = new Set();
                        const suggestions = [];
                        for (const m of chatMembers) {
                          const key = m.userId || m.email || m.name;
                          if (!seen.has(key)) { seen.add(key); suggestions.push({ ...m, source: "member" }); }
                        }
                        for (const p of teamsPeople) {
                          const key = p.email || p.name;
                          if (!seen.has(key)) { seen.add(key); suggestions.push({ ...p, source: "contact" }); }
                        }
                        const q = mentionQuery.toLowerCase();
                        const filtered = suggestions.filter(p =>
                          !q || p.name.toLowerCase().includes(q) || (p.email||"").toLowerCase().includes(q)
                        ).slice(0, 8);

                        return (
                          <div className="absolute bottom-full mb-1 left-0 right-0 bg-[#1e1f2e] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden">
                            {filtered.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-white/40 text-center">No participants found</div>
                            ) : filtered.map((p, i) => (
                              <button key={p.userId || p.email || p.name} type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  const newMsg = message.replace(/@[^\s]*$/, `@${p.name} `);
                                  setMessage(newMsg);
                                  setMentionQuery(null);
                                  setMentionIndex(0);
                                  composerInputRef.current?.focus();
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === mentionIndex ? "bg-[#6264A7]/30" : "hover:bg-white/8"}`}>
                                <div className="w-7 h-7 rounded-full bg-[#6264A7] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white truncate">{p.name}</p>
                                  {p.email && <p className="text-[10px] text-white/40 truncate">{p.email}</p>}
                                </div>
                                <span className={`text-[9px] flex-shrink-0 px-1.5 py-0.5 rounded ${p.source === "member" ? "bg-[#6264A7]/20 text-[#8385c7]" : "text-white/20"}`}>
                                  {p.source === "member" ? "member" : "contact"}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      <input ref={composerInputRef} type="text" placeholder={replyTo ? `Reply to ${replyTo.sender}…` : "Type a message"}
                        value={message}
                        onChange={e => {
                          const val = e.target.value;
                          setMessage(val);
                          const match = val.match(/@([^\s]*)$/);
                          if (match) { setMentionQuery(match[1]); setMentionIndex(0); }
                          else setMentionQuery(null);
                        }}
                        onKeyDown={e => {
                          if (mentionQuery !== null) {
                            const seen2 = new Set();
                            const sugg2 = [];
                            for (const m of chatMembers) { const k = m.userId||m.email||m.name; if (!seen2.has(k)) { seen2.add(k); sugg2.push(m); } }
                            for (const p of teamsPeople) { const k = p.email||p.name; if (!seen2.has(k)) { seen2.add(k); sugg2.push(p); } }
                            const q2 = mentionQuery.toLowerCase();
                            const filtered2 = sugg2.filter(p => !q2 || p.name.toLowerCase().includes(q2) || (p.email||"").toLowerCase().includes(q2)).slice(0, 8);
                            if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i+1, Math.max(filtered2.length-1,0))); return; }
                            if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIndex(i => Math.max(i-1, 0)); return; }
                            if (e.key === "Enter" && filtered2[mentionIndex]) {
                              e.preventDefault();
                              setMessage(message.replace(/@[^\s]*$/, `@${filtered2[mentionIndex].name} `));
                              setMentionQuery(null); setMentionIndex(0); return;
                            }
                            if (e.key === "Escape") { setMentionQuery(null); return; }
                          }
                          if (e.key === "Enter" && !e.shiftKey) handleSend();
                        }}
                        className="w-full bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"/>
                    </div>

                    {/* Emoji picker popup */}
                    {showEmojiPicker && (
                      <div data-emoji-picker className="absolute bottom-full mb-2 left-0 w-72 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-50 p-3">
                        <div className="grid grid-cols-9 gap-0.5">
                          {EMOJI_LIST.map(emoji => (
                            <button key={emoji}
                              onClick={() => { setMessage(m => m + emoji); setShowEmojiPicker(false); composerInputRef.current?.focus(); }}
                              className="text-lg p-1.5 rounded-lg hover:bg-white/15 transition-colors text-center leading-none">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-2 pb-2 pt-1">
                      <div className="flex items-center gap-0.5">
                        <button title="Format" className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors">
                          <Pencil className="w-4 h-4"/>
                        </button>
                        <button title="Emoji" onClick={() => setShowEmojiPicker(p=>!p)}
                          className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${showEmojiPicker?"text-[#6264A7] bg-[#6264A7]/15":"text-white/35 hover:text-white/70"}`}>
                          <Smile className="w-4 h-4"/>
                        </button>
                        <button title="Attach file" onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors">
                          <Paperclip className="w-4 h-4"/>
                        </button>
                        <button title="Attach image" onClick={() => imageInputRef.current?.click()}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors">
                          <Repeat2 className="w-4 h-4"/>
                        </button>
                        <button title={isRecording ? "Stop recording" : "Record voice"}
                          onClick={handleRecordToggle}
                          className={`p-1.5 rounded-lg transition-colors ${isRecording ? "text-rose-400 bg-rose-500/15 animate-pulse" : "hover:bg-white/10 text-white/35 hover:text-white/70"}`}>
                          <Mic className="w-4 h-4"/>
                        </button>
                        {isRecording && (
                          <span className="flex items-center gap-1 text-xs text-rose-400 font-medium select-none">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"/>
                            {String(Math.floor(recordingSeconds/60)).padStart(2,"0")}:{String(recordingSeconds%60).padStart(2,"0")}
                          </span>
                        )}
                        <button title="Mention someone"
                          onClick={() => {
                            setMessage(m => { const v = m.endsWith(" ") || m === "" ? m + "@" : m + " @"; return v; });
                            setMentionQuery("");
                            setMentionIndex(0);
                            composerInputRef.current?.focus();
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors">
                          <AtSign className="w-4 h-4"/>
                        </button>
                        <button title="More options"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors">
                          <Plus className="w-4 h-4"/>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-px h-5 bg-white/12"/>
                        <button onClick={() => {
                          handleSend();
                          setShowEmojiPicker(false);
                        }} disabled={isRecording || (!message.trim() && pendingFiles.length===0 && pendingImages.length===0)}
                          title="Send"
                          className={`p-1.5 rounded-lg transition-colors ${
                            !isRecording && (message.trim() || pendingFiles.length>0 || pendingImages.length>0)
                              ? "text-[#6264A7] hover:bg-[#6264A7]/15 hover:text-[#8385c7]"
                              : "text-white/15 cursor-not-allowed"
                          }`}>
                          <Send className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>
                  </div>
                  {sendError&&<p className="text-xs text-red-400 mt-1.5">{sendError}</p>}
                </div>
              </>
            ) : showNewMessage ? (
              /* ── New message inline panel ── */
              (() => {
                const seen = new Set(chatContacts.map(c => c.email.toLowerCase()));
                const allPeople = [...chatContacts, ...teamsPeople.filter(p => !seen.has(p.email.toLowerCase()))];
                const nmFiltered = nmQuery
                  ? allPeople.filter(p =>
                      p.name.toLowerCase().includes(nmQuery.toLowerCase()) ||
                      p.email.toLowerCase().includes(nmQuery.toLowerCase()))
                  : allPeople.slice(0, 8);
                const avatarColors = ["bg-teal-600","bg-blue-600","bg-[#6264A7]","bg-emerald-600","bg-rose-600","bg-amber-600","bg-violet-600","bg-cyan-600","bg-pink-600","bg-orange-600"];

                const doSend = () => {
                  if (!nmBody.trim() || nmRecipients.length === 0 || nmSending) return;
                  setNmSending(true);
                  const recipient = nmRecipients[0];
                  const existingChat = chats.find(c =>
                    (c.members||[]).some(m => m.email?.toLowerCase() === recipient.email.toLowerCase())
                  );
                  if (existingChat) {
                    setSelectedChat(existingChat); setSection("chat"); setShowNewMessage(false);
                    setTimeout(() => setMessage(nmBody), 100);
                    setNmSending(false);
                  } else {
                    fetch("https://graph.microsoft.com/v1.0/chats", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ chatType: "oneOnOne", members: [
                        { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": "https://graph.microsoft.com/v1.0/users('me')" },
                        { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipient.email}')` },
                      ]}),
                    })
                    .then(r => r.ok ? r.json() : null)
                    .then(chatData => {
                      if (chatData?.id) {
                        fetch(`https://graph.microsoft.com/v1.0/chats/${chatData.id}/messages`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                          body: JSON.stringify({ body: { content: nmBody } }),
                        }).then(() => { fetchChats(); setShowNewMessage(false); setSection("chat"); });
                      }
                    })
                    .finally(() => setNmSending(false));
                  }
                };

                return (
                  <div className="flex-1 flex flex-col bg-[#161620] overflow-hidden">
                    {/* To: bar */}
                    <div className="flex-shrink-0 bg-[#1e1e2e] border-b border-white/10">
                      <div className="flex items-center px-5 py-3 gap-3">
                        <span className="text-sm text-white/50 font-medium flex-shrink-0">To:</span>
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          {nmRecipients.map(r => (
                            <span key={r.email}
                              className="flex items-center gap-1.5 bg-[#6264A7]/25 border border-[#6264A7]/40 text-white text-sm px-3 py-1 rounded-full">
                              {r.name}
                              <button onClick={() => setNmRecipients(p => p.filter(x => x.email !== r.email))}
                                className="text-white/40 hover:text-white leading-none text-base">×</button>
                            </span>
                          ))}
                          <input
                            autoFocus
                            value={nmQuery}
                            onChange={e => setNmQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === "Escape") setShowNewMessage(false); }}
                            placeholder={nmRecipients.length === 0 ? "Enter name, chat, channel, email or tag" : ""}
                            className="flex-1 min-w-[160px] bg-transparent text-sm text-white placeholder-white/30 focus:outline-none py-1"/>
                        </div>
                        <button onClick={() => setShowNewMessage(false)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0 ml-1">
                          <X className="w-4 h-4"/>
                        </button>
                      </div>
                      {/* Suggestions dropdown */}
                      {nmFiltered.length > 0 && (
                        <div className="border-t border-white/8 bg-[#1e1e2e]">
                          {nmFiltered.map((p, i) => {
                            const parts = p.name.trim().split(/\s+/);
                            const initials = parts.map(w => w[0]).join("").slice(0,2).toUpperCase();
                            const shortName = parts[0]?.toUpperCase() || p.email.split("@")[0].toUpperCase();
                            const clr = avatarColors[i % avatarColors.length];
                            return (
                              <button key={p.email}
                                onClick={() => { setNmRecipients(prev => [...prev, p]); setNmQuery(""); }}
                                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/6 transition-colors text-left">
                                <div className={`w-9 h-9 rounded-full ${clr} flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow`}>
                                  {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-medium text-white leading-tight truncate">{p.name}</p>
                                  <p className="text-[11px] text-white/40 truncate mt-0.5">{shortName}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {nmQuery && nmFiltered.length === 0 && (
                        <div className="border-t border-white/8 px-5 py-3">
                          <p className="text-sm text-white/30">No results for "{nmQuery}"</p>
                        </div>
                      )}
                    </div>
                    {/* Main area */}
                    <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
                      {nmRecipients.length === 0 ? (
                        <div className="flex flex-col items-center gap-5 px-4">
                          <div className="relative w-28 h-28">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2d2040] to-[#1a1228] flex items-center justify-center shadow-2xl">
                              <svg className="w-12 h-12 text-[#7c5cbf]/60" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                              </svg>
                            </div>
                            <div className="absolute bottom-4 left-1 flex gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-purple-400 shadow-lg"/>
                              <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg"/>
                              <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-lg"/>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-bold text-white">You're starting a new conversation</p>
                            <p className="text-sm text-white/40 mt-1">Type your first message below.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 px-4">
                          <div className={`w-14 h-14 rounded-full ${avatarColors[0]} flex items-center justify-center text-lg font-bold text-white shadow-xl`}>
                            {nmRecipients[0].name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                          </div>
                          <div className="text-center">
                            <p className="text-base font-semibold text-white">{nmRecipients.map(r=>r.name).join(", ")}</p>
                            <p className="text-sm text-white/40 mt-1">Send a message to start the conversation</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Composer */}
                    <div className="flex-shrink-0 px-4 pb-5 pt-3">
                      <div className="bg-[#2a2a3a] border border-white/10 rounded-2xl overflow-hidden focus-within:border-white/20 transition-colors">
                        <textarea
                          value={nmBody}
                          onChange={e => setNmBody(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
                          rows={2}
                          placeholder="Type a message"
                          disabled={nmRecipients.length === 0}
                          className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-white placeholder-white/30 focus:outline-none resize-none disabled:opacity-40"
                          style={{ minHeight: "52px", maxHeight: "120px" }}
                        />
                        <div className="flex items-center justify-between px-3 pb-3 pt-1">
                          <div className="flex items-center gap-0.5">
                            <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors" title="Format">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors" title="Emoji">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors" title="Attach">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/></svg>
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/35 hover:text-white/70 transition-colors" title="More">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 5v.01M12 12v.01M12 19v.01" strokeLinecap="round" strokeWidth="2.5"/></svg>
                            </button>
                          </div>
                          <button
                            disabled={!nmBody.trim() || nmRecipients.length === 0 || nmSending}
                            onClick={doSend}
                            className="p-2 rounded-xl bg-[#6264A7] hover:bg-[#7375b5] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                            <Send className="w-4 h-4 text-white"/>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col gap-4">
                <div className="w-20 h-20 rounded-2xl bg-[#6264A7]/15 flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-[#6264A7]/60"/>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-white/70 mb-1">Select a conversation</h3>
                  <p className="text-sm text-white/40">Choose a chat to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ MEETINGS ════════════════════════════════════════════ */}
      {section === "calendar" && (
        <div className="flex-1 flex flex-col bg-[#1e1e2e] overflow-hidden relative">

          {/* ── Top toolbar ── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#1a1a2e] flex-shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowMiniCalSidebar(p=>!p)}
                title="Toggle sidebar"
                className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
                <Layers className="w-4 h-4"/>
              </button>
              <button onClick={() => { const t = new Date(); setCalendarDate(t); setMiniCalDate(t); }}
                className="px-3 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-lg text-xs text-white font-medium transition-colors">
                Today
              </button>
              <div className="flex items-center">
                <button onClick={() => calNav(-1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                <button onClick={() => calNav(1)}  className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"><ChevronRight className="w-4 h-4"/></button>
              </div>
              <span className="text-base font-semibold text-white select-none">{getCalendarTitle()}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* View selector */}
              <div className="relative">
                <button onClick={() => setShowCalViewDropdown(p=>!p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-lg text-xs text-white font-medium transition-colors capitalize">
                  {calendarView} <ChevronRight className="w-3 h-3 text-white/40 rotate-90"/>
                </button>
                {showCalViewDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCalViewDropdown(false)}/>
                    <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                      {[["day","Day"],["week","Work week"],["month","Month"]].map(([v,l]) => (
                        <button key={v} onClick={() => { setCalendarView(v); setShowCalViewDropdown(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/10 ${calendarView===v?"text-[#6264A7] bg-[#6264A7]/8 font-medium":"text-white/80"}`}>
                          {calendarView===v ? <Check className="w-3.5 h-3.5"/> : <div className="w-3.5"/>}
                          {l}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button className="p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors"><MoreHorizontal className="w-5 h-5"/></button>

              {/* Meet now */}
              <div className="relative flex">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-l-lg text-xs text-white font-medium transition-colors border-r-0">
                  <Video className="w-3.5 h-3.5 text-[#6264A7]"/> Meet now
                </button>
                <button onClick={() => setShowCalMeetNowDropdown(p=>!p)}
                  className="px-2 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-r-lg text-white transition-colors">
                  <ChevronRight className="w-3 h-3 text-white/50 rotate-90"/>
                </button>
                {showCalMeetNowDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCalMeetNowDropdown(false)}/>
                    <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                      <button onClick={() => { setShowCalMeetNowDropdown(false); setShowJoinMeetingModal(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors">
                        <Hash className="w-4 h-4 text-white/50"/> Join with a meeting ID
                      </button>
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors">
                        <PhoneCall className="w-4 h-4 text-white/50"/> Dial-in number
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* New */}
              <div className="relative flex">
                <button onClick={() => { setNewEventForm(p=>({...p,date:calendarDate.toISOString().split("T")[0]})); setShowNewEventModal(true); setShowCalNewDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-l-xl text-xs text-white font-medium transition-colors shadow-md shadow-[#6264A7]/25 border-r border-[#5153a0]">
                  <Plus className="w-3.5 h-3.5"/> New
                </button>
                <button onClick={() => setShowCalNewDropdown(p=>!p)}
                  className="px-2 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-r-xl text-white transition-colors shadow-md shadow-[#6264A7]/25">
                  <ChevronRight className="w-3 h-3 rotate-90"/>
                </button>
                {showCalNewDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCalNewDropdown(false)}/>
                    <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                      <button onClick={() => { setShowNewEventModal(true); setShowCalNewDropdown(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors">
                        <Calendar className="w-4 h-4 text-[#6264A7]"/> Event
                      </button>
                      <button onClick={() => setShowCalNewDropdown(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors">
                        <Video className="w-4 h-4 text-[#6264A7]"/> Channel meeting
                      </button>
                      <div className="border-t border-white/10 mx-3 my-1"/>
                      <p className="px-4 py-1 text-[10px] text-white/35 font-semibold uppercase tracking-widest">Organisation templates</p>
                      {[["Webinar",Globe],["Town hall",Users],["Virtual appointment",Video],["Live Event",Bell]].map(([opt,Ic]) => (
                        <button key={opt} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-colors">
                          <Ic className="w-4 h-4 text-white/40"/> {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Mini Calendar Sidebar */}
            {showMiniCalSidebar && (
              <div className="w-60 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0 overflow-y-auto teams-scrollbar">
                <div className="p-4">
                  {/* Mini cal nav */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setMiniCalDate(p=>{const d=new Date(p);d.setMonth(d.getMonth()-1);return d;})}
                      className="p-1 hover:bg-white/10 rounded-lg text-white/50 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                    <span className="text-xs font-semibold">{miniCalDate.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
                    <button onClick={() => setMiniCalDate(p=>{const d=new Date(p);d.setMonth(d.getMonth()+1);return d;})}
                      className="p-1 hover:bg-white/10 rounded-lg text-white/50 transition-colors"><ChevronRight className="w-4 h-4"/></button>
                  </div>
                  {/* Day labels */}
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((d,i)=>(
                      <div key={i} className="text-center text-[10px] text-white/30 font-medium py-0.5">{d}</div>
                    ))}
                  </div>
                  {/* Days grid */}
                  {(() => {
                    const yr=miniCalDate.getFullYear(), mo=miniCalDate.getMonth();
                    const first=new Date(yr,mo,1), last=new Date(yr,mo+1,0);
                    const cells=[];
                    for(let i=0;i<first.getDay();i++) cells.push(new Date(yr,mo,-first.getDay()+i+1));
                    for(let d=1;d<=last.getDate();d++) cells.push(new Date(yr,mo,d));
                    while(cells.length<42) cells.push(new Date(yr,mo+1,cells.length-last.getDate()-first.getDay()+1));
                    const todayStr=new Date().toDateString();
                    return (
                      <div className="grid grid-cols-7 gap-0.5">
                        {cells.map((d,i)=>{
                          const isCurMo=d.getMonth()===mo, isToday=d.toDateString()===todayStr;
                          const isSel=d.toDateString()===calendarDate.toDateString();
                          const hasEv=getEventsForDay(d).length>0;
                          return (
                            <button key={i} onClick={()=>{setCalendarDate(new Date(d));}}
                              className={`relative aspect-square flex items-center justify-center text-[11px] rounded-full transition-all ${
                                isToday?"bg-[#6264A7] text-white font-bold"
                                :isSel&&!isToday?"bg-white/20 text-white font-semibold"
                                :isCurMo?"text-white/75 hover:bg-white/10"
                                :"text-white/25 hover:bg-white/5"
                              }`}>
                              {d.getDate()}
                              {hasEv&&!isToday&&<div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#6264A7]/80"/>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                {/* Add calendar / My calendars */}
                <div className="px-4 pb-4 border-t border-white/8 pt-3 mt-auto">
                  <button className="flex items-center gap-2 text-xs text-[#6264A7] hover:text-[#8385c7] transition-colors mb-4">
                    <Plus className="w-3.5 h-3.5"/> Add calendar
                  </button>
                  <div className="flex items-center gap-2 mb-2 cursor-pointer">
                    <ChevronLeft className="w-3.5 h-3.5 text-white/40 rotate-90"/>
                    <span className="text-xs font-semibold text-white">My calendars</span>
                  </div>
                  <div className="flex items-center gap-2 px-1 py-1">
                    <div className="w-3.5 h-3.5 rounded bg-[#6264A7] flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white"/>
                    </div>
                    <span className="text-xs text-white/70">Calendar</span>
                  </div>
                  {localCalEvents.length > 0 && (
                    <div className="flex items-center gap-2 px-1 py-1 mt-1">
                      <div className="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-white"/>
                      </div>
                      <span className="text-xs text-white/70">My events ({localCalEvents.length})</span>
                    </div>
                  )}
                  {meetings.length > 0 && (
                    <button className="text-[11px] text-[#6264A7] hover:text-[#8385c7] transition-colors mt-2 px-1">Show all</button>
                  )}
                </div>
              </div>
            )}

            {/* Main calendar grid */}
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* ── MONTH VIEW ── */}
              {calendarView === "month" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-white/10 flex-shrink-0 bg-[#1a1a2e]">
                    {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(d=>(
                      <div key={d} className="px-3 py-2 text-xs text-white/40 font-medium border-r border-white/5 last:border-r-0">{d}</div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto teams-scrollbar">
                    {(() => {
                      const yr=calendarDate.getFullYear(), mo=calendarDate.getMonth();
                      const first=new Date(yr,mo,1), last=new Date(yr,mo+1,0);
                      const days=[];
                      for(let i=0;i<first.getDay();i++) days.push(new Date(yr,mo,-first.getDay()+i+1));
                      for(let d=1;d<=last.getDate();d++) days.push(new Date(yr,mo,d));
                      while(days.length%7!==0) days.push(new Date(yr,mo+1,days.length-last.getDate()-first.getDay()+1));
                      const todayStr=new Date().toDateString();
                      const weeks=[]; for(let w=0;w<days.length/7;w++) weeks.push(days.slice(w*7,w*7+7));
                      return weeks.map((week,wi)=>(
                        <div key={wi} className="grid grid-cols-7 border-b border-white/8 flex-shrink-0" style={{minHeight:"110px"}}>
                          {week.map((day,di)=>{
                            const isToday=day.toDateString()===todayStr;
                            const isCurMo=day.getMonth()===mo;
                            const evts=getEventsForDay(day);
                            return (
                              <div key={di}
                                className={`border-r border-white/5 last:border-r-0 p-2 cursor-pointer hover:bg-white/3 transition-colors ${!isCurMo?"opacity-40":""}`}
                                onClick={()=>{setNewEventForm(p=>({...p,date:day.toISOString().split("T")[0]}));setShowNewEventModal(true);}}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                                  isToday?"bg-[#6264A7] text-white font-bold":"text-white/75 hover:bg-white/10"
                                }`}>
                                  {day.getDate()===1 ? day.toLocaleDateString("en-US",{month:"short",day:"numeric"}) : day.getDate()}
                                </div>
                                <div className="space-y-0.5">
                                  {evts.slice(0,3).map((ev,ei)=>(
                                    <div key={ei} onClick={e=>{e.stopPropagation();setSelectedMeeting(ev);}}
                                      className={`text-[10px] px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:opacity-80 font-medium ${ev.isOnlineMeeting?"bg-[#6264A7]/70 text-white":"bg-blue-500/60 text-white"}`}>
                                      {fmtMeetingTime(ev.from)} {ev.title}
                                    </div>
                                  ))}
                                  {evts.length>3&&<div className="text-[10px] text-white/40 px-1">+{evts.length-3} more</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* ── WEEK VIEW ── */}
              {calendarView === "week" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {(() => {
                    const ws=new Date(calendarDate); ws.setDate(ws.getDate()-ws.getDay());
                    const wdays=Array.from({length:7},(_,i)=>{const d=new Date(ws);d.setDate(ws.getDate()+i);return d;});
                    const todayStr=new Date().toDateString();
                    const hours=Array.from({length:15},(_,i)=>i+7);
                    return (
                      <>
                        <div className="grid flex-shrink-0 bg-[#1a1a2e] border-b border-white/10" style={{gridTemplateColumns:"56px repeat(7,1fr)"}}>
                          <div className="border-r border-white/5 py-2"/>
                          {wdays.map((d,i)=>{
                            const isToday=d.toDateString()===todayStr;
                            return (
                              <div key={i} className={`px-1 py-2 text-center border-r border-white/5 last:border-r-0 ${isToday?"bg-[#6264A7]/10":""}`}>
                                <p className="text-[10px] text-white/40 uppercase font-medium">{d.toLocaleDateString("en-US",{weekday:"short"})}</p>
                                <div className={`mx-auto mt-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${isToday?"bg-[#6264A7] text-white":"text-white/80"}`}>{d.getDate()}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex-1 overflow-y-auto teams-scrollbar">
                          <div className="grid" style={{gridTemplateColumns:"56px repeat(7,1fr)"}}>
                            {hours.map(hr=>(
                              <React.Fragment key={hr}>
                                <div className="text-[10px] text-white/30 px-1 pt-1 border-r border-white/5 border-b border-white/5 text-right leading-none" style={{height:"56px"}}>
                                  {hr===12?"12 PM":hr>12?`${hr-12} PM`:`${hr} AM`}
                                </div>
                                {wdays.map((d,di)=>{
                                  const evts=getEventsForDay(d).filter(ev=>ev.from&&new Date(ev.from).getHours()===hr);
                                  return (
                                    <div key={di} className="border-b border-r border-white/5 last:border-r-0 relative hover:bg-white/3 transition-colors cursor-pointer" style={{height:"56px"}}
                                      onClick={()=>{const dt=new Date(d);dt.setHours(hr,0,0,0);setNewEventForm(p=>({...p,date:d.toISOString().split("T")[0],startTime:`${String(hr).padStart(2,"0")}:00`,endTime:`${String(hr+1).padStart(2,"0")}:00`}));setShowNewEventModal(true);}}>
                                      {evts.map((ev,ei)=>(
                                        <div key={ei} onClick={e=>{e.stopPropagation();setSelectedMeeting(ev);}}
                                          className="absolute inset-x-0.5 top-0.5 text-[10px] px-1.5 py-1 rounded-lg bg-[#6264A7]/75 hover:bg-[#6264A7] text-white truncate cursor-pointer transition-colors z-10 font-medium border-l-2 border-[#6264A7]">
                                          {ev.title}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ── DAY VIEW ── */}
              {calendarView === "day" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {(() => {
                    const todayStr=new Date().toDateString();
                    const isToday=calendarDate.toDateString()===todayStr;
                    const hours=Array.from({length:15},(_,i)=>i+7);
                    const allEvts=getEventsForDay(calendarDate);
                    return (
                      <>
                        <div className="flex-shrink-0 border-b border-white/10 bg-[#1a1a2e] flex" style={{paddingLeft:"56px"}}>
                          <div className={`px-6 py-3 text-center ${isToday?"bg-[#6264A7]/10":""}`}>
                            <p className="text-[11px] text-white/40 uppercase font-medium">{calendarDate.toLocaleDateString("en-US",{weekday:"short"})}</p>
                            <div className={`mx-auto mt-1 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isToday?"bg-[#6264A7] text-white":"text-white/80"}`}>{calendarDate.getDate()}</div>
                          </div>
                        </div>
                        {allEvts.filter(ev=>!ev.from).length>0&&(
                          <div className="flex border-b border-white/8 flex-shrink-0" style={{paddingLeft:"0"}}>
                            <div className="w-14 text-[10px] text-white/30 px-2 pt-2 text-right flex-shrink-0">All day</div>
                            <div className="flex-1 p-1 flex flex-wrap gap-1">
                              {allEvts.filter(ev=>!ev.from).map((ev,i)=>(
                                <div key={i} onClick={()=>setSelectedMeeting(ev)}
                                  className="text-xs px-2.5 py-1 rounded-lg bg-[#6264A7]/60 text-white cursor-pointer hover:bg-[#6264A7] transition-colors">{ev.title}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 overflow-y-auto teams-scrollbar">
                          {hours.map(hr=>{
                            const evts=allEvts.filter(ev=>ev.from&&new Date(ev.from).getHours()===hr);
                            return (
                              <div key={hr} className="flex border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer" style={{minHeight:"56px"}}
                                onClick={()=>{setNewEventForm(p=>({...p,date:calendarDate.toISOString().split("T")[0],startTime:`${String(hr).padStart(2,"0")}:00`,endTime:`${String(hr+1).padStart(2,"0")}:00`}));setShowNewEventModal(true);}}>
                                <div className="w-14 text-[10px] text-white/30 px-2 pt-1 text-right flex-shrink-0 leading-none">
                                  {hr===12?"12 PM":hr>12?`${hr-12} PM`:`${hr} AM`}
                                </div>
                                <div className="flex-1 px-2 py-1 space-y-1">
                                  {evts.map((ev,i)=>(
                                    <div key={i} onClick={e=>{e.stopPropagation();setSelectedMeeting(ev);}}
                                      className="text-sm px-3 py-2 rounded-xl bg-[#6264A7]/70 hover:bg-[#6264A7] text-white cursor-pointer transition-colors border-l-4 border-[#6264A7]">
                                      <p className="font-medium truncate">{ev.title}</p>
                                      <p className="text-xs opacity-70 mt-0.5">{fmtMeetingTime(ev.from)}{ev.to?` – ${fmtMeetingTime(ev.to)}`:""}</p>
                                      {ev.isOnlineMeeting&&<span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded mt-1 inline-block">Teams Meeting</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Event detail panel */}
          {selectedMeeting && (
            <div className="absolute inset-y-0 right-0 w-80 bg-[#1a1a2e] border-l border-white/10 flex flex-col shadow-2xl z-30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-semibold">Event details</h3>
                <button onClick={()=>setSelectedMeeting(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 transition-colors"><X className="w-4 h-4"/></button>
              </div>
              <div className="flex-1 overflow-y-auto teams-scrollbar p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${selectedMeeting.isOnlineMeeting?"bg-[#6264A7]/30":"bg-blue-500/20"}`}>
                    {selectedMeeting.isOnlineMeeting?<Video className="w-5 h-5 text-[#c7c9f3]"/>:<Calendar className="w-5 h-5 text-blue-300"/>}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold leading-tight">{selectedMeeting.title}</h2>
                    <p className="text-[11px] text-white/45 mt-0.5">{fmtMeetingDate(selectedMeeting.from)}</p>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-[#6264A7] flex-shrink-0"/>
                    <span className="text-sm text-white/80">{fmtMeetingTime(selectedMeeting.from)}{selectedMeeting.to?` – ${fmtMeetingTime(selectedMeeting.to)}`:""} · {meetingDuration(selectedMeeting.from,selectedMeeting.to)}</span>
                  </div>
                  {selectedMeeting.timeZone&&<div className="flex items-center gap-2.5"><Globe className="w-4 h-4 text-white/30"/><span className="text-xs text-white/45">{selectedMeeting.timeZone}</span></div>}
                  {selectedMeeting.location&&<div className="flex items-center gap-2.5"><MapPin className="w-4 h-4 text-white/40"/><span className="text-sm text-white/70">{selectedMeeting.location}</span></div>}
                </div>
                {selectedMeeting.isOnlineMeeting&&(
                  selectedMeeting.teamsJoinUrl?(
                    <a href={selectedMeeting.teamsJoinUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm font-medium transition-colors shadow-lg shadow-[#6264A7]/20">
                      <Video className="w-4 h-4"/> Join Teams Meeting
                    </a>
                  ):(
                    <button className="w-full py-2 bg-[#6264A7]/20 rounded-xl text-sm text-white/40 cursor-not-allowed">No join link available</button>
                  )
                )}
                {selectedMeeting.attendees&&(
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[11px] uppercase tracking-wider text-white/35 mb-2 font-semibold">Attendees</p>
                    <div className="flex flex-wrap gap-1.5">
                      {String(selectedMeeting.attendees).split(/[,;]+/).filter(Boolean).slice(0,8).map((a,i)=>(
                        <div key={i} className="flex items-center gap-1.5 bg-white/8 rounded-full px-2 py-1">
                          <div className="w-5 h-5 rounded-full bg-[#6264A7]/60 flex items-center justify-center text-[9px] font-bold">{a.trim().charAt(0).toUpperCase()}</div>
                          <span className="text-[11px] text-white/60 max-w-[80px] truncate">{a.trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedMeeting.organizer&&<div className="bg-white/5 rounded-xl p-3"><p className="text-[11px] uppercase tracking-wider text-white/35 mb-1 font-semibold">Organizer</p><p className="text-sm text-white/65">{selectedMeeting.organizer}</p></div>}
                {selectedMeeting.description&&<div className="bg-white/5 rounded-xl p-3"><p className="text-[11px] uppercase tracking-wider text-white/35 mb-2 font-semibold">Description</p><p className="text-sm text-white/65 leading-relaxed">{selectedMeeting.description.slice(0,400)}</p></div>}
              </div>
            </div>
          )}

          {/* ── Join Meeting Modal ── */}
          {showJoinMeetingModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={()=>setShowJoinMeetingModal(false)}>
              <div className="bg-[#1a1b2e] border border-white/15 rounded-2xl shadow-2xl w-96 p-6" onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold">Join with a meeting ID</h2>
                  <button onClick={()=>setShowJoinMeetingModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Meeting ID</label>
                    <input type="text" placeholder="Enter meeting ID or link" value={meetingIdInput}
                      onChange={e=>setMeetingIdInput(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6264A7]/50 transition-all"/>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Passcode <span className="text-white/25 font-normal">(optional)</span></label>
                    <input type="password" placeholder="Enter passcode" value={meetingPasscode}
                      onChange={e=>setMeetingPasscode(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&meetingIdInput.trim()){window.open(`https://teams.microsoft.com/l/meetup-join/19%3Ameeting_${encodeURIComponent(meetingIdInput.trim())}%40thread.v2/0`,"_blank");setShowJoinMeetingModal(false);setMeetingIdInput("");setMeetingPasscode("");}}}
                      className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6264A7]/50 transition-all"/>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={()=>{setShowJoinMeetingModal(false);setMeetingIdInput("");setMeetingPasscode("");}}
                      className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-sm text-white font-medium transition-colors">Cancel</button>
                    <button
                      onClick={()=>{if(meetingIdInput.trim()){window.open(`https://teams.microsoft.com/l/meetup-join/19%3Ameeting_${encodeURIComponent(meetingIdInput.trim())}%40thread.v2/0`,"_blank");setShowJoinMeetingModal(false);setMeetingIdInput("");setMeetingPasscode("");}}}
                      disabled={!meetingIdInput.trim()}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg ${meetingIdInput.trim()?"bg-[#6264A7] hover:bg-[#7375b5] text-white shadow-[#6264A7]/25":"bg-[#6264A7]/30 text-white/40 cursor-not-allowed"}`}>
                      Join meeting
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── New Event Modal ── */}
          {showNewEventModal && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={()=>{setShowNewEventModal(false);setSelectedAttendees([]);setAttendeeSearch("");setShowAttendeePicker(false);}}>
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{height:"88vh"}} onClick={e=>e.stopPropagation()}>

                {/* ── Top toolbar ── */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#13132a] border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {/* Event / Series tabs */}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252545] border border-[#6264A7]/50 text-white text-xs font-semibold rounded-md">
                      <Calendar className="w-3.5 h-3.5 text-[#8b8fd4]"/>Event
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-white/50 hover:bg-white/8 text-xs rounded-md transition-colors">
                      <RefreshCw className="w-3.5 h-3.5"/>Series
                    </button>
                    <div className="w-px h-5 bg-white/15 mx-1.5"/>
                    {/* Busy dropdown */}
                    <div className="relative">
                      <button
                        onClick={()=>setShowBusyDropdown(p=>!p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-white/60 hover:bg-white/8 text-xs rounded-md transition-colors">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          busyStatus==="Free"?"bg-green-400":
                          busyStatus==="Working elsewhere"?"bg-yellow-400":
                          busyStatus==="Tentative"?"bg-blue-400/70 border border-blue-400":
                          busyStatus==="Out of office"?"bg-purple-400":
                          "bg-[#9b9de0]"
                        }`}/>
                        {busyStatus}<ChevronDown className="w-3 h-3"/>
                      </button>
                      {showBusyDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={()=>setShowBusyDropdown(false)}/>
                          <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                            {["Free","Working elsewhere","Tentative","Busy","Out of office"].map(opt=>(
                              <button key={opt}
                                onClick={()=>{setBusyStatus(opt);setShowBusyDropdown(false);}}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors text-left">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  opt==="Free"?"bg-green-400":
                                  opt==="Working elsewhere"?"bg-yellow-400":
                                  opt==="Tentative"?"bg-blue-400/70 border border-blue-400":
                                  opt==="Out of office"?"bg-purple-400":
                                  "bg-[#9b9de0]"
                                }`}/>
                                <span className="flex-1">{opt}</span>
                                {busyStatus===opt && <Check className="w-3.5 h-3.5 text-[#9b9de0]"/>}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {/* ── Reminder dropdown ── */}
                    <div className="relative">
                      <button onClick={()=>{setShowReminderDropdown(p=>!p);setShowBusyDropdown(false);setShowCategoryDropdown(false);setShowPrivacyDropdown(false);}}
                        className="flex items-center gap-0.5 px-2 py-1.5 text-white/45 hover:bg-white/8 rounded-md transition-colors">
                        <Bell className="w-3.5 h-3.5"/><ChevronDown className="w-3 h-3"/>
                      </button>
                      {showReminderDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={()=>setShowReminderDropdown(false)}/>
                          <div className="absolute top-full left-0 mt-1 w-52 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                            {["Don't remind me","At time of event","5 minutes before","15 minutes before","30 minutes before","1 hour before","2 hours before","12 hours before","1 day before","1 week before"].map(opt=>(
                              <button key={opt} onClick={()=>{setReminder(opt);setShowReminderDropdown(false);}}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors text-left">
                                <span className="w-3.5 shrink-0 flex items-center justify-center">
                                  {reminder===opt && <Check className="w-3.5 h-3.5 text-[#9b9de0]"/>}
                                </span>
                                {opt}
                              </button>
                            ))}
                            <div className="border-t border-white/10 mt-1 pt-1">
                              <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-colors text-left">
                                <span className="w-3.5 shrink-0"/>Add email reminder
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ── Category dropdown ── */}
                    <div className="relative">
                      <button onClick={()=>{setShowCategoryDropdown(p=>!p);setShowBusyDropdown(false);setShowReminderDropdown(false);setShowPrivacyDropdown(false);}}
                        className="flex items-center gap-0.5 px-2 py-1.5 text-white/45 hover:bg-white/8 rounded-md transition-colors">
                        <Tag className="w-3.5 h-3.5"/><ChevronDown className="w-3 h-3"/>
                      </button>
                      {showCategoryDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={()=>setShowCategoryDropdown(false)}/>
                          <div className="absolute top-full left-0 mt-1 w-52 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                            {[
                              {label:"Blue category",   color:"#0078D4"},
                              {label:"Green category",  color:"#107C10"},
                              {label:"Orange category", color:"#CA5010"},
                              {label:"Purple category", color:"#5C2D91"},
                              {label:"Red category",    color:"#D13438"},
                              {label:"Yellow category", color:"#C19C00"},
                            ].map(({label,color})=>(
                              <button key={label} onClick={()=>{setCategory(c=>c===label?null:label);setShowCategoryDropdown(false);}}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors text-left">
                                <span className="shrink-0" style={{color}}><Tag className="w-3.5 h-3.5"/></span>
                                <span className="flex-1">{label}</span>
                                {category===label && <Check className="w-3.5 h-3.5 text-[#9b9de0]"/>}
                              </button>
                            ))}
                            <div className="border-t border-white/10 mt-1 pt-1">
                              <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-colors text-left">
                                <span className="w-3.5 shrink-0"/>New category
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ── Privacy dropdown ── */}
                    <div className="relative">
                      <button onClick={()=>{setShowPrivacyDropdown(p=>!p);setShowBusyDropdown(false);setShowReminderDropdown(false);setShowCategoryDropdown(false);}}
                        className="flex items-center gap-0.5 px-2 py-1.5 text-white/45 hover:bg-white/8 rounded-md transition-colors">
                        <Lock className="w-3.5 h-3.5"/><ChevronDown className="w-3 h-3"/>
                      </button>
                      {showPrivacyDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={()=>setShowPrivacyDropdown(false)}/>
                          <div className="absolute top-full left-0 mt-1 w-40 bg-[#1e1f38] border border-white/15 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                            {["Private","Not private"].map(opt=>(
                              <button key={opt} onClick={()=>{setPrivacy(opt);setShowPrivacyDropdown(false);}}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors text-left">
                                <span className="w-3.5 shrink-0 flex items-center justify-center">
                                  {privacy===opt && <Check className="w-3.5 h-3.5 text-[#9b9de0]"/>}
                                </span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async ()=>{
                        if(!newEventForm.title.trim()||!newEventForm.date) return;
                        const pad=n=>String(n).padStart(2,"0");
                        const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
                        const startStr=`${newEventForm.date}T${newEventForm.allDay?"00:00":newEventForm.startTime}:00`;
                        const endStr=`${newEventForm.date}T${newEventForm.allDay?"23:59":newEventForm.endTime}:${pad(0)}`;
                        const form={...newEventForm};
                        setShowNewEventModal(false);
                        setNewEventForm({title:"",date:"",startTime:"09:00",endTime:"10:00",allDay:false,online:true,description:"",attendees:"",location:"",agenda:""});
                        setBusyStatus("Busy"); setReminder("15 minutes before"); setCategory(null); setPrivacy("Not private");
                        setSelectedAttendees([]); setAttendeeSearch(""); setShowAttendeePicker(false);
                        if(calendarToken){
                          try{
                            const showAsMap = {"Free":"free","Working elsewhere":"workingElsewhere","Tentative":"tentative","Busy":"busy","Out of office":"oof"};
                            const reminderMap = {"Don't remind me":-1,"At time of event":0,"5 minutes before":5,"15 minutes before":15,"30 minutes before":30,"1 hour before":60,"2 hours before":120,"12 hours before":720,"1 day before":1440,"1 week before":10080};
                            const reminderMins = reminderMap[reminder]??15;
                            const body={
                              subject:form.title,
                              start:{dateTime:startStr,timeZone:tz},
                              end:{dateTime:endStr,timeZone:tz},
                              isOnlineMeeting:form.online,
                              showAs: showAsMap[busyStatus]||"busy",
                              sensitivity: privacy==="Private"?"private":"normal",
                              isReminderOn: reminderMins>=0,
                              ...(reminderMins>=0?{reminderMinutesBeforeStart:reminderMins}:{}),
                              ...(category?{categories:[category]}:{}),
                              ...(form.online?{onlineMeetingProvider:"teamsForBusiness"}:{}),
                              location:{displayName:form.location||(form.online?"Microsoft Teams":"In Person")},
                              ...(form.description?{body:{contentType:"text",content:form.description}}:{}),
                              ...(selectedAttendees.length?{attendees:selectedAttendees.map(a=>({emailAddress:{address:a.email,name:a.name},type:"required"}))}:{}),
                            };
                            const res=await fetch("https://graph.microsoft.com/v1.0/me/events",{method:"POST",headers:{Authorization:`Bearer ${calendarToken}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
                            if(res.ok){const created=await res.json();setMeetings(p=>[...p,normalizeGraphEvent(created)]);return;}
                          }catch(e){console.error("Create event error:",e);}
                        }
                        const start=new Date(`${form.date}T${form.allDay?"00:00":form.startTime}`);
                        const end=new Date(`${form.date}T${form.allDay?"23:59":form.endTime}`);
                        setLocalCalEvents(p=>[...p,{id:`local-${Date.now()}`,title:form.title,from:start.toISOString(),to:end.toISOString(),isOnlineMeeting:form.online,description:form.description,teamsJoinUrl:"",location:form.online?"Microsoft Teams":form.location||"",timeZone:""}]);
                      }}
                      disabled={!newEventForm.title.trim()||!newEventForm.date}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-md ${newEventForm.title.trim()&&newEventForm.date?"bg-[#6264A7] hover:bg-[#7375b5] text-white shadow-[#6264A7]/30":"bg-[#6264A7]/30 text-white/35 cursor-not-allowed"}`}>
                      <Bookmark className="w-3.5 h-3.5"/>Save
                    </button>
                    <button onClick={()=>setShowNewEventModal(false)} className="p-1.5 hover:bg-white/10 rounded-md text-white/35 transition-colors">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

                {/* ── Body: left form + right day view ── */}
                <div className="flex flex-1 overflow-hidden">

                  {/* LEFT: form */}
                  <div className="flex-1 overflow-y-auto px-8 py-6">

                    {/* Title */}
                    <div className="border-b border-white/20 mb-5 pb-1">
                      <input type="text" placeholder="Add title"
                        value={newEventForm.title}
                        onChange={e=>setNewEventForm(p=>({...p,title:e.target.value}))}
                        autoFocus
                        className="w-full bg-transparent text-[22px] font-light text-white placeholder-white/25 focus:outline-none"/>
                    </div>

                    {/* ── Attendees / People picker ── */}
                    <div className="relative border-b border-white/8 px-1 py-2">
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-white/35 shrink-0 mt-2"/>
                        <div className="flex-1 min-w-0">
                          {/* Selected attendee chips */}
                          {selectedAttendees.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2 pt-1">
                              {selectedAttendees.map(p=>{
                                const avatarColors=["bg-[#6264A7]","bg-blue-600","bg-emerald-600","bg-rose-600","bg-amber-600","bg-violet-600","bg-cyan-600","bg-pink-600"];
                                const ac=avatarColors[(p.name||p.email).charCodeAt(0)%avatarColors.length];
                                const ini=(p.name||p.email).split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                                return (
                                  <span key={p.email} className="flex items-center gap-1.5 bg-[#6264A7]/20 border border-[#6264A7]/35 text-white text-xs px-2 py-1 rounded-full max-w-[180px]">
                                    <span className={`w-4 h-4 rounded-full ${ac} flex items-center justify-center text-[8px] font-bold shrink-0`}>{ini}</span>
                                    <span className="truncate">{p.name||p.email}</span>
                                    <button onMouseDown={e=>{e.preventDefault();setSelectedAttendees(a=>a.filter(x=>x.email!==p.email));}} className="text-white/35 hover:text-white/80 shrink-0 ml-0.5">
                                      <X className="w-2.5 h-2.5"/>
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {/* Search input */}
                          <input
                            type="text"
                            placeholder={selectedAttendees.length?"Add more attendees...":"Invite required attendees"}
                            value={attendeeSearch}
                            onChange={e=>{setAttendeeSearch(e.target.value);setShowAttendeePicker(true);}}
                            onFocus={()=>setShowAttendeePicker(true)}
                            onBlur={()=>setTimeout(()=>setShowAttendeePicker(false),150)}
                            className="w-full bg-transparent text-sm text-white placeholder-white/30 focus:outline-none py-1"/>
                        </div>
                        <AtSign className="w-4 h-4 text-white/25 shrink-0 mt-2"/>
                      </div>

                      {/* ── Suggestions dropdown ── */}
                      {showAttendeePicker && (()=>{
                        const q = attendeeSearch.toLowerCase().trim();
                        // Chat contacts first (most relevant), then people/address book — deduplicated
                        const seen = new Set(chatContacts.map(c=>c.email.toLowerCase()));
                        const extra = teamsPeople.filter(p=>!seen.has(p.email.toLowerCase()));
                        const allPeople = [...chatContacts, ...extra];
                        const pool = allPeople.filter(p=>!selectedAttendees.some(a=>a.email.toLowerCase()===p.email.toLowerCase()));
                        const suggestions = q
                          ? pool.filter(p=>p.name.toLowerCase().includes(q)||p.email.toLowerCase().includes(q))
                          : pool.slice(0,12);

                        const avatarColors=["bg-[#6264A7]","bg-blue-600","bg-emerald-600","bg-rose-600","bg-amber-600","bg-violet-600","bg-cyan-600","bg-pink-600","bg-teal-600","bg-orange-600"];
                        const addAttendee = p => {
                          setSelectedAttendees(a=>[...a,{name:p.name,email:p.email}]);
                          setAttendeeSearch("");
                          setShowAttendeePicker(true); // keep open for more
                        };

                        return (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1b32] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden" style={{maxHeight:320,overflowY:"auto"}}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
                              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                                {q ? "Search results" : chatContacts.length > 0 ? "From your chats" : "Suggested"}
                              </span>
                              {!q && chatContacts.length > 0 && (
                                <span className="text-[10px] text-white/30">{chatContacts.length} contacts</span>
                              )}
                              {!q && chatContacts.length===0 && teamsPeople.length===0 && (
                                <span className="text-[10px] text-white/30">Loading…</span>
                              )}
                            </div>

                            {/* Loading state */}
                            {!q && chatContacts.length===0 && teamsPeople.length===0 && (
                              <div className="flex items-center justify-center py-6 gap-2">
                                <div className="w-4 h-4 border-2 border-[#6264A7] border-t-transparent rounded-full animate-spin"/>
                                <span className="text-xs text-white/35">Fetching contacts…</span>
                              </div>
                            )}

                            {/* No results */}
                            {q && suggestions.length===0 && (
                              <div className="px-4 py-4 text-center">
                                <Users className="w-6 h-6 text-white/20 mx-auto mb-1"/>
                                <p className="text-xs text-white/40">No contacts match "<span className="text-white/60">{attendeeSearch}</span>"</p>
                                <p className="text-[10px] text-white/25 mt-0.5">Try a different name or email</p>
                              </div>
                            )}

                            {/* People list */}
                            {suggestions.map((p,idx)=>{
                              const ini=p.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?";
                              const ac=avatarColors[p.name.charCodeAt(0)%avatarColors.length];
                              return (
                                <button key={p.email+idx}
                                  onMouseDown={e=>{e.preventDefault();addAttendee(p);}}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 active:bg-white/12 transition-colors text-left group">
                                  {/* Avatar */}
                                  <div className={`w-9 h-9 rounded-full ${ac} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm`}>
                                    {ini}
                                  </div>
                                  {/* Name + email + title */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm text-white font-medium truncate leading-tight">{p.name}</p>
                                      {p.source==="chat" && (
                                        <span className="shrink-0 text-[9px] font-semibold bg-[#6264A7]/30 text-[#a8aaed] px-1.5 py-0.5 rounded-full leading-none">Teams</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-white/45 truncate leading-tight">{p.email}</p>
                                    {p.title && <p className="text-[10px] text-white/30 truncate leading-tight">{p.title}</p>}
                                  </div>
                                  {/* Add indicator */}
                                  <div className="w-6 h-6 rounded-full border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Plus className="w-3 h-3 text-white/60"/>
                                  </div>
                                </button>
                              );
                            })}

                            {/* Footer hint */}
                            {suggestions.length > 0 && (
                              <div className="px-4 py-2 border-t border-white/8 text-[10px] text-white/25">
                                Click a contact to add · {selectedAttendees.length} selected
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Date / Time */}
                    <div className="flex items-center gap-4 py-3 border-b border-white/8 hover:bg-white/3 transition-colors px-1 rounded">
                      <Clock className="w-5 h-5 text-white/35 flex-shrink-0"/>
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <input type="date" value={newEventForm.date}
                          onChange={e=>setNewEventForm(p=>({...p,date:e.target.value}))}
                          className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark] cursor-pointer"/>
                        {!newEventForm.allDay && (
                          <>
                            <input type="time" value={newEventForm.startTime}
                              onChange={e=>setNewEventForm(p=>({...p,startTime:e.target.value}))}
                              className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"/>
                            <span className="text-white/30 text-sm">-</span>
                            <input type="time" value={newEventForm.endTime}
                              onChange={e=>setNewEventForm(p=>({...p,endTime:e.target.value}))}
                              className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"/>
                          </>
                        )}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer ml-2 shrink-0">
                        <div onClick={()=>setNewEventForm(p=>({...p,allDay:!p.allDay}))}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${newEventForm.allDay?"bg-[#6264A7]":"bg-white/20"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newEventForm.allDay?"translate-x-4":"translate-x-0.5"}`}/>
                        </div>
                        <span className="text-xs text-white/50">All day</span>
                      </label>
                      <button className="ml-3 flex items-center gap-1.5 text-xs text-white/45 hover:text-white/65 border border-white/15 px-2.5 py-1.5 rounded-md transition-colors shrink-0">
                        <DotSquare className="w-3.5 h-3.5"/>Scheduler
                      </button>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-4 py-3 border-b border-white/8 hover:bg-white/3 transition-colors px-1 rounded">
                      <MapPin className="w-5 h-5 text-white/35 flex-shrink-0"/>
                      <input type="text" placeholder="Add a room or location"
                        value={newEventForm.location}
                        onChange={e=>setNewEventForm(p=>({...p,location:e.target.value}))}
                        className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                    </div>

                    {/* Teams meeting toggle */}
                    <div className="flex items-center gap-4 py-3 border-b border-white/8 px-1">
                      <Video className="w-5 h-5 text-white/35 flex-shrink-0"/>
                      <div onClick={()=>setNewEventForm(p=>({...p,online:!p.online}))}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${newEventForm.online?"bg-[#6264A7]":"bg-white/20"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newEventForm.online?"translate-x-4":"translate-x-0.5"}`}/>
                      </div>
                      <span className="text-sm text-white/70 font-medium">Teams meeting</span>
                    </div>

                    {/* Description rich text area */}
                    <div className="mt-4 border border-white/10 rounded-xl overflow-hidden">
                      <textarea rows={6} placeholder="Add a description or notes..."
                        value={newEventForm.description}
                        onChange={e=>setNewEventForm(p=>({...p,description:e.target.value}))}
                        className="w-full bg-[#1e1f35] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none resize-none"/>
                      {/* Rich text toolbar */}
                      <div className="flex items-center gap-0.5 px-3 py-2 bg-[#252638] border-t border-white/10">
                        {[
                          [Paperclip,"Attach"],
                          [Pencil,"Format"],
                          [Link2,"Link"],
                          [Smile,"Emoji"],
                          [Sparkles,"AI Assist"],
                        ].map(([Icon,label])=>(
                          <button key={label} title={label} className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white/70 transition-colors">
                            <Icon className="w-3.5 h-3.5"/>
                          </button>
                        ))}
                        <div className="w-px h-4 bg-white/15 mx-1"/>
                        {[
                          [Copy,"Copy"],
                          [Globe,"Translate"],
                          [Mic,"Dictate"],
                        ].map(([Icon,label])=>(
                          <button key={label} title={label} className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white/70 transition-colors">
                            <Icon className="w-3.5 h-3.5"/>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Agenda */}
                    <div className="flex items-center gap-4 py-3 mt-3 border-t border-white/8 px-1">
                      <FileText className="w-5 h-5 text-white/35 flex-shrink-0"/>
                      <input type="text" placeholder="Add an agenda"
                        value={newEventForm.agenda}
                        onChange={e=>setNewEventForm(p=>({...p,agenda:e.target.value}))}
                        className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                    </div>
                  </div>

                  {/* RIGHT: Day view */}
                  <div className="w-72 border-l border-white/10 flex flex-col shrink-0 bg-[#15162a]">
                    {/* Day header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-0.5">
                        <button className="p-1 hover:bg-white/10 rounded text-white/40 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                        <button className="p-1 hover:bg-white/10 rounded text-white/40 transition-colors"><Calendar className="w-3.5 h-3.5"/></button>
                        <button className="p-1 hover:bg-white/10 rounded text-white/40 transition-colors"><ChevronRight className="w-4 h-4"/></button>
                      </div>
                      <span className="text-xs text-white/65 font-medium flex items-center gap-1">
                        {(()=>{
                          const d = newEventForm.date ? new Date(newEventForm.date+"T12:00") : new Date();
                          return d.toLocaleDateString("en-US",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
                        })()}
                        <ChevronDown className="w-3 h-3"/>
                      </span>
                      <button className="p-1 hover:bg-white/10 rounded text-white/35 transition-colors"><ExternalLink className="w-3.5 h-3.5"/></button>
                    </div>

                    {/* Hour time grid */}
                    <div className="flex-1 overflow-y-auto relative">
                      {Array.from({length:14},(_,i)=>{
                        const h = i + 7; // 7 AM to 8 PM
                        const h12 = h === 12 ? 12 : h > 12 ? h - 12 : h;
                        const ampm = h < 12 ? "AM" : "PM";
                        const label = `${h12} ${ampm}`;
                        return (
                          <div key={h} className="flex border-b border-white/5" style={{height:48}}>
                            <div className="w-14 text-right pr-2 pt-1 text-[9px] text-white/30 shrink-0 select-none leading-tight">{label}</div>
                            <div className="flex-1 border-l border-white/5"/>
                          </div>
                        );
                      })}

                      {/* Highlighted event block */}
                      {newEventForm.date && !newEventForm.allDay && (()=>{
                        const [sh,sm] = newEventForm.startTime.split(":").map(Number);
                        const [eh,em] = newEventForm.endTime.split(":").map(Number);
                        const gridStart = 7; // 7 AM
                        const topPx = Math.max(0,((sh - gridStart)*60 + sm)/60*48);
                        const heightPx = Math.max(24,((eh*60+em)-(sh*60+sm))/60*48);
                        return (
                          <div className="absolute left-14 right-1 rounded-md bg-[#c84b4b] px-2 py-1 text-white text-[11px] font-medium shadow-lg flex flex-col justify-center"
                            style={{top:topPx, height:heightPx}}>
                            <span className="truncate font-semibold leading-tight">{newEventForm.title||"New event"}</span>
                            <span className="truncate opacity-80 leading-tight">{newEventForm.startTime} – {newEventForm.endTime}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CALLS ═════════════════════════════════════════════ */}
      {section === "calls" && (
        <div className="flex flex-1 overflow-hidden bg-[#1e1e2e]">

          {/* ── LEFT PANEL — Dial & Settings ── */}
          <div className="w-72 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0">
            {/* Header */}
            <div className="px-5 pt-4 pb-0 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#6264A7] flex items-center justify-center shadow-md">
                    <PhoneCall className="w-4 h-4 text-white"/>
                  </div>
                  <h2 className="text-base font-semibold">Calls</h2>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-lg text-xs text-white/80 font-medium transition-colors">
                  <ExternalLink className="w-3 h-3"/> View contacts
                </button>
              </div>
              {/* Tab */}
              <div className="flex">
                <button className="px-4 pb-2.5 text-sm font-medium text-white border-b-2 border-[#6264A7]">Personal</button>
              </div>
            </div>

            {/* Search / Dial */}
            <div className="px-4 py-3 space-y-2">
              <input type="text" placeholder="Type a name"
                value={callDialInput} onChange={e => setCallDialInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#2a2a3a] border border-white/15 rounded-lg text-sm text-white placeholder-white/35 focus:outline-none focus:ring-1 focus:ring-[#6264A7] transition-all"/>
              <button
                disabled={!callDialInput.trim()}
                onClick={() => { if (callDialInput.trim()) window.open(`https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(callDialInput.trim())}`, "_blank"); }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  callDialInput.trim()
                    ? "bg-[#2a2a3a] hover:bg-[#3a3a4a] border-white/15 text-white cursor-pointer"
                    : "bg-[#2a2a3a] border-white/8 text-white/25 cursor-not-allowed"
                }`}>
                <PhoneCall className="w-4 h-4"/> Call
              </button>
            </div>

            <div className="flex-1"/>

            {/* Bottom settings */}
            <div className="px-5 py-4 border-t border-white/10 space-y-1">
              <button className="w-full flex items-center gap-3 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 px-2 group">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/>
                  <path d="M18 6l-6-6M18 6h-4M18 6v-4"/>
                </svg>
                <span className="flex-1">Don't forward</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/25 rotate-90"/>
              </button>
              <button className="w-full flex items-center gap-3 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 px-2 group">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
                </svg>
                <span className="flex-1">PC Mic and Speakers</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/25 rotate-90"/>
              </button>
            </div>
          </div>

          {/* ── MIDDLE PANEL — History ── */}
          <div className="w-[440px] bg-[#191929] border-r border-white/10 flex flex-col flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-white/40 -rotate-90"/>
                <h3 className="text-sm font-semibold">History</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter dropdown */}
                <div className="relative">
                  <button onClick={() => setCallsFilterDropdown(p=>!p)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-lg text-xs text-white font-medium transition-colors capitalize">
                    {callsHistoryFilter === "all" ? "All" : callsHistoryFilter.charAt(0).toUpperCase()+callsHistoryFilter.slice(1)}
                    <ChevronRight className="w-3 h-3 text-white/45 rotate-90"/>
                  </button>
                  {callsFilterDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setCallsFilterDropdown(false)}/>
                      <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1b2e] border border-white/12 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                        {["all","missed","incoming","outgoing","voicemail"].map(f => (
                          <button key={f} onClick={() => { setCallsHistoryFilter(f); setCallsFilterDropdown(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/10 capitalize ${callsHistoryFilter===f?"text-[#6264A7] bg-[#6264A7]/8 font-medium":"text-white/80"}`}>
                            {callsHistoryFilter===f ? <Check className="w-3.5 h-3.5 flex-shrink-0"/> : <div className="w-3.5"/>}
                            {f === "all" ? "All" : f.charAt(0).toUpperCase()+f.slice(1)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Filter lines */}
                <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/45 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75M3 18h14.25"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Call list */}
            <div className="flex-1 overflow-y-auto teams-scrollbar">
              {(() => {
                // Only real calls from Graph API (Teams meetings from calendar)
                const allItems = filteredCalls.map(c => ({
                  id: c.id, name: c.title,
                  initials: c.title?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "TC",
                  color: "#6264A7", dot: "bg-green-400",
                  type: "outgoing",
                  date: c.from ? new Date(c.from).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}).replace(/\//g,"-") : null,
                  dur: meetingDuration(c.from, c.to) || null,
                  sub: c.organizer ? `Organised by ${c.organizer}` : "Teams Meeting",
                  rawFrom: c.from,
                  rawTo: c.to,
                })).filter(item => {
                  if (callsHistoryFilter === "all") return true;
                  return item.type === callsHistoryFilter;
                }).filter(item =>
                  !callSearch.trim() || item.name.toLowerCase().includes(callSearch.toLowerCase())
                );

                if (allItems.length === 0) return (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <PhoneCall className="w-8 h-8 text-white/15"/>
                    <p className="text-sm text-white/30">No calls found</p>
                  </div>
                );

                return allItems.map(item => (
                  <div key={item.id}
                    onClick={() => { setSelectedCall(item); setCallQuickMsg(""); }}
                    className={`flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 group
                      ${selectedCall?.id === item.id ? "bg-[#6264A7]/10 border-l-2 border-l-[#6264A7]" : ""}`}>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                        style={{backgroundColor: item.color + "55", border: `2px solid ${item.color}55`}}>
                        <span style={{color: item.color === "#6264A7" ? "#c7c9f3" : "white"}}>{item.initials}</span>
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${item.dot} border-2 border-[#191929]`}/>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.type === "missed" ? (
                          <svg className="w-3 h-3 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                        ) : (
                          <svg className="w-3 h-3 text-white/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                        )}
                        <span className={`text-xs truncate ${item.type === "missed" ? "text-rose-400 font-medium" : "text-white/45"}`}>{item.sub}</span>
                      </div>
                    </div>

                    {/* Right: date + duration + hover buttons */}
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {item.date && <span className="text-[11px] text-white/35">{item.date}</span>}
                      {item.dur  && <span className="text-[11px] text-white/35">{item.dur}</span>}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity mt-0.5">
                        {/* Call button */}
                        <button onClick={e => { e.stopPropagation(); window.open(`https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(item.name)}`, "_blank"); }}
                          className="flex items-center gap-1 px-2 py-1 bg-[#2a2a3a] hover:bg-[#6264A7]/30 border border-white/10 rounded-lg text-white/70 hover:text-white text-[11px] transition-colors">
                          <PhoneCall className="w-3 h-3"/><span>Call</span>
                        </button>
                        {/* Three-dot menu */}
                        <button onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setCallContextMenu({ item, x: r.left, y: r.bottom + 4 }); }}
                          className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* ── RIGHT PANEL — Details or Speed Dial ── */}
          <div className="flex-1 bg-[#1e1e2e] flex flex-col overflow-hidden">
            {selectedCall ? (
              /* ── Call Details Panel ── */
              <div className="flex flex-col h-full overflow-y-auto teams-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
                  <h3 className="text-sm font-semibold text-white">Details</h3>
                  <button onClick={() => setSelectedCall(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <X className="w-4 h-4"/>
                  </button>
                </div>

                {/* Avatar + name */}
                <div className="px-5 py-5 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold text-white shadow-lg"
                        style={{backgroundColor: selectedCall.color + "55", border: `2px solid ${selectedCall.color}88`}}>
                        <span style={{color: "#c7c9f3"}}>{selectedCall.initials}</span>
                      </div>
                      <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#1e1e2e]"/>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">{selectedCall.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">{selectedCall.sub}</p>
                    </div>
                  </div>

                  {/* Action icons */}
                  <div className="flex items-center gap-4 mb-4">
                    {[
                      { title:"Chat", icon: <MessageSquare className="w-4 h-4"/>, onClick: () => { const c = chats.find(x=>(x.members||[]).some(m=>m.displayName===selectedCall.name)); if(c){setSelectedChat(c);setSection("chat");} } },
                      { title:"Add contact", icon: <Users className="w-4 h-4"/>, onClick: ()=>{} },
                      { title:"Video call", icon: <Video className="w-4 h-4"/>, onClick: ()=> window.open(`https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(selectedCall.name)}&withVideo=true`,"_blank") },
                      { title:"Call", icon: <PhoneCall className="w-4 h-4"/>, onClick: ()=> window.open(`https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(selectedCall.name)}`,"_blank") },
                    ].map(({ title, icon, onClick }) => (
                      <button key={title} title={title} onClick={onClick}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-[#6264A7]/20 text-white/60 hover:text-white border border-white/10 transition-colors">
                        {icon}
                      </button>
                    ))}
                  </div>

                  {/* Quick message */}
                  <div className="flex items-center gap-2 bg-[#2a2a3a] rounded-xl px-3 py-2.5 border border-white/10 focus-within:border-[#6264A7] transition-colors">
                    <input value={callQuickMsg} onChange={e=>setCallQuickMsg(e.target.value)}
                      placeholder="Send a quick message"
                      className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                    <button disabled={!callQuickMsg.trim()} onClick={()=>{}} className="text-white/30 hover:text-white disabled:opacity-30 transition-colors">
                      <Send className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

                {/* Call log */}
                <div className="px-5 py-4 flex-1">
                  <p className="text-sm font-semibold text-white mb-3">
                    {selectedCall.rawFrom ? new Date(selectedCall.rawFrom).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) : selectedCall.date}
                  </p>

                  <div className="space-y-3">
                    {/* Outgoing row */}
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-white/5">
                          <svg className="w-3.5 h-3.5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                        </div>
                        <div>
                          <p className="text-sm text-white capitalize">{selectedCall.type === "missed" ? "Missed" : selectedCall.type === "incoming" ? "Incoming" : "Outgoing"}</p>
                          <p className="text-xs text-white/40">{selectedCall.type === "outgoing" ? "Made by you" : "Received"}</p>
                        </div>
                      </div>
                      <span className="text-xs text-white/40">
                        {selectedCall.rawFrom ? new Date(selectedCall.rawFrom).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "—"}
                      </span>
                    </div>

                    {/* Call ended row */}
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-white/5">
                          <svg className="w-3.5 h-3.5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18.75a.75.75 0 001.5 0v-7.5a.75.75 0 00-1.5 0v7.5zM16.5 18.75a.75.75 0 001.5 0v-7.5a.75.75 0 00-1.5 0v7.5zM9 18.75v-2.25M9 9.75v3M15 18.75v-3.75M15 9.75v.75M6.75 3.75h10.5a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18V6a2.25 2.25 0 012.25-2.25z"/></svg>
                        </div>
                        <p className="text-sm text-white">Call ended</p>
                      </div>
                      <span className="text-xs text-white/40">
                        {selectedCall.rawTo ? new Date(selectedCall.rawTo).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "—"}
                      </span>
                    </div>

                    {/* Total call time */}
                    <div className="flex items-center justify-between py-2">
                      <p className="text-sm font-semibold text-white">Total call time</p>
                      <span className="text-sm font-semibold text-white">{selectedCall.dur || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            /* ── Speed Dial ── */
            <><div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold">Speed dial</h3>
              <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/45 transition-colors" title="Manage speed dial">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                  <path d="M19.5 12c0-.34-.034-.672-.1-.993M19.5 12h1.5M15 16.5a4.5 4.5 0 10-9 0"/>
                </svg>
              </button>
            </div>

            {/* Empty speed dial state */}
            {speedDialContacts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
                {/* 3D-style avatar illustration */}
                <div className="relative w-44 h-36 mx-auto">
                  {/* Back avatar - blue */}
                  <div className="absolute top-2 right-6 w-20 h-20 rounded-full shadow-2xl overflow-hidden border-4 border-[#1e1e2e]"
                    style={{background:"linear-gradient(135deg,#3b82f6,#1d4ed8)"}}>
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-9 h-9 text-white/70" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                    </div>
                  </div>
                  {/* Middle avatar - purple */}
                  <div className="absolute top-6 left-4 w-20 h-20 rounded-full shadow-2xl overflow-hidden border-4 border-[#1e1e2e]"
                    style={{background:"linear-gradient(135deg,#8b5cf6,#5b21b6)"}}>
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-9 h-9 text-white/70" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                    </div>
                  </div>
                  {/* Front + button - gold */}
                  <div className="absolute bottom-0 right-2 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center border-4 border-[#1e1e2e]"
                    style={{background:"linear-gradient(135deg,#fbbf24,#d97706)"}}>
                    <Plus className="w-7 h-7 text-white font-bold"/>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Add people to speed dial for quick access.</p>
                </div>
                <button onClick={() => setShowAddSpeedDial(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] border border-white/15 rounded-xl text-sm text-white font-medium transition-colors shadow-md">
                  <svg className="w-4 h-4 text-[#6264A7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                  </svg>
                  Add
                </button>
              </div>
            ) : (
              /* Speed dial contacts grid */
              <div className="p-5 grid grid-cols-3 gap-4 overflow-y-auto teams-scrollbar">
                {speedDialContacts.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg"
                        style={{background: `linear-gradient(135deg, ${c.color || "#6264A7"}, ${c.color || "#6264A7"}88)`}}>
                        {c.initials || c.name?.slice(0,2)?.toUpperCase()}
                      </div>
                      <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1e1e2e]"/>
                    </div>
                    <p className="text-xs text-white/75 text-center truncate w-full">{c.name}</p>
                    <button onClick={() => window.open(`https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(c.name)}`, "_blank")}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-3 py-1 bg-[#6264A7]/20 hover:bg-[#6264A7]/40 rounded-lg text-[11px] text-[#c7c9f3] font-medium">
                      <PhoneCall className="w-3 h-3"/> Call
                    </button>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" onClick={() => setShowAddSpeedDial(true)}>
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center hover:border-[#6264A7]/50 transition-colors">
                    <Plus className="w-6 h-6 text-white/30"/>
                  </div>
                  <p className="text-xs text-white/40">Add</p>
                </div>
              </div>
            )}
            </>
            )}
          </div>

          {/* ── Add to Speed Dial modal ── */}
          {showAddSpeedDial && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowAddSpeedDial(false)}>
              <div className="bg-[#1a1b2e] border border-white/15 rounded-2xl shadow-2xl w-96 p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold">Add to speed dial</h2>
                  <button onClick={() => setShowAddSpeedDial(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/35"/>
                    <input type="text" placeholder="Search for a person"
                      className="w-full pl-9 pr-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6264A7]/50 transition-all"/>
                  </div>
                  {/* Suggested contacts from real chats */}
                  {filteredChats.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-white/40 font-medium px-1 mb-2">From your chats</p>
                      {filteredChats.slice(0,6).map(chat => {
                        const name = getChatName(chat);
                        const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                        return (
                          <button key={chat.id}
                            onClick={() => { setSpeedDialContacts(p => [...p, {name, initials, color:"#6264A7"}]); setShowAddSpeedDial(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-left">
                            <div className="w-9 h-9 rounded-full bg-[#6264A7]/40 flex items-center justify-center text-xs font-bold flex-shrink-0 text-[#c7c9f3]">{initials}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/90 truncate">{name}</p>
                              <p className="text-[11px] text-white/40">From your chat list</p>
                            </div>
                            <Plus className="w-4 h-4 text-[#6264A7] flex-shrink-0"/>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TASKS ════════════════════════════════════════════ */}
      {section === "tasks" && (
        <div className="flex flex-1 overflow-hidden bg-[#1e1e2e]">
          {/* Sidebar */}
          <div className="w-64 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-base font-semibold">Tasks</h2>
              <button onClick={()=>setShowNewTaskModal(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"><Plus className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto teams-scrollbar p-2 space-y-0.5">
              {[
                {id:"all",       label:"My tasks",      icon:"📋", count:tasks.filter(t=>t.status!=="completed").length},
                {id:"today",     label:"Due today",     icon:"📅", count:tasks.filter(t=>t.dueDate===new Date().toISOString().slice(0,10)&&t.status!=="completed").length},
                {id:"high",      label:"High priority", icon:"🔴", count:tasks.filter(t=>t.priority==="high"&&t.status!=="completed").length},
                {id:"completed", label:"Completed",     icon:"✅", count:tasks.filter(t=>t.status==="completed").length},
              ].map(({id,label,icon,count})=>(
                <button key={id} onClick={()=>setTaskList(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${taskList===id?"bg-[#6264A7]/25 text-white":"hover:bg-white/8 text-white/60 hover:text-white"}`}>
                  <span className="text-base leading-none">{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {count>0&&<span className="text-[10px] bg-white/10 text-white/50 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{count}</span>}
                </button>
              ))}
              <div className="pt-2 border-t border-white/10 mt-2">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/25 font-semibold">Shared plans</p>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 text-white/50 hover:text-white text-sm transition-colors">
                  <Users className="w-4 h-4 flex-shrink-0"/><span className="flex-1 text-left">Shared with me</span>
                </button>
              </div>
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-[#1a1a2e]">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {taskList==="all"?"My tasks":taskList==="today"?"Due today":taskList==="high"?"High priority":"Completed"}
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">{(()=>{const n=(taskList==="all"?tasks.filter(t=>t.status!=="completed"):taskList==="today"?tasks.filter(t=>t.dueDate===new Date().toISOString().slice(0,10)&&t.status!=="completed"):taskList==="high"?tasks.filter(t=>t.priority==="high"&&t.status!=="completed"):tasks.filter(t=>t.status==="completed")).length;return `${n} task${n!==1?"s":""}`;})()}</p>
              </div>
              <button onClick={()=>setShowNewTaskModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-lg text-xs text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                <Plus className="w-3.5 h-3.5"/>New task
              </button>
            </div>
            <div className="flex-1 overflow-y-auto teams-scrollbar p-4">
              {(()=>{
                const filtered=taskList==="all"?tasks.filter(t=>t.status!=="completed"):taskList==="today"?tasks.filter(t=>t.dueDate===new Date().toISOString().slice(0,10)&&t.status!=="completed"):taskList==="high"?tasks.filter(t=>t.priority==="high"&&t.status!=="completed"):tasks.filter(t=>t.status==="completed");
                if(filtered.length===0) return (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                    <div className="w-16 h-16 rounded-2xl bg-[#6264A7]/20 flex items-center justify-center"><CheckSquare className="w-8 h-8 text-[#6264A7]"/></div>
                    <p className="text-white/30 text-sm">No tasks here. Create one!</p>
                  </div>
                );
                return (
                  <div className="space-y-2">
                    {filtered.map(task=>(
                      <div key={task.id} onClick={()=>setSelectedTask(selectedTask?.id===task.id?null:task)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer group ${selectedTask?.id===task.id?"border-[#6264A7]/50 bg-[#6264A7]/10":"bg-[#1a1a2e] border-white/8 hover:border-white/20 hover:bg-white/5"}`}>
                        <button onClick={e=>{e.stopPropagation();setTasks(p=>p.map(t=>t.id===task.id?{...t,status:t.status==="completed"?"not-started":"completed"}:t));if(selectedTask?.id===task.id)setSelectedTask(null);}}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${task.status==="completed"?"bg-[#6264A7] border-[#6264A7]":"border-white/30 hover:border-[#6264A7]"}`}>
                          {task.status==="completed"&&<Check className="w-2.5 h-2.5 text-white"/>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${task.status==="completed"?"line-through text-white/30":"text-white/90"}`}>{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {task.dueDate&&<span className={`text-[10px] ${new Date(task.dueDate)<new Date()&&task.status!=="completed"?"text-red-400":"text-white/40"}`}>{new Date(task.dueDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                            {task.labels?.map(l=><span key={l} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#6264A7]/20 text-[#c7c9f3]">{l}</span>)}
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${task.priority==="high"?"bg-red-500/20 text-red-300":task.priority==="medium"?"bg-yellow-500/20 text-yellow-300":"bg-white/10 text-white/40"}`}>{task.priority}</span>
                        <button onClick={e=>{e.stopPropagation();setTasks(p=>p.filter(t=>t.id!==task.id));if(selectedTask?.id===task.id)setSelectedTask(null);}}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-300 transition-all flex-shrink-0">
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Task detail panel */}
          {selectedTask && (
            <div className="w-80 bg-[#1a1a2e] border-l border-white/10 flex flex-col flex-shrink-0">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-semibold">Task details</h3>
                <button onClick={()=>setSelectedTask(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
              </div>
              <div className="flex-1 overflow-y-auto teams-scrollbar p-4 space-y-4">
                <p className="text-white font-semibold text-[15px] leading-snug">{selectedTask.title}</p>
                <div className="space-y-3">
                  {[
                    ["Priority", <span className={`px-2 py-0.5 rounded-full text-xs ${selectedTask.priority==="high"?"bg-red-500/20 text-red-300":selectedTask.priority==="medium"?"bg-yellow-500/20 text-yellow-300":"bg-white/10 text-white/50"}`}>{selectedTask.priority}</span>],
                    ["Status",   <span className="text-sm text-white/70 capitalize">{selectedTask.status?.replace("-"," ")}</span>],
                    ["Due",      <span className={`text-sm ${new Date(selectedTask.dueDate)<new Date()&&selectedTask.status!=="completed"?"text-red-300":"text-white/70"}`}>{selectedTask.dueDate?new Date(selectedTask.dueDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}):"Not set"}</span>],
                    ["Assigned", <span className="text-sm text-white/70">{selectedTask.assignee||"Unassigned"}</span>],
                  ].map(([label,val])=>(
                    <div key={label} className="flex items-center gap-3">
                      <p className="text-[11px] text-white/35 uppercase tracking-wide w-16 flex-shrink-0">{label}</p>
                      {val}
                    </div>
                  ))}
                  {selectedTask.labels?.length>0&&(
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-white/35 uppercase tracking-wide w-16 flex-shrink-0">Labels</p>
                      <div className="flex flex-wrap gap-1">{selectedTask.labels.map(l=><span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-[#6264A7]/20 text-[#c7c9f3]">{l}</span>)}</div>
                    </div>
                  )}
                </div>
                {selectedTask.notes&&(
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[11px] text-white/35 uppercase tracking-wide mb-2">Notes</p>
                    <p className="text-sm text-white/60 bg-[#2a2a3a] rounded-lg px-3 py-2.5">{selectedTask.notes}</p>
                  </div>
                )}
                <div className="pt-2 flex gap-2">
                  <button onClick={()=>setTasks(p=>p.map(t=>t.id===selectedTask.id?{...t,status:t.status==="completed"?"not-started":"completed"}:t))}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#6264A7] hover:bg-[#7375b5] text-white text-sm font-medium transition-colors">
                    <Check className="w-3.5 h-3.5"/>{selectedTask.status==="completed"?"Reopen":"Complete"}
                  </button>
                  <button onClick={()=>{setTasks(p=>p.filter(t=>t.id!==selectedTask.id));setSelectedTask(null);}}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-300 border border-white/10 transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New task modal */}
          {showNewTaskModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={()=>setShowNewTaskModal(false)}>
              <div className="bg-[#1e1e2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" onClick={e=>e.stopPropagation()}>
                <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-base font-semibold">New task</h2>
                  <button onClick={()=>setShowNewTaskModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Title <span className="text-red-400">*</span></label>
                    <input value={newTaskForm.title} onChange={e=>setNewTaskForm(p=>({...p,title:e.target.value}))} autoFocus
                      placeholder="Task name"
                      className="w-full bg-[#2a2a3a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#6264A7] transition-colors"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Priority</label>
                      <select value={newTaskForm.priority} onChange={e=>setNewTaskForm(p=>({...p,priority:e.target.value}))}
                        className="w-full bg-[#2a2a3a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Due date</label>
                      <input type="date" value={newTaskForm.dueDate} onChange={e=>setNewTaskForm(p=>({...p,dueDate:e.target.value}))}
                        className="w-full bg-[#2a2a3a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Notes</label>
                    <textarea value={newTaskForm.notes} onChange={e=>setNewTaskForm(p=>({...p,notes:e.target.value}))} rows={3}
                      placeholder="Add notes…"
                      className="w-full bg-[#2a2a3a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#6264A7] resize-none"/>
                  </div>
                </div>
                <div className="px-6 pb-6 flex justify-end gap-3 border-t border-white/10 pt-4">
                  <button onClick={()=>setShowNewTaskModal(false)} className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white hover:bg-white/10 transition-colors">Cancel</button>
                  <button disabled={!newTaskForm.title.trim()}
                    onClick={()=>{
                      if(!newTaskForm.title.trim()) return;
                      setTasks(p=>[...p,{id:Date.now(),title:newTaskForm.title,list:"My Tasks",priority:newTaskForm.priority,assignee:"Me",dueDate:newTaskForm.dueDate,status:"not-started",notes:newTaskForm.notes,labels:[]}]);
                      setNewTaskForm({title:"",priority:"medium",dueDate:"",notes:""});
                      setShowNewTaskModal(false);setTaskList("all");
                    }}
                    className="px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors">
                    Create task
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ APPS ═════════════════════════════════════════════ */}
      {section === "apps" && (
        <div className="flex-1 overflow-y-auto teams-scrollbar bg-[#1e1e2e]">
          <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-1">Apps</h2>
              <p className="text-sm text-white/40">Connect your work with apps and services</p>
            </div>
            <div className="relative mb-5">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/35"/>
              <input type="text" placeholder="Search all apps…" value={appsSearch} onChange={e=>setAppsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#2a2a3a] border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6264A7] transition-colors"/>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {["all","productivity","communication","analytics","crm","developer"].map(cat=>(
                <button key={cat} onClick={()=>setAppsCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${appsCategory===cat?"border-[#6264A7]/60 bg-[#6264A7]/20 text-white":"border-white/15 text-white/50 hover:text-white/80"}`}>
                  {cat==="all"?"All categories":cat}
                </button>
              ))}
            </div>
            {(()=>{
              const appList=[
                {id:"planner",   name:"Microsoft Planner", desc:"Organize teamwork with visual plans",     icon:"📋", cat:"productivity",   installed:true},
                {id:"forms",     name:"Microsoft Forms",   desc:"Create surveys, polls and quizzes",        icon:"📝", cat:"productivity"},
                {id:"powerbi",   name:"Power BI",          desc:"Interactive data visualizations",          icon:"📊", cat:"analytics"},
                {id:"github",    name:"GitHub",            desc:"Track code issues and PRs in Teams",      icon:"💻", cat:"developer"},
                {id:"jira",      name:"Jira",              desc:"Agile project & issue tracking",           icon:"🔵", cat:"developer"},
                {id:"salesforce",name:"Salesforce",        desc:"CRM insights right in your workflow",     icon:"☁️", cat:"crm"},
                {id:"zoom",      name:"Zoom",              desc:"Video conferencing integration",           icon:"📹", cat:"communication"},
                {id:"trello",    name:"Trello",            desc:"Boards, lists and cards for teams",        icon:"📌", cat:"productivity"},
                {id:"onedrive",  name:"OneDrive",          desc:"Access and share your files",              icon:"🗂️", cat:"productivity",   installed:true},
                {id:"slack",     name:"Slack",             desc:"Connect Slack conversations to Teams",    icon:"💬", cat:"communication"},
                {id:"notion",    name:"Notion",            desc:"Team wiki and project management",         icon:"📔", cat:"productivity"},
                {id:"figma",     name:"Figma",             desc:"Collaborative design in your workspace",   icon:"🎨", cat:"developer"},
              ].filter(app=>{
                if(appsSearch&&!app.name.toLowerCase().includes(appsSearch.toLowerCase())&&!app.desc.toLowerCase().includes(appsSearch.toLowerCase())) return false;
                if(appsCategory!=="all"&&app.cat!==appsCategory) return false;
                return true;
              });
              if(appList.length===0) return (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Puzzle className="w-10 h-10 text-white/15"/>
                  <p className="text-white/30 text-sm">No apps found for "{appsSearch}"</p>
                </div>
              );
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {appList.map(app=>(
                    <div key={app.id} className="flex items-start gap-4 p-4 bg-[#1a1a2e] rounded-xl border border-white/8 hover:border-[#6264A7]/30 transition-all cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl flex-shrink-0 border border-white/10">{app.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{app.name}</p>
                        <p className="text-[11px] text-white/45 mt-0.5 leading-snug line-clamp-2">{app.desc}</p>
                        <div className="mt-2.5">
                          {app.installed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <Check className="w-2.5 h-2.5"/>Added
                            </span>
                          ) : (
                            <button className="text-[11px] text-[#6264A7] hover:text-white bg-[#6264A7]/15 hover:bg-[#6264A7]/30 px-2.5 py-1 rounded-full border border-[#6264A7]/25 transition-all">Add</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══ SETTINGS ══════════════════════════════════════════ */}
      {section === "settings" && (
        <div className="flex flex-1 overflow-hidden bg-[#1e1e2e]">

          {/* ── Settings save toast ── */}
          {settingsSaved && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-5 py-3 bg-[#2a2a3a] border border-[#6264A7]/40 rounded-xl shadow-2xl text-sm text-white animate-fade-in">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0"/>{settingsSaved}
            </div>
          )}

          {/* ── Sidebar ── */}
          <div className="w-56 bg-[#1a1a2e] border-r border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 pt-5 pb-4 border-b border-white/10">
              <h2 className="text-base font-semibold">Settings</h2>
            </div>
            <div className="flex-1 overflow-y-auto teams-scrollbar p-2 space-y-0.5">
              {[
                {id:"profile",       label:"Profile",        icon:<Users className="w-4 h-4"/>},
                {id:"general",       label:"General",        icon:<Settings className="w-4 h-4"/>},
                {id:"notifications", label:"Notifications",  icon:<Bell className="w-4 h-4"/>},
                {id:"devices",       label:"Devices",        icon:<Mic className="w-4 h-4"/>},
                {id:"privacy",       label:"Privacy",        icon:<Lock className="w-4 h-4"/>},
                {id:"appearance",    label:"Appearance",     icon:<Sparkles className="w-4 h-4"/>},
                {id:"language",      label:"Language",       icon:<Globe className="w-4 h-4"/>},
                {id:"accessibility", label:"Accessibility",  icon:<Eye className="w-4 h-4"/>},
                {id:"about",         label:"About",          icon:<AlertCircle className="w-4 h-4"/>},
              ].map(({id,label,icon})=>(
                <button key={id} onClick={()=>setSettingsTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${settingsTab===id?"bg-[#6264A7]/25 text-white":"hover:bg-white/8 text-white/50 hover:text-white"}`}>
                  <span className="flex-shrink-0">{icon}</span><span>{label}</span>
                  {settingsTab===id&&<div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6264A7]"/>}
                </button>
              ))}
            </div>
            {isMsalConnected && (
              <div className="p-3 border-t border-white/10">
                <button onClick={()=>instance.logoutPopup().catch(()=>{})}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/15 text-white/40 hover:text-red-300 text-sm transition-colors">
                  <LogOut className="w-4 h-4 flex-shrink-0"/><span>Sign out</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto teams-scrollbar">
            <div className="max-w-2xl mx-auto p-8">

              {/* ─── PROFILE ─── */}
              {settingsTab==="profile"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Profile</h3>
                  {/* Avatar */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Profile picture</p>
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl flex-shrink-0"
                          style={{backgroundColor: effProfile.avatarColor}}>
                          {(effProfile.displayName||accounts[0]?.name||"U").charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ${statusColor} border-2 border-[#1a1a2e]`}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{effProfile.displayName||accounts[0]?.name||"Your Name"}</p>
                        <p className="text-xs text-white/40 mt-0.5">{accounts[0]?.username||"Not signed in"}</p>
                        {effProfile.statusMsg&&<p className="text-xs text-white/50 mt-1 italic">"{effProfile.statusMsg}"</p>}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {AVATAR_COLORS.map(c=>(
                            <button key={c} onClick={()=>saveProfile({avatarColor:c})}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${effProfile.avatarColor===c?"border-white scale-110":"border-transparent hover:scale-110"}`}
                              style={{backgroundColor:c}}/>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Profile fields */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 space-y-4">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Personal info</p>
                    {[
                      {key:"displayName", label:"Display name",   placeholder:"Your name",            val:effProfile.displayName||accounts[0]?.name||""},
                      {key:"statusMsg",   label:"Status message",  placeholder:"What's on your mind?", val:effProfile.statusMsg},
                      {key:"jobTitle",    label:"Job title",       placeholder:"e.g. Senior Engineer",  val:effProfile.jobTitle},
                      {key:"department",  label:"Department",      placeholder:"e.g. Engineering",      val:effProfile.department},
                      {key:"phone",       label:"Phone number",    placeholder:"+1 (555) 000-0000",     val:effProfile.phone},
                    ].map(({key,label,placeholder,val})=>(
                      <div key={key}>
                        <label className="text-xs text-white/50 block mb-1.5">{label}</label>
                        <input defaultValue={val} placeholder={placeholder}
                          onBlur={e=>saveProfile({[key]:e.target.value})}
                          className="w-full bg-[#252535] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#6264A7] transition-colors"/>
                      </div>
                    ))}
                  </div>
                  {/* Presence */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Presence status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[["available","bg-green-400","Available"],["busy","bg-red-400","Busy"],["away","bg-yellow-400","Away"],["offline","bg-gray-400","Appear offline"]].map(([s,c,l])=>(
                        <button key={s} onClick={()=>setUserStatus(s)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-sm ${(userStatus||"available")===s?"border-[#6264A7] bg-[#6264A7]/15 text-white":"border-white/10 hover:border-white/25 text-white/60 hover:text-white"}`}>
                          <div className={`w-3 h-3 rounded-full ${c} flex-shrink-0`}/>
                          {l}
                          {(userStatus||"available")===s&&<Check className="w-3.5 h-3.5 ml-auto text-[#6264A7]"/>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Profile updated")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── GENERAL ─── */}
              {settingsTab==="general"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">General</h3>
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    {[
                      {key:"language",       label:"App language",       sub:"Language used across the application",
                        ctrl:<select value={effGeneral.language} onChange={e=>saveGeneral({language:e.target.value})}
                          className="bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                          <option value="en-US">English (US)</option><option value="en-GB">English (UK)</option>
                          <option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option>
                        </select>},
                      {key:"timeFormat",     label:"Time format",        sub:"How time is displayed in messages",
                        ctrl:<select value={effGeneral.timeFormat} onChange={e=>saveGeneral({timeFormat:e.target.value})}
                          className="bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                          <option value="12h">12-hour (3:45 PM)</option><option value="24h">24-hour (15:45)</option>
                        </select>},
                      {key:"startupSection", label:"Open Teams to",      sub:"Which section opens when you launch",
                        ctrl:<select value={effGeneral.startupSection} onChange={e=>saveGeneral({startupSection:e.target.value})}
                          className="bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                          <option value="activity">Activity</option><option value="chat">Chat</option>
                          <option value="teams">Teams</option><option value="calendar">Calendar</option>
                        </select>},
                      {key:"density",        label:"Message density",    sub:"How compact chat messages appear",
                        ctrl:<select value={effGeneral.density} onChange={e=>saveGeneral({density:e.target.value})}
                          className="bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                          <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
                        </select>},
                    ].map(({key,label,sub,ctrl})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        {ctrl}
                      </div>
                    ))}
                  </div>

                  {/* Toggles */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    <p className="px-5 pt-4 pb-2 text-xs text-white/40 uppercase tracking-wider font-semibold">Behaviour</p>
                    {[
                      {key:"autoStart",   label:"Launch on startup",       sub:"Start Teams when your computer starts",   def:false},
                      {key:"closeToTray", label:"Close to system tray",     sub:"Keep running in the background when closed", def:true},
                      {key:"spellCheck",  label:"Spell check",              sub:"Underline misspelled words while typing", def:true},
                      {key:"linkPreview", label:"Link previews",            sub:"Show rich previews for links in messages", def:true},
                      {key:"gifPlay",     label:"Auto-play GIFs",           sub:"Animate GIFs and stickers automatically", def:true},
                    ].map(({key,label,sub,def})=>{
                      const on = effGeneral[key] !== undefined ? effGeneral[key] : def;
                      return (
                        <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                          <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                          <button onClick={()=>saveGeneral({[key]:!on})}
                            className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${on?"bg-[#6264A7]":"bg-white/20"}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on?"left-5":"left-1"}`}/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("General settings saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── NOTIFICATIONS ─── */}
              {settingsTab==="notifications"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Notifications</h3>

                  {/* Master toggle */}
                  <div className="bg-[#6264A7]/10 border border-[#6264A7]/30 rounded-2xl px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Do Not Disturb</p>
                      <p className="text-xs text-white/50 mt-0.5">Pause all notifications temporarily</p>
                    </div>
                    <button onClick={()=>setSettingsNotifs(p=>({...p,dndEnabled:!p.dndEnabled}))}
                      className={`relative w-12 h-7 rounded-full transition-all flex-shrink-0 ${settingsNotifs.dndEnabled?"bg-red-500":"bg-white/20"}`}>
                      <div className={`absolute top-1.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsNotifs.dndEnabled?"left-[28px]":"left-1.5"}`}/>
                    </button>
                  </div>

                  {settingsNotifs.dndEnabled && (
                    <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 px-5 py-4">
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-3">DND schedule</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-white/50 mb-1 block">From</label>
                          <input type="time" value={settingsNotifs.dndStart} onChange={e=>setSettingsNotifs(p=>({...p,dndStart:e.target.value}))}
                            className="w-full bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]"/>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-white/50 mb-1 block">To</label>
                          <input type="time" value={settingsNotifs.dndEnd} onChange={e=>setSettingsNotifs(p=>({...p,dndEnd:e.target.value}))}
                            className="w-full bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]"/>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity notifications */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    <p className="px-5 pt-4 pb-2 text-xs text-white/40 uppercase tracking-wider font-semibold">Activity</p>
                    {[
                      {key:"mentions",  label:"@mentions",         sub:"Get notified when someone mentions you"},
                      {key:"replies",   label:"Replies",           sub:"When someone replies in a thread you're in"},
                      {key:"reactions", label:"Reactions",         sub:"When someone reacts to your message"},
                      {key:"meetings",  label:"Meeting reminders", sub:"Reminders before your scheduled meetings start"},
                      {key:"tasks",     label:"Task assignments",  sub:"When a task is assigned to you"},
                    ].map(({key,label,sub})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        <button onClick={()=>setSettingsNotifs(p=>({...p,[key]:!p[key]}))}
                          className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${settingsNotifs[key]?"bg-[#6264A7]":"bg-white/20"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsNotifs[key]?"left-5":"left-1"}`}/>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Delivery */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    <p className="px-5 pt-4 pb-2 text-xs text-white/40 uppercase tracking-wider font-semibold">Delivery</p>
                    {[
                      {key:"desktopBanner", label:"Desktop banner",  sub:"Pop-up banners on your desktop"},
                      {key:"soundAlerts",   label:"Sound alerts",    sub:"Play a sound for incoming notifications"},
                    ].map(({key,label,sub})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        <button onClick={()=>setSettingsNotifs(p=>({...p,[key]:!p[key]}))}
                          className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${settingsNotifs[key]?"bg-[#6264A7]":"bg-white/20"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsNotifs[key]?"left-5":"left-1"}`}/>
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-4">
                      <div><p className="text-sm text-white">Email digest</p><p className="text-xs text-white/40 mt-0.5">Missed activity summaries via email</p></div>
                      <select value={settingsNotifs.emailDigest} onChange={e=>setSettingsNotifs(p=>({...p,emailDigest:e.target.value}))}
                        className="bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                        <option value="off">Off</option>
                        <option value="daily">Daily digest</option>
                        <option value="weekly">Weekly digest</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Notification preferences saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── DEVICES ─── */}
              {settingsTab==="devices"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Devices</h3>

                  {/* Mic */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 space-y-4">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Microphone</p>
                    <select value={settingsDevices.mic} onChange={e=>setSettingsDevices(p=>({...p,mic:e.target.value}))}
                      className="w-full bg-[#252535] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                      {["Default","Built-in Microphone","External Microphone","Headset Microphone"].map(o=><option key={o}>{o}</option>)}
                    </select>
                    {/* Level meter */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-white/50">Microphone level</p>
                        <button onClick={()=>{
                          if(settingsMicTest){
                            clearInterval(settingsMicRef.current);
                            setSettingsMicTest(false);
                            setSettingsMicLevel(0);
                          } else {
                            setSettingsMicTest(true);
                            settingsMicRef.current = setInterval(()=>setSettingsMicLevel(Math.floor(Math.random()*90)+10),120);
                            setTimeout(()=>{clearInterval(settingsMicRef.current);setSettingsMicTest(false);setSettingsMicLevel(0);},6000);
                          }
                        }} className={`text-xs px-3 py-1 rounded-full border transition-all ${settingsMicTest?"border-red-500/50 bg-red-500/10 text-red-300":"border-[#6264A7]/40 bg-[#6264A7]/10 text-[#c7c9f3] hover:bg-[#6264A7]/20"}`}>
                          {settingsMicTest?"Stop test":"Test mic"}
                        </button>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-100 ${settingsMicLevel>70?"bg-red-400":settingsMicLevel>40?"bg-yellow-400":"bg-emerald-400"}`}
                          style={{width:`${settingsMicLevel}%`}}/>
                      </div>
                      {settingsMicTest&&<p className="text-[10px] text-white/30 mt-1">Speak into your microphone…</p>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-white">Noise suppression</p><p className="text-xs text-white/40 mt-0.5">Filter background noise automatically</p></div>
                      <button onClick={()=>setSettingsDevices(p=>({...p,noiseSuppression:!p.noiseSuppression}))}
                        className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${settingsDevices.noiseSuppression?"bg-[#6264A7]":"bg-white/20"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsDevices.noiseSuppression?"left-5":"left-1"}`}/>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-white">Echo cancellation</p><p className="text-xs text-white/40 mt-0.5">Reduce audio echo during calls</p></div>
                      <button onClick={()=>setSettingsDevices(p=>({...p,echoCancel:!p.echoCancel}))}
                        className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${settingsDevices.echoCancel?"bg-[#6264A7]":"bg-white/20"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsDevices.echoCancel?"left-5":"left-1"}`}/>
                      </button>
                    </div>
                  </div>

                  {/* Speaker */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Speaker</p>
                    <select value={settingsDevices.speaker} onChange={e=>setSettingsDevices(p=>({...p,speaker:e.target.value}))}
                      className="w-full bg-[#252535] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                      {["Default","Built-in Speakers","External Speakers","Headphones"].map(o=><option key={o}>{o}</option>)}
                    </select>
                    <button onClick={()=>{ const ctx=new(window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value=440; gain.gain.value=0.15; osc.start(); setTimeout(()=>{osc.stop();ctx.close();},600); showSettingsSaved("Speaker test — did you hear a tone?"); }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/15 border border-white/15 rounded-lg text-sm text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072"/></svg>
                      Play test sound
                    </button>
                  </div>

                  {/* Camera */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Camera</p>
                    <select value={settingsDevices.camera} onChange={e=>setSettingsDevices(p=>({...p,camera:e.target.value}))}
                      className="w-full bg-[#252535] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                      {["Default","Built-in Camera","External Webcam","Virtual Camera"].map(o=><option key={o}>{o}</option>)}
                    </select>
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-white">HD video</p><p className="text-xs text-white/40 mt-0.5">Use high-definition video when available</p></div>
                      <button onClick={()=>setSettingsDevices(p=>({...p,hdVideo:!p.hdVideo}))}
                        className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${settingsDevices.hdVideo?"bg-[#6264A7]":"bg-white/20"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsDevices.hdVideo?"left-5":"left-1"}`}/>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Device settings saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── PRIVACY ─── */}
              {settingsTab==="privacy"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Privacy</h3>
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    <p className="px-5 pt-4 pb-2 text-xs text-white/40 uppercase tracking-wider font-semibold">Messaging</p>
                    {[
                      {key:"readReceipts",   label:"Read receipts",     sub:"Let others see when you've read their messages"},
                      {key:"allowDMs",       label:"Allow direct messages", sub:"Let anyone in the org send you direct messages"},
                      {key:"showInSearch",   label:"Appear in search",  sub:"Let others find you by name or email"},
                    ].map(({key,label,sub})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        <button onClick={()=>savePrivacy({[key]:!effPrivacy[key]})}
                          className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${effPrivacy[key]?"bg-[#6264A7]":"bg-white/20"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${effPrivacy[key]?"left-5":"left-1"}`}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    <p className="px-5 pt-4 pb-2 text-xs text-white/40 uppercase tracking-wider font-semibold">Presence & location</p>
                    {[
                      {key:"sharePresence",  label:"Share presence status",  sub:"Show your availability status to other users"},
                      {key:"locationSharing",label:"Location sharing",        sub:"Share your location in messages and meetings"},
                    ].map(({key,label,sub})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        <button onClick={()=>savePrivacy({[key]:!effPrivacy[key]})}
                          className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${effPrivacy[key]?"bg-[#6264A7]":"bg-white/20"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${effPrivacy[key]?"left-5":"left-1"}`}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    <p className="px-5 pt-4 pb-2 text-xs text-white/40 uppercase tracking-wider font-semibold">Data & analytics</p>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                      <div><p className="text-sm text-white">Diagnostic data</p><p className="text-xs text-white/40 mt-0.5">Help improve the app by sharing usage data</p></div>
                      <button onClick={()=>savePrivacy({diagnosticData:!effPrivacy.diagnosticData})}
                        className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${effPrivacy.diagnosticData?"bg-[#6264A7]":"bg-white/20"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${effPrivacy.diagnosticData?"left-5":"left-1"}`}/>
                      </button>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-sm text-white mb-0.5">Download my data</p>
                      <p className="text-xs text-white/40 mb-3">Get a copy of your activity, messages and files</p>
                      <button onClick={()=>showSettingsSaved("Data export request submitted")}
                        className="flex items-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/15 border border-white/15 rounded-lg text-sm text-white transition-colors">
                        <Download className="w-4 h-4"/>Request data export
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Privacy settings saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── APPEARANCE ─── */}
              {settingsTab==="appearance"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Appearance</h3>
                  {/* Theme picker */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Theme</p>
                    <div className="flex gap-3">
                      {[{id:"dark",label:"Dark",preview:<div className="w-full h-14 rounded-lg bg-[#1e1e2e] flex flex-col gap-1 p-2"><div className="h-2 w-3/4 bg-white/20 rounded-sm"/><div className="h-2 w-1/2 bg-white/10 rounded-sm"/></div>},
                        {id:"light",label:"Light",preview:<div className="w-full h-14 rounded-lg bg-gray-100 flex flex-col gap-1 p-2"><div className="h-2 w-3/4 bg-gray-400/50 rounded-sm"/><div className="h-2 w-1/2 bg-gray-300/50 rounded-sm"/></div>},
                        {id:"system",label:"System",preview:<div className="w-full h-14 rounded-lg bg-gradient-to-r from-[#1e1e2e] to-gray-100 flex flex-col gap-1 p-2"><div className="h-2 w-3/4 bg-white/25 rounded-sm"/><div className="h-2 w-1/2 bg-white/15 rounded-sm"/></div>}
                      ].map(t=>(
                        <button key={t.id} onClick={()=>saveGeneral({theme:t.id})}
                          className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${effGeneral.theme===t.id?"border-[#6264A7] bg-[#6264A7]/10":"border-white/15 hover:border-white/30"}`}>
                          {t.preview}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white/70">{t.label}</span>
                            {effGeneral.theme===t.id&&<Check className="w-3 h-3 text-[#6264A7]"/>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font size */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Font size</p>
                    <div className="flex gap-2">
                      {[{id:"small",label:"Small",size:"text-xs"},{id:"medium",label:"Medium",size:"text-sm"},{id:"large",label:"Large",size:"text-base"},{id:"xlarge",label:"X-Large",size:"text-lg"}].map(f=>(
                        <button key={f.id} onClick={()=>saveGeneral({fontSize:f.id})}
                          className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${effGeneral.fontSize===f.id?"border-[#6264A7] bg-[#6264A7]/10":"border-white/15 hover:border-white/30"}`}>
                          <span className={`${f.size} font-medium text-white`}>Aa</span>
                          <span className="text-[10px] text-white/50">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chat bubble style */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Chat bubble style</p>
                    <div className="flex gap-3">
                      {[
                        {id:"modern", label:"Modern", preview:(
                          <div className="space-y-1.5 w-full p-2">
                            <div className="flex justify-end"><div className="px-2.5 py-1.5 bg-[#6264A7] rounded-2xl rounded-tr-sm text-[10px] text-white max-w-[70%]">Hey there!</div></div>
                            <div className="flex justify-start"><div className="px-2.5 py-1.5 bg-white/10 rounded-2xl rounded-tl-sm text-[10px] text-white max-w-[70%]">Hello!</div></div>
                          </div>
                        )},
                        {id:"classic", label:"Classic", preview:(
                          <div className="space-y-1.5 w-full p-2">
                            <div className="flex gap-2 items-start"><div className="w-5 h-5 rounded-full bg-[#6264A7]/50 flex-shrink-0"/><div className="flex-1 text-[10px] text-white/80">Hey there!</div></div>
                            <div className="flex gap-2 items-start"><div className="w-5 h-5 rounded-full bg-white/15 flex-shrink-0"/><div className="flex-1 text-[10px] text-white/80">Hello!</div></div>
                          </div>
                        )},
                      ].map(s=>(
                        <button key={s.id} onClick={()=>saveGeneral({chatBubble:s.id})}
                          className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${effGeneral.chatBubble===s.id?"border-[#6264A7] bg-[#6264A7]/10":"border-white/15 hover:border-white/30"}`}>
                          <div className="w-full h-14 bg-[#252535] rounded-lg overflow-hidden">{s.preview}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white/70">{s.label}</span>
                            {effGeneral.chatBubble===s.id&&<Check className="w-3 h-3 text-[#6264A7]"/>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Appearance saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── LANGUAGE ─── */}
              {settingsTab==="language"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Language &amp; region</h3>
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    {[
                      {key:"appLang",    label:"App language",         sub:"Language used in the interface",         opts:["English (US)","English (UK)","French","German","Spanish","Japanese","Portuguese"]},
                      {key:"spellLang",  label:"Spell check language",  sub:"Language for spell checking in composer", opts:["English (US)","English (UK)","French","German","Spanish"]},
                      {key:"dateFormat", label:"Date format",           sub:"How dates are displayed",                opts:["MM/DD/YYYY","DD/MM/YYYY","YYYY-MM-DD","D MMM YYYY"]},
                      {key:"weekStart",  label:"First day of the week", sub:"Start of your calendar week",            opts:["Sunday","Monday","Saturday"]},
                    ].map(({key,label,sub,opts})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        <select defaultValue={opts[0]} className="bg-[#252535] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6264A7]">
                          {opts.map(o=><option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Language settings saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── ACCESSIBILITY ─── */}
              {settingsTab==="accessibility"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">Accessibility</h3>
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
                    {[
                      {key:"highContrast",  label:"High contrast mode",       sub:"Increase color contrast for better readability"},
                      {key:"reduceMotion",  label:"Reduce motion",             sub:"Minimize animations and transitions"},
                      {key:"screenReader",  label:"Screen reader optimized",   sub:"Enhanced compatibility with screen readers"},
                      {key:"keyboardMode",  label:"Keyboard navigation mode",  sub:"Navigate all features using only the keyboard"},
                    ].map(({key,label,sub})=>(
                      <div key={key} className="flex items-center justify-between px-5 py-4 border-b border-white/8 last:border-0">
                        <div><p className="text-sm text-white">{label}</p><p className="text-xs text-white/40 mt-0.5">{sub}</p></div>
                        <button onClick={()=>setSettingsAccess(p=>({...p,[key]:!p[key]}))}
                          className={`relative w-10 h-6 rounded-full transition-all flex-shrink-0 ${settingsAccess[key]?"bg-[#6264A7]":"bg-white/20"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${settingsAccess[key]?"left-5":"left-1"}`}/>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Keyboard shortcuts */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Keyboard shortcuts</p>
                    <div className="space-y-2">
                      {[
                        ["Go to Activity",    "Ctrl + 1"],
                        ["Go to Chat",        "Ctrl + 2"],
                        ["Go to Teams",       "Ctrl + 3"],
                        ["Go to Calendar",    "Ctrl + 4"],
                        ["New message",       "Ctrl + N"],
                        ["Search",            "Ctrl + F"],
                        ["Reply",             "Ctrl + R"],
                        ["Open Settings",     "Ctrl + ,"],
                      ].map(([action,keys])=>(
                        <div key={action} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <span className="text-sm text-white/70">{action}</span>
                          <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs text-white/60 font-mono">{keys}</kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={()=>showSettingsSaved("Accessibility settings saved")}
                      className="px-5 py-2.5 bg-[#6264A7] hover:bg-[#7375b5] rounded-xl text-sm text-white font-medium shadow-lg shadow-[#6264A7]/25 transition-colors">
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* ─── ABOUT ─── */}
              {settingsTab==="about"&&(
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-white">About</h3>
                  {/* App info */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6264A7] to-[#464775] flex items-center justify-center shadow-xl text-2xl">🏢</div>
                      <div>
                        <p className="text-base font-semibold text-white">Elpis Teams</p>
                        <p className="text-xs text-white/40 mt-0.5">Enterprise collaboration platform</p>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {[
                        ["Version",  "1.0.7.0"],
                        ["Build",    "Production"],
                        ["Platform", "Microsoft Graph integrated"],
                        ["License",  "Enterprise"],
                        ["Last updated", new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})],
                      ].map(([label,val])=>(
                        <div key={label} className="flex items-center justify-between py-3 border-b border-white/8 last:border-0">
                          <span className="text-sm text-white/60">{label}</span>
                          <span className="text-sm text-white">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Account */}
                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Account</p>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#6264A7] flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {(effProfile.displayName||accounts[0]?.name||"U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{accounts[0]?.name||"Not signed in"}</p>
                        <p className="text-xs text-white/40 truncate">{accounts[0]?.username||"—"}</p>
                      </div>
                      <div className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${isMsalConnected?"bg-emerald-500/15 text-emerald-300 border border-emerald-500/25":"bg-red-500/15 text-red-300 border border-red-500/25"}`}>
                        {isMsalConnected?"Connected":"Offline"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isMsalConnected ? (
                        <>
                          <button onClick={()=>{ instance.acquireTokenSilent({account:accounts[0],scopes:["https://graph.microsoft.com/User.Read"],forceRefresh:true}).then(()=>showSettingsSaved("Token refreshed")).catch(()=>showSettingsSaved("Token refresh failed — try Clear cache")); }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/15 border border-white/15 rounded-lg text-sm text-white transition-colors">
                            <RefreshCw className="w-4 h-4"/>Refresh token
                          </button>
                          <button onClick={()=>{ clearMsalCache(); showSettingsSaved("Auth cache cleared — signing out…"); setTimeout(()=>instance.logoutPopup().catch(()=>{}),1500); }}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-lg text-sm text-yellow-300 transition-colors" title="Clears stored tokens — fixes repeated 400 errors">
                            <AlertCircle className="w-4 h-4"/>Clear auth cache
                          </button>
                          <button onClick={()=>instance.logoutPopup().catch(()=>{})}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-300 transition-colors">
                            <LogOut className="w-4 h-4"/>Sign out
                          </button>
                        </>
                      ) : (
                        <button onClick={handleTeamsLogin}
                          className="flex items-center gap-2 px-4 py-2 bg-[#6264A7] hover:bg-[#7375b5] rounded-lg text-sm text-white transition-colors">
                          <Users className="w-4 h-4"/>Sign in with Microsoft
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-5">
                    <div className="flex flex-wrap gap-4">
                      <button className="text-xs text-[#6264A7] hover:text-[#8385c7] hover:underline transition-colors">Privacy policy</button>
                      <button className="text-xs text-[#6264A7] hover:text-[#8385c7] hover:underline transition-colors">Terms of service</button>
                      <button className="text-xs text-[#6264A7] hover:text-[#8385c7] hover:underline transition-colors">Third-party notices</button>
                      <button className="text-xs text-[#6264A7] hover:text-[#8385c7] hover:underline transition-colors">Open-source licenses</button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>

    {/* ══════════════════════════════════════════════════════════
        Create Channel Modal
    ══════════════════════════════════════════════════════════ */}
    {showCreateChannel && (
      <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-10 px-4 pb-4">
        <div className="bg-[#1e1e2e] rounded-2xl shadow-2xl w-full max-w-[640px] flex flex-col max-h-[90vh] border border-white/10">

          {/* ── Header ── */}
          <div className="px-8 pt-8 pb-5 flex-shrink-0">
            <h2 className="text-2xl font-semibold text-white">Create a channel</h2>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto teams-scrollbar px-8 pb-2 space-y-6">

            {/* Add to team */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-white/80">Add the channel to a team</span>
                <div className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center flex-shrink-0 cursor-default" title="Every channel must be hosted by a team">
                  <span className="text-[10px] text-white/40 font-bold">i</span>
                </div>
                <span className="text-sm text-white/40">Every channel must be hosted by a team</span>
              </div>
              <div className="relative">
                <select value={ccTeamId} onChange={e => setCcTeamId(e.target.value)}
                  className="w-full bg-[#252535] border border-white/15 rounded-lg px-4 py-3.5 text-[15px] font-semibold text-white focus:outline-none focus:border-[#6264A7] appearance-none cursor-pointer transition-colors">
                  <option value="" disabled className="font-semibold">Select a team</option>
                  {joinedTeams.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                  <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
            </div>

            {/* Channel name */}
            <div>
              <label className="flex items-center gap-1 text-sm text-white/80 mb-2">
                Channel name <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input value={ccName} onChange={e => setCcName(e.target.value)} maxLength={50}
                placeholder="Letters, numbers, and spaces are allowed"
                className="w-full bg-[#252535] border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6264A7] transition-colors"/>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-white/80 mb-2">Description</label>
              <textarea value={ccDesc} onChange={e => setCcDesc(e.target.value)} rows={3}
                placeholder="Help others find the right channel by providing a description"
                className="w-full bg-[#252535] border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6264A7] resize-none transition-colors"/>
            </div>

            {/* Channel type dropdown */}
            <div>
              <label className="flex items-center gap-2 text-sm text-white/80 mb-2">
                Choose a channel type <span className="text-red-400">*</span>
                <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center cursor-default" title="Standard: everyone on team. Private: restricted. Shared: cross-org.">
                  <span className="text-[9px] text-white/40 font-bold">i</span>
                </div>
              </label>
              <div className="relative">
                <select value={ccType} onChange={e => setCcType(e.target.value)}
                  className="w-full bg-[#252535] border border-white/15 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#6264A7] appearance-none cursor-pointer transition-colors">
                  <option value="" disabled>Select</option>
                  <option value="standard">Standard</option>
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                  <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
            </div>

            {/* Layout */}
            <div className="pb-2">
              <p className="text-sm font-semibold text-white mb-0.5">Layout</p>
              <p className="text-xs text-white/45 mb-4">Channel owners can change this at any time</p>
              <div className="flex gap-4">
                {[
                  {
                    id: "threads", label: "Threads",
                    desc: "Looks like chat with replies on the side in threads. Good for",
                    preview: (
                      <div className="w-full h-20 bg-[#1a1a2e] rounded-lg p-2 space-y-1.5">
                        <div className="flex gap-1.5 items-center"><div className="w-4 h-4 rounded-full bg-[#6264A7]/60"/><div className="flex-1 h-1.5 bg-white/15 rounded-full"/></div>
                        <div className="flex gap-1.5 items-center pl-5"><div className="flex-1 h-1.5 bg-white/10 rounded-full"/><div className="w-8 h-3 bg-[#6264A7]/40 rounded"/></div>
                        <div className="flex gap-1.5 items-center"><div className="w-4 h-4 rounded-full bg-blue-500/60"/><div className="flex-1 h-1.5 bg-white/15 rounded-full"/></div>
                        <div className="flex gap-1.5 items-center pl-5"><div className="w-12 h-1.5 bg-white/10 rounded-full"/></div>
                      </div>
                    ),
                  },
                  {
                    id: "posts", label: "Posts",
                    desc: "Posts reorder by most recent reply. Good for forums and",
                    preview: (
                      <div className="w-full h-20 bg-[#1a1a2e] rounded-lg p-2 space-y-1.5">
                        <div className="h-4 bg-[#6264A7]/30 rounded flex items-center px-2"><div className="w-8 h-1.5 bg-[#6264A7]/60 rounded-full"/></div>
                        <div className="flex gap-1 items-center"><div className="flex-1 h-1.5 bg-white/15 rounded-full"/><div className="w-6 h-1.5 bg-white/10 rounded-full"/></div>
                        <div className="h-4 bg-white/5 rounded flex items-center px-2"><div className="w-10 h-1.5 bg-white/20 rounded-full"/></div>
                        <div className="flex gap-1 items-center"><div className="w-12 h-1.5 bg-white/10 rounded-full"/></div>
                      </div>
                    ),
                  },
                ].map(({ id, label, desc, preview }) => (
                  <div key={id} onClick={() => setCcType(prev => prev === id ? prev : (ccType || id))}
                    className="flex-1 bg-[#252535] border border-white/10 rounded-xl p-3 cursor-pointer hover:border-[#6264A7]/50 transition-colors">
                    {preview}
                    <div className="flex items-start gap-2.5 mt-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${id === "threads" ? "border-[#6264A7]" : "border-white/25"}`}>
                        {id === "threads" && <div className="w-2 h-2 rounded-full bg-[#6264A7]"/>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-[11px] text-white/40 mt-0.5 leading-snug">{desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {ccError && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg mb-2">{ccError}</p>}
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 px-8 py-5 flex items-center justify-end gap-3 border-t border-white/10">
            <button onClick={() => setShowCreateChannel(false)}
              className="px-6 py-2.5 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/8 transition-colors">
              Cancel
            </button>
            <button
              disabled={!ccTeamId || !ccName.trim() || !ccType || ccCreating}
              onClick={async () => {
                setCcCreating(true); setCcError("");
                try {
                  const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${ccTeamId}/channels`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${teamsApiToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ displayName: ccName.trim(), description: ccDesc.trim(), membershipType: ccType }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || "Failed to create channel"); }
                  setShowCreateChannel(false);
                } catch (e) { setCcError(e.message); }
                finally { setCcCreating(false); }
              }}
              className="px-6 py-2.5 rounded-lg bg-[#3a3a4a] hover:bg-[#4a4a5a] disabled:opacity-40 disabled:cursor-not-allowed text-white/70 text-sm font-medium transition-colors min-w-[80px]">
              {ccCreating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════
        Create Team Modal
    ══════════════════════════════════════════════════════════ */}
    {showCreateTeam && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#1e1e2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="px-7 pt-7 pb-5 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Create a team</h2>
            <p className="text-sm text-white/50 mt-1">
              You're creating a team from scratch.{" "}
              <span className="text-[#6264A7] cursor-pointer hover:underline text-sm">More create team options</span>
            </p>
          </div>
          <div className="px-7 py-6 space-y-5 max-h-[65vh] overflow-y-auto teams-scrollbar">
            {/* Team name */}
            <div>
              <label className="block text-sm text-white/80 mb-1.5">Team name <span className="text-red-400">*</span></label>
              <input value={ctName} onChange={e => setCtName(e.target.value)} maxLength={256} autoFocus
                placeholder="Give your team a name"
                className="w-full bg-transparent border-b-2 border-[#6264A7] px-1 py-2 text-sm text-white placeholder-white/25 focus:outline-none"/>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-white/80 mb-1.5">Description</label>
              <textarea value={ctDesc} onChange={e => setCtDesc(e.target.value)} rows={4}
                placeholder="Let people know what this team is all about"
                className="w-full bg-[#2a2a3a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#6264A7] resize-none"/>
            </div>

            {/* Team type */}
            <div>
              <label className="block text-sm text-white/80 mb-2">Team type</label>
              <div className="flex gap-3">
                {[
                  { val: "private", label: "Private", Icon: Lock  },
                  { val: "public",  label: "Public",  Icon: Globe },
                ].map(({ val, label, Icon }) => (
                  <button key={val} onClick={() => setCtVisibility(val)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors
                      ${ctVisibility === val
                        ? "border-[#6264A7] bg-[#6264A7]/20 text-white"
                        : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"}`}>
                    <Icon className="w-4 h-4"/>{label}
                  </button>
                ))}
              </div>
            </div>

            {/* First channel name */}
            <div>
              <label className="block text-sm text-white/80 mb-1.5">
                First channel name <span className="text-red-400">*</span>
                <span className="ml-1 text-white/30 text-xs cursor-default" title="Every team starts with a channel. You can rename it later.">ⓘ</span>
              </label>
              <div className="relative">
                <input value={ctChannel} onChange={e => setCtChannel(e.target.value)} maxLength={50}
                  placeholder="e.g. General"
                  className="w-full bg-[#2a2a3a] border border-white/10 rounded-lg px-4 py-3 pr-10 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#6264A7]"/>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </div>
              </div>
            </div>

            <p className="text-[#6264A7] text-sm cursor-pointer hover:underline">What's a team?</p>

            {ctError && <p className="text-xs text-red-400">{ctError}</p>}
          </div>
          <div className="px-7 pb-7 flex justify-end gap-3 border-t border-white/10 pt-5">
            <button onClick={() => setShowCreateTeam(false)}
              className="px-6 py-2.5 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              disabled={!ctName.trim() || !ctChannel.trim() || ctCreating}
              onClick={async () => {
                setCtCreating(true); setCtError("");
                try {
                  const res = await fetch("https://graph.microsoft.com/v1.0/teams", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${teamsApiToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      "template@odata.bind": "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
                      displayName: ctName.trim(),
                      description: ctDesc.trim(),
                      visibility: ctVisibility,
                      channels: [{ displayName: ctChannel.trim(), isFavoriteByDefault: true }],
                    }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || "Failed to create team"); }
                  setShowCreateTeam(false);
                } catch (e) { setCtError(e.message); }
                finally { setCtCreating(false); }
              }}
              className="px-6 py-2.5 rounded-xl bg-[#6264A7] hover:bg-[#7375b5] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors min-w-[80px]">
              {ctCreating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════
        Create Section Modal
    ══════════════════════════════════════════════════════════ */}
    {showCreateSection && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#1e1e2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="px-7 pt-7 pb-5">
            <h2 className="text-xl font-bold text-white">Create a new section</h2>
          </div>
          <div className="px-7 pb-5">
            <div className="flex items-center gap-3 bg-[#2a2a3a] border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-[#6264A7] transition-colors">
              {/* Section icon */}
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v4M12 16h.01"/>
                  <path d="M9 12h6" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15"/>
                  <path d="M15.5 8.5a.5.5 0 10.5.5.5.5 0 00-.5-.5" strokeWidth="1"/>
                </svg>
              </div>
              <input
                value={csName}
                onChange={e => setCsName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && csName.trim()) { setShowCreateSection(false); } }}
                placeholder="Enter a section name"
                autoFocus
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
            </div>
          </div>
          <div className="px-7 pb-7 flex justify-end gap-3">
            <button onClick={() => setShowCreateSection(false)}
              className="px-6 py-2.5 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              disabled={!csName.trim() || csCreating}
              onClick={() => { setCsCreating(true); setTimeout(() => { setShowCreateSection(false); setCsCreating(false); }, 300); }}
              className="px-6 py-2.5 rounded-xl bg-[#3a3a4a] hover:bg-[#4a4a5a] disabled:opacity-40 disabled:cursor-not-allowed text-white/60 text-sm font-medium transition-colors min-w-[80px]">
              {csCreating ? "…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Call three-dot context menu ── */}
    {callContextMenu && (
      <>
        <div className="fixed inset-0 z-[190]" onClick={() => setCallContextMenu(null)}/>
        <div className="fixed z-[200] bg-[#2a2a3a] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{ top: callContextMenu.y, left: Math.min(callContextMenu.x, window.innerWidth - 200) }}>
          {[
            { label: "Call back",         icon: <PhoneCall className="w-4 h-4"/>,   action: () => window.open(`https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(callContextMenu.item.name)}`, "_blank") },
            { label: "Chat",              icon: <MessageSquare className="w-4 h-4"/>, action: () => { const c = chats.find(x=>(x.members||[]).some(m=>m.displayName===callContextMenu.item.name)); if(c){setSelectedChat(c);setSection("chat");} } },
            { label: "Remove from view",  icon: <X className="w-4 h-4"/>,           action: () => {} },
            { label: "Add to speed dial", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/></svg>, action: () => { setSpeedDialContacts(p=>[...p,{name:callContextMenu.item.name,initials:callContextMenu.item.initials,color:"#6264A7"}]); } },
            { label: "Add contact",       icon: <Users className="w-4 h-4"/>,        action: () => {} },
            { label: "Report call",       icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18M3 9h18M3 15h18M3 21h18"/></svg>, action: () => {} },
          ].map(({ label, icon, action }) => (
            <button key={label} onClick={() => { action(); setCallContextMenu(null); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left">
              <span className="text-white/40">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </>
    )}

    {/* ══ ADD PARTICIPANTS MODAL ════════════════════════════════ */}
    {showAddParticipants && selectedChat && (()=>{
      const existingEmails = new Set(
        (selectedChat.members||[]).map(m=>(m.email||m.userId||"").toLowerCase()).filter(Boolean)
      );
      const seen = new Set(chatContacts.map(c=>c.email.toLowerCase()));
      const allPeople = [
        ...chatContacts,
        ...teamsPeople.filter(p=>!seen.has((p.email||"").toLowerCase())),
      ].filter(p=>p.email && !existingEmails.has(p.email.toLowerCase()));

      const q = addPartSearch.toLowerCase().trim();
      const filtered = q
        ? allPeople.filter(p=>(p.name||"").toLowerCase().includes(q)||(p.email||"").toLowerCase().includes(q))
        : allPeople.slice(0,30);

      const togglePick = (p)=>
        setAddPartPicked(prev=>prev.some(x=>x.email===p.email)
          ? prev.filter(x=>x.email!==p.email)
          : [...prev, p]);

      const handleAdd = async ()=>{
        if(!addPartPicked.length) return;
        setAddPartLoading(true); setAddPartError(""); setAddPartSuccess("");
        if(isMsalConnected && accessToken){
          try{
            const results = await Promise.allSettled(
              addPartPicked.map(p=>
                window.fetch(`https://graph.microsoft.com/v1.0/chats/${selectedChat.id}/members`,{
                  method:"POST",
                  headers:{"Authorization":`Bearer ${accessToken}`,"Content-Type":"application/json"},
                  body: JSON.stringify({
                    "@odata.type":"#microsoft.graph.aadUserConversationMember",
                    "roles":["owner"],
                    "user@odata.bind":`https://graph.microsoft.com/v1.0/users('${p.userId||p.email}')`,
                  }),
                })
              )
            );
            const failed = results.filter(r=>r.status==="rejected"||(r.value&&!r.value.ok));
            if(failed.length){
              setAddPartError(`${failed.length} participant(s) could not be added — they may already be members.`);
            } else {
              setAddPartSuccess(`${addPartPicked.length} participant${addPartPicked.length>1?"s":""} added successfully!`);
              // Update local chat members list
              setSelectedChat(c=>c?({...c, members:[...(c.members||[]),...addPartPicked.map(p=>({displayName:p.name,email:p.email,userId:p.userId}))]}):c);
              setAddPartPicked([]);
              setTimeout(()=>{setShowAddParticipants(false);setAddPartSuccess("");},1800);
            }
          }catch(e){
            setAddPartError("Network error: "+e.message);
          }
        } else {
          // Offline / no MSAL — update locally so UI reflects the change
          setSelectedChat(c=>c?({...c, members:[...(c.members||[]),...addPartPicked.map(p=>({displayName:p.name,email:p.email,userId:p.userId}))]}):c);
          setAddPartSuccess(`${addPartPicked.length} participant${addPartPicked.length>1?"s":""} added!`);
          setAddPartPicked([]);
          setTimeout(()=>{setShowAddParticipants(false);setAddPartSuccess("");},1800);
        }
        setAddPartLoading(false);
      };

      return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget)setShowAddParticipants(false);}}>
          <div className="w-full max-w-md bg-[#1a1a2e] rounded-2xl border border-white/15 shadow-2xl flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white">Add participants</h3>
                <p className="text-xs text-white/40 mt-0.5 truncate max-w-[280px]">
                  {getChatName(selectedChat)}
                </p>
              </div>
              <button onClick={()=>setShowAddParticipants(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
            </div>

            {/* Picked chips */}
            {addPartPicked.length>0&&(
              <div className="px-5 pt-3 flex flex-wrap gap-1.5">
                {addPartPicked.map(p=>(
                  <span key={p.email} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-[#6264A7]/25 border border-[#6264A7]/40 rounded-full text-xs text-white">
                    <div className="w-4 h-4 rounded-full bg-[#6264A7] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {(p.name||p.email).charAt(0).toUpperCase()}
                    </div>
                    {p.name||p.email}
                    <button onClick={()=>togglePick(p)} className="ml-0.5 text-white/50 hover:text-white transition-colors"><X className="w-3 h-3"/></button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-2.5 px-3 py-2 bg-[#252535] border border-white/10 rounded-xl focus-within:border-[#6264A7] transition-colors">
                <Search className="w-4 h-4 text-white/30 flex-shrink-0"/>
                <input autoFocus value={addPartSearch} onChange={e=>setAddPartSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"/>
                {addPartSearch&&<button onClick={()=>setAddPartSearch("")} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5"/></button>}
              </div>
            </div>

            {/* Current members */}
            {!addPartSearch&&(selectedChat.members||[]).length>0&&(
              <div className="px-5 pb-2">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Already in this chat</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedChat.members||[]).map((m,i)=>(
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/8 rounded-full text-xs text-white/50 border border-white/10">
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">
                        {(m.displayName||m.email||"?").charAt(0).toUpperCase()}
                      </div>
                      {m.displayName||m.email||"Unknown"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Results list */}
            <div className="flex-1 overflow-y-auto teams-scrollbar px-2 pb-2">
              {filtered.length===0?(
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="w-8 h-8 text-white/15 mb-2"/>
                  <p className="text-sm text-white/30">{q?"No people match your search":"No contacts available"}</p>
                  {!isMsalConnected&&<p className="text-xs text-white/20 mt-1">Sign in to search your org directory</p>}
                </div>
              ):(
                filtered.map(p=>{
                  const picked = addPartPicked.some(x=>x.email===p.email);
                  return (
                    <button key={p.email} onClick={()=>togglePick(p)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${picked?"bg-[#6264A7]/15 border border-[#6264A7]/30":"hover:bg-white/8 border border-transparent"}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{backgroundColor: p.avatarColor||"#6264A7"}}>
                        {(p.name||p.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{p.name||p.email}</p>
                        {p.name&&<p className="text-xs text-white/40 truncate">{p.email}</p>}
                        {p.jobTitle&&<p className="text-[11px] text-white/30 truncate">{p.jobTitle}</p>}
                      </div>
                      {picked&&<Check className="w-4 h-4 text-[#6264A7] flex-shrink-0"/>}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10 space-y-2">
              {addPartError&&(
                <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                  {addPartError}
                </div>
              )}
              {addPartSuccess&&(
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300">
                  <Check className="w-3.5 h-3.5 flex-shrink-0"/>
                  {addPartSuccess}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30">
                  {addPartPicked.length>0?`${addPartPicked.length} selected`:"Select people to add"}
                </span>
                <div className="flex gap-2">
                  <button onClick={()=>setShowAddParticipants(false)}
                    className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAdd} disabled={!addPartPicked.length||addPartLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${addPartPicked.length&&!addPartLoading?"bg-[#6264A7] hover:bg-[#7375b5] text-white shadow-lg shadow-[#6264A7]/25":"bg-white/10 text-white/30 cursor-not-allowed"}`}>
                    {addPartLoading&&<div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>}
                    Add{addPartPicked.length>1?` ${addPartPicked.length} people`:" to chat"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      );
    })()}

    {/* ══ SCREEN SHARE OVERLAY ══════════════════════════════════ */}
    {isScreenSharing && (
      <div className={`fixed z-[500] shadow-2xl rounded-2xl border border-white/20 bg-[#141424] overflow-hidden transition-all ${screenShareMinimized ? "bottom-6 right-6 w-72 h-auto" : "bottom-6 right-6 w-[480px]"}`}
        style={{boxShadow:"0 0 0 2px #6264A7, 0 25px 60px rgba(0,0,0,0.6)"}}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a2e] border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
            <span className="text-xs font-semibold text-white">Sharing your screen</span>
          </div>
          <div className="flex items-center gap-1">
            <button title={screenShareMinimized ? "Expand" : "Minimize"}
              onClick={()=>setScreenShareMinimized(p=>!p)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              {screenShareMinimized
                ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/></svg>
                : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/></svg>
              }
            </button>
            <button title="Stop sharing" onClick={stopScreenShare}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-300 transition-colors">
              <X className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>

        {/* Video preview */}
        {!screenShareMinimized && (
          <div className="relative bg-black">
            <video ref={el=>{
                screenVideoRef.current=el;
                if(el && screenStreamRef.current) el.srcObject=screenStreamRef.current;
              }}
              autoPlay muted playsInline
              className="w-full max-h-64 object-contain"/>
            <div className="absolute inset-0 pointer-events-none border border-[#6264A7]/30 rounded-b-2xl"/>
          </div>
        )}

        {/* Footer controls */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a2e]">
          <span className="text-[11px] text-white/40">Visible to meeting participants</span>
          <button onClick={stopScreenShare}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs text-white font-semibold transition-colors">
            <X className="w-3 h-3"/>Stop sharing
          </button>
        </div>
      </div>
    )}

    {/* Screen share error toast */}
    {screenShareError && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-5 py-3 bg-red-900/90 border border-red-500/40 rounded-xl shadow-2xl text-sm text-white">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0"/>
        {screenShareError}
        <button onClick={()=>setScreenShareError("")} className="ml-2 text-white/50 hover:text-white"><X className="w-3.5 h-3.5"/></button>
      </div>
    )}

    {/* Copy link toast */}
    {copyLinkToast && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-5 py-3 bg-[#1e1f2e] border border-[#6264A7]/50 rounded-xl shadow-2xl text-sm text-white animate-fade-in">
        <Link2 className="w-4 h-4 text-[#6264A7] flex-shrink-0"/>
        Link copied to clipboard
      </div>
    )}

    {/* ── Call overlay ── */}
    {callModal && (()=>{
      const { type, contact, initials, phase } = callModal;
      const isVideo   = type === "video";
      const connected = phase === "connected";

      if (callMinimized) return (
        <div className="fixed bottom-6 right-6 z-[700] flex items-center gap-3 px-4 py-3 bg-[#1a1b2e] border border-[#6264A7]/60 rounded-2xl shadow-2xl cursor-pointer"
          onClick={()=>setCallMinimized(false)}>
          <div className="w-8 h-8 rounded-full bg-[#6264A7] flex items-center justify-center text-sm font-bold">{initials}</div>
          <div>
            <p className="text-xs font-semibold text-white">{contact}</p>
            <p className="text-[11px] text-green-400">{connected ? fmtCallDur(callDuration) : "Calling…"}</p>
          </div>
          <button onClick={e=>{e.stopPropagation();endCall();}}
            className="ml-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors">
            <PhoneOff className="w-4 h-4 text-white"/>
          </button>
        </div>
      );

      return (
        <div className="fixed inset-0 z-[700] flex flex-col bg-[#0d0e1a]">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-5 py-3 bg-black/30 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              {isVideo ? <Video className="w-4 h-4 text-white/60"/> : <PhoneCall className="w-4 h-4 text-white/60"/>}
              <span className="text-sm font-medium text-white/80">{isVideo ? "Video call" : "Audio call"}</span>
            </div>
            <div className="flex items-center gap-2">
              {connected && <span className="text-sm font-mono text-green-400 tabular-nums">{fmtCallDur(callDuration)}</span>}
              <button onClick={()=>setCallMinimized(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Minimize">
                <ChevronDown className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* ── Main area ── */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">

            {/* Remote side placeholder / audio avatar */}
            {isVideo ? (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0d0e1a] flex flex-col items-center justify-center gap-4">
                <div className={`w-28 h-28 rounded-full bg-[#6264A7] flex items-center justify-center text-4xl font-bold text-white shadow-2xl ${!connected?"animate-pulse":""}`}>
                  {initials}
                </div>
                <p className="text-xl font-semibold text-white">{contact}</p>
                <p className="text-sm text-white/50">
                  {phase==="calling" ? "Calling…" : phase==="ringing" ? "Ringing…" : "Connected"}
                </p>
                {!connected && (
                  <div className="flex gap-1 mt-2">
                    {[0,1,2].map(i=>(
                      <div key={i} className="w-2 h-2 rounded-full bg-[#6264A7]/60 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Audio call — large avatar */
              <div className="flex flex-col items-center gap-6">
                {/* Animated rings when calling */}
                <div className="relative flex items-center justify-center">
                  {!connected && (
                    <>
                      <div className="absolute w-44 h-44 rounded-full border border-[#6264A7]/20 animate-ping"/>
                      <div className="absolute w-36 h-36 rounded-full border border-[#6264A7]/30 animate-ping" style={{animationDelay:"0.4s"}}/>
                    </>
                  )}
                  <div className={`w-28 h-28 rounded-full bg-[#6264A7] flex items-center justify-center text-4xl font-bold text-white shadow-2xl ${!connected?"animate-pulse":""}`}>
                    {initials}
                  </div>
                </div>
                <p className="text-2xl font-semibold text-white">{contact}</p>
                <p className="text-base text-white/50">
                  {phase==="calling" ? "Calling…" : phase==="ringing" ? "Ringing…" : fmtCallDur(callDuration)}
                </p>
              </div>
            )}

            {/* Local video preview (video call, connected) */}
            {isVideo && (
              <div className="absolute bottom-4 right-4 w-40 h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#1a1b2e]">
                {callCamOff ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#2a2b3e]">
                    <VideoOff className="w-6 h-6 text-white/30"/>
                  </div>
                ) : (
                  <video ref={callLocalVideoRef} autoPlay muted playsInline
                    className="w-full h-full object-cover scale-x-[-1]"/>
                )}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded">You</div>
              </div>
            )}
          </div>

          {/* ── Controls bar ── */}
          <div className="flex items-center justify-center gap-4 py-6 bg-black/40 flex-shrink-0">
            {/* Mic */}
            <div className="flex flex-col items-center gap-1.5">
              <button onClick={toggleCallMic}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${callMuted?"bg-red-500/20 border border-red-500/50 text-red-400":"bg-white/10 hover:bg-white/20 text-white"}`}>
                {callMuted ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}
              </button>
              <span className="text-[11px] text-white/40">{callMuted ? "Unmute" : "Mute"}</span>
            </div>

            {/* Camera (video only) */}
            {isVideo && (
              <div className="flex flex-col items-center gap-1.5">
                <button onClick={toggleCallCam}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${callCamOff?"bg-red-500/20 border border-red-500/50 text-red-400":"bg-white/10 hover:bg-white/20 text-white"}`}>
                  {callCamOff ? <VideoOff className="w-5 h-5"/> : <Video className="w-5 h-5"/>}
                </button>
                <span className="text-[11px] text-white/40">{callCamOff ? "Start cam" : "Stop cam"}</span>
              </div>
            )}

            {/* Speaker */}
            <div className="flex flex-col items-center gap-1.5">
              <button onClick={()=>setCallSpeakerOff(p=>!p)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${callSpeakerOff?"bg-red-500/20 border border-red-500/50 text-red-400":"bg-white/10 hover:bg-white/20 text-white"}`}>
                {callSpeakerOff ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
              </button>
              <span className="text-[11px] text-white/40">{callSpeakerOff ? "Unmute spkr" : "Speaker"}</span>
            </div>

            {/* Share screen (video call) */}
            {isVideo && (
              <div className="flex flex-col items-center gap-1.5">
                <button onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isScreenSharing?"bg-[#6264A7]/40 border border-[#6264A7]/60 text-[#c7c9f3]":"bg-white/10 hover:bg-white/20 text-white"}`}>
                  <Share2 className="w-5 h-5"/>
                </button>
                <span className="text-[11px] text-white/40">{isScreenSharing ? "Stop share" : "Share"}</span>
              </div>
            )}

            {/* End call */}
            <div className="flex flex-col items-center gap-1.5">
              <button onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/30">
                <PhoneOff className="w-6 h-6 text-white"/>
              </button>
              <span className="text-[11px] text-white/40">End call</span>
            </div>
          </div>
        </div>
      );
    })()}

    </>
  );
}
