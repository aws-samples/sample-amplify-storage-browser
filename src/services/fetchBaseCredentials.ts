const APIGW_URL = import.meta.env.VITE_APIGW_URL;

export type AWSCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
};

/**
 * Fetches AWS temporary credentials using the provided token
 * @param token The ID token from Azure AD
 * @returns AWS temporary credentials or undefined if an error occurs
 */
export async function fetchBaseCredentials(token: string): Promise<AWSCredentials> {
  try {
    console.debug('Fetching AWS credentials');

    const response = await fetch(APIGW_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Idtoken': token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const rawData = await response.json();
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    console.debug('Successfully fetched AWS credentials');

    return {
      accessKeyId: data.AccessKeyId,
      secretAccessKey: data.SecretAccessKey,
      sessionToken: data.SessionToken,
      expiration: data.Expiration,
    };
  } catch (error) {
    console.error('Failed to fetch AWS credentials', error);
    throw error;
  }
}
