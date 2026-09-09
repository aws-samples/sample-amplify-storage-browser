import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Array order defines Cognito group precedence. `uploaders` must win for
  // users that also belong to a more privileged group.
  groups: ['uploaders', 'admin', 'eliminadores'],
});
