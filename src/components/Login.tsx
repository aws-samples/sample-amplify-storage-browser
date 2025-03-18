import { Button, Card, Flex, Heading, Text } from '@aws-amplify/ui-react';
import { useMsal } from '@azure/msal-react';
import { useState } from 'react';

export const Login = () => {
  const { instance } = useMsal();
  const [error, setError] = useState<Error | null>(null);

  const initializeSignIn = () => {
    try {
      instance.loginRedirect().catch(err => {
        setError(new Error(err.message || 'Failed to sign in'));
      });
    } catch (err) {
      setError(new Error('An unexpected error occurred during sign in'));
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
