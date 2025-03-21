import { PublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { AWSCredentials, fetchBaseCredentials } from './fetchBaseCredentials';

export type AuthEventListener = () => void;

export class AuthService {
  private pcaInstance: PublicClientApplication;
  private onStateChange: () => void | undefined = () => {};

  constructor(pcaInstance: PublicClientApplication) {
    this.pcaInstance = pcaInstance;
  }

  /**
   * Gets the current authenticated user account
   */
  getCurrentAccount(): AccountInfo | undefined {
    const accounts = this.pcaInstance.getAllAccounts();
    return accounts.length > 0 ? accounts[0] : undefined;
  }

  /**
   * Acquires a fresh ID token and exchanges it for AWS credentials
   */
  async getAwsCredentials(): Promise<AWSCredentials> {
    try {
      const currentAccount = this.getCurrentAccount();
      if (!currentAccount) {
        throw new Error('No active account');
      }

      const response = await this.pcaInstance.acquireTokenSilent({
        account: currentAccount,
        scopes: ['User.Read'],
        forceRefresh: true,
      });

      const credentials = await fetchBaseCredentials(response.idToken);
      if (!credentials) {
        throw new Error('Failed to obtain AWS credentials');
      }

      return credentials;
    } catch (error) {
      console.error('Error getting AWS credentials:', error);
      throw error;
    }
  }

  /**
   * Registers authentication event listeners
   */
  registerAuthListener = (onStateChange: () => void) => {
    this.onStateChange = onStateChange;
  };

  /**
   * Initiates the login process
   */
  async login(): Promise<void> {
    try {
      await this.pcaInstance.loginPopup({
        scopes: ['User.Read'],
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logs the user out
   */
  async logout(): Promise<void> {
    try {
      const account = this.getCurrentAccount();
      if (account) {
        await this.pcaInstance.logoutPopup({
          account,
        });
        this.onStateChange();
      }
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }
}
