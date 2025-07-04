import { type ReactElement, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppNavigation } from "./components/app-navigation/app-navigation";
import { loadValidatedCredentials } from "./api/credentials";
import { useGroupListMembersContext } from "./context/group-state-context";
import { PlayerPanel } from "./components/player-panel/player-panel";

export const UnauthedLayout = ({ children }: { children?: ReactNode }): ReactElement => {
  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </>
  );
};

export const AuthedLayout = ({ children, showPanels }: { children?: ReactNode; showPanels: boolean }): ReactElement => {
  const credentials = loadValidatedCredentials();
  const groupMembers = useGroupListMembersContext();

  if (credentials === undefined) return <Navigate to="/" />;

  let sidePanels = undefined;
  if (showPanels && groupMembers.length > 0) {
    sidePanels = (
      <div id="side-panels-container">
        {groupMembers
          .filter((member) => member !== "@SHARED")
          .map<ReactElement>((member) => (
            <PlayerPanel key={member} member={member} />
          ))}
      </div>
    );
  }

  return (
    <>
      {sidePanels}
      <div id="main-content" className="pointer-passthrough">
        <AppNavigation groupName={credentials?.name} />
        {children}
      </div>
    </>
  );
};
