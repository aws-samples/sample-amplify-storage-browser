import {
  SSOOIDCClient,
  CreateTokenWithIAMCommand,
} from "@aws-sdk/client-sso-oidc";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import * as jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

// Define proper interfaces for better type safety
interface TokenExchangeEvent {
  idToken?: string;
  path?: string;
  httpMethod?: string;
}

interface ErrorResponse {
  statusCode: number;
  body: string;
}

interface JwtHeader {
  kid?: string;
  alg?: string;
  [key: string]: unknown;
}

// Environment variables
const idcAppArn = process.env.IDP_APP_ARN;
const identityBearerRoleArn = process.env.IDENTITY_BEARER_ROLE_ARN;
const region = process.env.REGION;
const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const jwksUri = process.env.TTI_JWKS_URI; // 3rd party IDP's JWKS endpoint to validate the incoming idToken against

if (!idcAppArn || !identityBearerRoleArn || !region || !jwksUri) {
  throw new Error("Missing necessary environment variables.");
}

/**
 * Helper function to retrieve the signing key
 */
const getSigningKey = async (kid: string): Promise<string> => {
  const client = jwksClient({ jwksUri });
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
};

/**
 * Helper function to verify JWT
 */
const verifyJwt = async (token: string): Promise<jwt.JwtPayload> => {
  const decoded = jwt.decode(token, { complete: true });
  const decodedHeader = decoded?.header as JwtHeader | undefined;
  
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

export const handler = async (event: TokenExchangeEvent): Promise<string | ErrorResponse> => {
  // Generate a simple request ID for tracing
  const requestId = `req-${Date.now().toString(36)}`;
  
  try {
    console.log(`[${requestId}] Processing token exchange request`);
    
    // Validate and verify idToken from input
    const idpIdToken = event.idToken;
    if (!idpIdToken) {
      throw new Error("Missing idToken in request");
    }
    
    console.log(`[${requestId}] Verifying JWT token`);
    await verifyJwt(idpIdToken);
    console.log(`[${requestId}] JWT verification successful`);

    // Step 1: Exchange external IDP idToken for IAM IDC idToken
    console.log(`[${requestId}] Exchanging external IDP token for IAM IDC token`);
    const ssoClient = new SSOOIDCClient({});
    const tokenResponse = await ssoClient.send(
      new CreateTokenWithIAMCommand({
        clientId: idcAppArn,
        grantType,
        assertion: idpIdToken,
      })
    );
    
    const idcIdToken = tokenResponse.idToken;
    if (!idcIdToken) {
      throw new Error("Failed to retrieve IDC idToken");
    }
    
    console.log(`[${requestId}] IAM IDC token exchange successful`);
    const decodedIdcIdToken = jwt.decode(idcIdToken) as jwt.JwtPayload;

    // Step 2: Use IAM IDC idToken to assume identityBearerRoleArn with specific context
    console.log(`[${requestId}] Assuming identity bearer role`);
    
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
      throw new Error("Failed to assume role with provided context");
    }

    console.log(`[${requestId}] Successfully generated temporary credentials`);
    
    return JSON.stringify(roleResponse.Credentials);
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Error: ${errorMessage}`);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        requestId,
        message: "Error processing request",
        details: errorMessage,
      }),
    };
  }
};
