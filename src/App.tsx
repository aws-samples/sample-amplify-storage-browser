import { MsalProvider } from '@azure/msal-react';
import { AppRoutes } from './components/AppRoutes';
import { pcaInstance } from './MsalConfiguration';

import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

function App() {
  return (
    <MsalProvider instance={pcaInstance}>
      <AppRoutes />
    </MsalProvider>
  );
}

export default App;
