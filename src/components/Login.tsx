import { Button, Card, Flex, Heading, Text } from '@aws-amplify/ui-react';
import { useState } from 'react';
import { authService } from '../MsalConfiguration';

export const Login = () => {
  const [error, setError] = useState<Error | null>(null);

  const initializeSignIn = async () => {
    try {
      await authService.login();
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error('An unexpected error occurred during sign in'));
      }
    }
  };

  return (
    <Flex justifyContent="center" alignItems="center" height="100vh">
      <Card variation="elevated" padding="2rem">
        <Heading level={3} textAlign="center" marginBottom="1rem">
          Sign in to access S3 buckets
        </Heading>

        {error && (
          <Text color="red" marginBottom="1rem">
            {error.message}
          </Text>
        )}

        <Button onClick={initializeSignIn} variation="primary" size="large" width="100%">
          Sign in with Entra
        </Button>
      </Card>
    </Flex>
  );
};
