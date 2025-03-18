import {
  createManagedAuthAdapter,
  createStorageBrowser,
} from "@aws-amplify/ui-react-storage/browser";
import "@aws-amplify/ui-react-storage/styles.css";
import "./App.css";

import {
  AuthenticatedTemplate,
  MsalProvider,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { Configuration, PublicClientApplication } from "@azure/msal-browser";
import { Home } from "./components/Home";
import { Login } from "./components/Login";
import { AWSTemporaryCredentials } from "@aws-amplify/storage/internals";
import { fetchBaseCredentials } from "./services/fetchBaseCredentials";

// MSAL configuration
const configuration: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID as string,
    authority:
      `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI,
  },
};

const pca = new PublicClientApplication(configuration);

export const { StorageBrowser } = createStorageBrowser({
  config: createManagedAuthAdapter({
    credentialsProvider: async () => {
      // return your credentials object
      const creds = await refreshIDToken()

      if(!creds){
        throw new Error("No AWS credentials found")
      }

      return {
        credentials: creds,
      };
    },
    region: import.meta.env.VITE_AWS_REGION as string,
    accountId: import.meta.env.VITE_AWS_ACCOUNT_ID as string,
    registerAuthListener: () => {},
  }),
});

const refreshIDToken = async (): Promise<AWSTemporaryCredentials | undefined> => {
  try {
    const currentAccount = pca.getAllAccounts()[0];
    if (!currentAccount) {
      console.error("No active account");
      return undefined;
    }
    
    const response = await pca.acquireTokenSilent({
      account: currentAccount,
      scopes: ["User.Read"],
      forceRefresh: true,
    });

    return await fetchBaseCredentials(response.idToken);
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
};

function App() {
  return (
    <MsalProvider instance={pca}>
      <AuthenticatedTemplate>
        <Home />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </MsalProvider>
  );
}

export default App;
