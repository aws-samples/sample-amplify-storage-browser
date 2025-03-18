import { useMsal } from "@azure/msal-react";
import { StorageBrowser } from "../App";
import { Button, Flex, Heading } from "@aws-amplify/ui-react";

export const Home = () => {
  const { instance, accounts } = useMsal();
  const { name } = accounts[0];

  const initializeSignOut = () => {
    instance.logoutRedirect();
  };

  return (
    <>
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        alignContent="flex-start"
        wrap="nowrap"
        gap="1rem"
      >
        <Heading level={4}>Hello {name}!</Heading>
        <Button onClick={initializeSignOut}>Sign out</Button>
      </Flex>
      <StorageBrowser />
    </>
  );
};
