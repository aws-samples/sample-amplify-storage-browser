import {
  createManagedAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import { authService } from '../MsalConfiguration';

/**
 * Creates a Storage Browser component that uses Azure AD (Entra ID) authentication
 * and AWS IAM Access Grants for authorization.
 *
 * The component uses the EntraAuthService to:
 * 1. Manage authentication state with Azure AD
 * 2. Exchange Azure AD tokens for temporary AWS credentials
 * 3. Listen for authentication events to refresh credentials when needed
 */
export const { StorageBrowser } = createStorageBrowser({
  config: createManagedAuthAdapter({
    credentialsProvider: async () => {
      // Get AWS credentials using our auth service
      const credentials = await authService.getAwsCredentials();

      return {
        credentials,
      };
    },
    region: import.meta.env.VITE_AWS_REGION as string,
    accountId: import.meta.env.VITE_AWS_ACCOUNT_ID as string,
    // callback to be called from the consumer on auth status changes to clear in-memory credentials
    registerAuthListener: (onAuthStateChange) => {
      return authService.registerAuthListener(onAuthStateChange);
    },
  }),
});
