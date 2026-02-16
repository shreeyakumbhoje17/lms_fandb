// src/msalConfig.js

import { PublicClientApplication } from "@azure/msal-browser";

/**
 * MSAL configuration
 * Frontend ONLY requests a token for the Django backend API.
 * No Microsoft Graph scopes here.
 */
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: `${window.location.origin}/auth/callback`,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

/**
 * Scope exposed by the Django backend app registration
 * (Entra → Expose an API → access_as_user)
 */
export const loginRequest = {
  scopes: [
    "api://f3547bc1-cd60-4650-82f0-9aa4220f68b8/access_as_user",
  ],
};

/**
 * MSAL instance used across the app
 */
export const msalInstance = new PublicClientApplication(msalConfig);
