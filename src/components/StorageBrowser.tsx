import {
  createManagedAuthAdapter,
  createStorageBrowser,
} from "@aws-amplify/ui-react-storage/browser";
import {
  AWSCredentials,
  fetchBaseCredentials,
} from "../services/fetchBaseCredentials";
import { pcaInstance } from "../MsalConfiguration";

/**
 * Exchanges an Azure AD ID token for temporary AWS credentials
 *
 * This function:
 * 1. Gets the current authenticated user account from Azure
 * 2. Sends the ID token to our backend API Gateway endpoint
 *    which exchanges it for temporary AWS credentials
 * 3. Returns the AWS credentials needed for S3 access
 */
const exchangeIdToken = async (): Promise<AWSCredentials | undefined> => {
  try {
    const currentAccount = pcaInstance.getAllAccounts()[0];
    if (!currentAccount) {
      console.error("No active account");
    }

    const response = await pcaInstance.acquireTokenSilent({
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

export const { StorageBrowser } = createStorageBrowser({
  config: createManagedAuthAdapter({
    credentialsProvider: async () => {
      // return your credentials object
      const credentials = await exchangeIdToken();

      if (!credentials) {
        throw new Error("No AWS credentials found");
      }

      return {
        credentials,
      };
    },
    region: import.meta.env.VITE_AWS_REGION as string,
    accountId: import.meta.env.VITE_AWS_ACCOUNT_ID as string,
    registerAuthListener: () => {},
  }),
});
