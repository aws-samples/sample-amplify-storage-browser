import { useEffect, useState } from 'react';
import { Button, Flex, Heading, View } from '@aws-amplify/ui-react';
import { StorageBrowser } from './StorageBrowser';
import { authService } from '../MsalConfiguration';

export const Home = () => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const currentAccount = authService.getCurrentAccount();
    if (currentAccount) {
      setUserName(currentAccount.name || currentAccount.username || 'User');
    }
  }, []);

  const initializeSignOut = async () => {
    await authService.logout();
  };

  return (
    <View padding="1rem">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="2rem">
        <Heading level={4}>Hello {userName}!</Heading>
        <Button onClick={initializeSignOut}>Sign out</Button>
      </Flex>

      <StorageBrowser />
    </View>
  );
};
