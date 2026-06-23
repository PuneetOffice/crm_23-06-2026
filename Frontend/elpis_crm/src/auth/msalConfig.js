import { LogLevel } from "@azure/msal-browser";

export const msalConfig = {
    auth: {
        clientId: "09c6e327-ea8d-4f3a-af74-ec50c811aa11",
        authority: "https://login.microsoftonline.com/8af9fa31-43ac-4f5b-8f45-3a70ad6da760",
        redirectUri: (process.env.REACT_APP_MSAL_REDIRECT_URI || (window.location.origin + "/Dashboard/OutlookEmail")),
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
    system: {
        // Suppress verbose MSAL logs; warn+ only
        loggerOptions: {
            logLevel: LogLevel.Warning,
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                if (level === LogLevel.Error) console.error("[MSAL]", message);
                else if (level === LogLevel.Warning) console.warn("[MSAL]", message);
            },
        },
        // Prevent MSAL from making token requests via hidden iframes
        // which can cause spurious 400s when the session has already expired
        allowNativeBroker: false,
        windowHashTimeout: 9000,
        iframeHashTimeout: 9000,
    }
};

/**
 * Clear all MSAL-related entries from sessionStorage.
 * Call this when the user sees repeated 400 errors — it forces a fresh login.
 */
export function clearMsalCache() {
    try {
        Object.keys(sessionStorage)
            .filter(k => k.startsWith("msal.") || k.includes("login.windows") || k.includes("login.microsoftonline"))
            .forEach(k => sessionStorage.removeItem(k));
        Object.keys(localStorage)
            .filter(k => k.startsWith("msal.") || k.includes("login.windows") || k.includes("login.microsoftonline"))
            .forEach(k => localStorage.removeItem(k));
    } catch {}
}

export const loginRequest = {
    scopes: [
        // User identity
        "https://graph.microsoft.com/User.Read",
        "https://graph.microsoft.com/User.ReadBasic.All",

        // Mail
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",

        // Chat (delegated)
        "https://graph.microsoft.com/Chat.ReadWrite",
        "https://graph.microsoft.com/ChatMessage.Send",

        // Teams & channels — only delegated permissions (no .All application-only scopes)
        "https://graph.microsoft.com/Team.ReadBasic.All",
        "https://graph.microsoft.com/Channel.ReadBasic.All",
        "https://graph.microsoft.com/ChannelSettings.Read.All",
        "https://graph.microsoft.com/ChannelSettings.ReadWrite.All",
        "https://graph.microsoft.com/ChannelMessage.Send",

        // Meetings
        "https://graph.microsoft.com/OnlineMeetings.Read",
        "https://graph.microsoft.com/OnlineMeetings.ReadWrite",

        // Presence & calendar
        "https://graph.microsoft.com/Presence.Read",
        "https://graph.microsoft.com/Calendars.ReadWrite",

        // Files / SharePoint
        "https://graph.microsoft.com/Files.Read",
        "https://graph.microsoft.com/Files.ReadWrite",
        "https://graph.microsoft.com/Sites.Read.All",

        // People & contacts
        "https://graph.microsoft.com/People.Read",
        "https://graph.microsoft.com/Contacts.Read",
    ]
};
