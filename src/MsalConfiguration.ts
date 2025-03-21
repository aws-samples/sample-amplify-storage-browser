import { Configuration, PublicClientApplication } from '@azure/msal-browser';
import { AuthService } from './services/AuthService';

// MSAL configuration
const configuration: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI,
  },
};

export const pcaInstance = new PublicClientApplication(configuration);
export const authService = new AuthService(pcaInstance);
