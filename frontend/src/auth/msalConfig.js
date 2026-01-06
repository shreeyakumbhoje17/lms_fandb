export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,
    redirectUri: `${window.location.origin}/auth/callback`,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};
