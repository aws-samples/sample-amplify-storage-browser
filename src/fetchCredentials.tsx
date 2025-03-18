import { AWSTemporaryCredentials } from "@aws-amplify/storage/internals";

const APIGW_URL = import.meta.env.VITE_APIGW_URL

export const fetchBaseCredentials = async (
  token: string
): Promise<AWSTemporaryCredentials | void> => {
  try {
    console.log("idToken", token);
    const response = await fetch(APIGW_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Idtoken": token
        },
      });

      console.log("Response status:", response);
      if (!response.ok) {
        console.error("Error response:", await response.text());
        return;
      }
  

    const data = await response.json();
    console.log("data", await JSON.parse(data));

    const {
      AccessKeyId: accessKeyId,
      SecretAccessKey: secretAccessKey,
      SessionToken: sessionToken,
      Expiration: expiration,
    } = await JSON.parse(data);

    const baseCreds = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      expiration,
    };
    return baseCreds;
  } catch (e) {
    console.error(e);
  }
};
