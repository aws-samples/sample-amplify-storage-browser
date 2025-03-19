import {
    createManagedAuthAdapter,
    createStorageBrowser,
  } from "@aws-amplify/ui-react-storage/browser";
import { AWSCredentials, fetchBaseCredentials } from "../services/fetchBaseCredentials";
import { pcaInstance } from "../MsalConfiguration";

const exchangeIdToken = async (): Promise<AWSCredentials | undefined> => {
  try {
    const currentAccount = pcaInstance.getAllAccounts()[0];
    if (!currentAccount) {
      console.error("No active account");
      return undefined;
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
      const creds = await exchangeIdToken()

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