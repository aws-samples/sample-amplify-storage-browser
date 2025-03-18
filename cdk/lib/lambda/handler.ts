import {
  SSOOIDCClient,
  CreateTokenWithIAMCommand,
} from "@aws-sdk/client-sso-oidc";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import * as jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

// Environment variables
const idcAppArn = process.env.IDP_APP_ARN;
const identityBearerRoleArn = process.env.IDENTITY_BEARER_ROLE_ARN;
const region = process.env.REGION;
const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const jwksUri = process.env.TTI_JWKS_URI; // 3rd party IDP's JWKS endpoint to validate the incoming idToken against

if (!idcAppArn || !identityBearerRoleArn || !region || !jwksUri) {
  throw new Error("Missing necessary environment variables.");
}

// Helper function to retrieve the signing key
const getSigningKey = async (kid: string): Promise<string> => {
  const client = jwksClient({
    jwksUri,
  });
  const key = await client.getSigningKey(kid);
  console.log("getSigningKey success");
  return key.getPublicKey();
};

// Helper function to verify JWT
const verifyJwt = async (token: string): Promise<jwt.JwtPayload> => {
  const decodedHeader = jwt.decode(token, { complete: true })?.header;
  if (!decodedHeader || !decodedHeader.kid) {
    throw new Error("Invalid token header; missing 'kid' field.");
  }

  const signingKey = await getSigningKey(decodedHeader.kid);
  return new Promise((resolve, reject) => {
    jwt.verify(token, signingKey, {}, (err, decoded) => {
      if (err) return reject(new Error("Invalid token"));
      resolve(decoded as jwt.JwtPayload);
    });
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  try {
    // validate and verify idToken from input
    const idpIdToken = event.idToken;
    if (!idpIdToken) {
      throw new Error("Missing idToken.");
    }
    await verifyJwt(idpIdToken);
    console.log("verifyJwt success");

    // Step 1: Exchange external IDP idToken for IAM IDC idToken
    const ssoClient = new SSOOIDCClient({});
    const idcIdToken = (
      await ssoClient.send(
        new CreateTokenWithIAMCommand({
          clientId: idcAppArn,
          grantType,
          assertion: idpIdToken,
        })
      )
    ).idToken;

    if (!idcIdToken) {
      throw new Error("Failed to retrieve IDC idToken.");
    } else {
      console.log("idcIdtoken exchange success");
    }
    const decodedIdcIdToken = jwt.decode(idcIdToken) as jwt.JwtPayload;

    // Step 2: Use IAM IDC idToken to assume identityBearerRoleArn with specific context
    const stsClient = new STSClient({ region });
    const roleResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: identityBearerRoleArn,
        RoleSessionName: "IdentityBearerRoleSession",
        DurationSeconds: 900,
        ProvidedContexts: [
          {
            ProviderArn: "arn:aws:iam::aws:contextProvider/IdentityCenter",
            ContextAssertion: decodedIdcIdToken["sts:identity_context"],
          },
        ],
      })
    );

    if (!roleResponse.Credentials) {
      throw new Error("Failed to assume role with provided context.");
    }

    return JSON.stringify(roleResponse.Credentials);
  } catch (error) {
    console.error("Error in Lambda handler:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error processing request",
        details: (error as Error).message,
      }),
    };
  }
};
