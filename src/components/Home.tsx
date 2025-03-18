import { useEffect, useState } from "react";
import { Button, Flex, Heading, View } from "@aws-amplify/ui-react";
import { useMsal } from "@azure/msal-react";
import { StorageBrowser } from "../App";

export const Home = () => {
  const { instance, accounts } = useMsal();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (accounts.length > 0) {
      setUserName(accounts[0].name || accounts[0].username || "User");
    }
  }, [accounts]);

  const initializeSignOut = () => {
    instance.logoutRedirect();
  };

  return (
    <View padding="1rem">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom="2rem"
      >
        <Heading level={4}>Hello {userName}!</Heading>
        <Button onClick={initializeSignOut}>Sign out</Button>
      </Flex>
      
      <StorageBrowser />
    </View>
  );
};
