import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { Home } from './Home';
import { Login } from './Login';

export const AppRoutes = () => {
  return (
    <>
      <AuthenticatedTemplate>
        <Home />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </>
  );
};
