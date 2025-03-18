import { Button } from '@aws-amplify/ui-react';
import { useMsal } from '@azure/msal-react';

export const Login = () => {
  const { instance } = useMsal();

  const initializeSignIn = () => {
    instance.loginRedirect();
  };

  return (
    <>
      <Button onClick={initializeSignIn}>Sign in</Button>
    </>
  );
};
