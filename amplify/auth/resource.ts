import { referenceAuth } from '@aws-amplify/backend';

/**
 * Reference existing Cognito User Pool and Identity Pool
 * These values will be provided as environment variables by the aa-stack CloudFormation template
 */
export const auth = referenceAuth({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  userPoolClientId: process.env.COGNITO_USER_POOL_CLIENT_ID!,
  identityPoolId: process.env.COGNITO_IDENTITY_POOL_ID!,
  authRoleArn: process.env.COGNITO_AUTH_ROLE_ARN!,
  unauthRoleArn: process.env.COGNITO_UNAUTH_ROLE_ARN!,
});
