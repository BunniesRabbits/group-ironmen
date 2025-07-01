import { type ReactElement, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppNavigation } from "./components/app-navigation/app-navigation";
import { loadValidatedCredentials } from "./api/credentials";

export const UnauthedLayout = ({ children }: { children?: ReactNode }): ReactElement => {
  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </>
  );
};

export const AuthedLayout = ({
  children,
  panels,
}: {
  children?: ReactNode;
  panels: ReactElement[] | undefined;
}): ReactElement => {
  const credentials = loadValidatedCredentials();

  if (credentials === undefined) return <Navigate to="/" />;

  const sidePanels = panels !== undefined ? <div id="side-panels-container">{panels}</div> : undefined;

  return (
    <>
      <div id="overlay" className="pointer-passthrough">
        {sidePanels}
        <div id="main-content" className="pointer-passthrough">
          <AppNavigation groupName={credentials?.name} />
          {children}
        </div>
      </div>
    </>
  );
};
