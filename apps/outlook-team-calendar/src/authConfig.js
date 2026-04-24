// Azure AD app registration settings
// Replace these values with your own Azure AD app registration
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID || "YOUR_CLIENT_ID",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || "YOUR_TENANT_ID"}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [
    "User.Read",
    "User.ReadBasic.All",
    "Calendars.Read",
    "Calendars.Read.Shared",
  ],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphUsersEndpoint: "https://graph.microsoft.com/v1.0/users",
};
