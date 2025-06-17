import { useState, type ReactElement, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { type ApiCredentials, loadValidatedCredentials } from "./data/api";
import { AppNavigation } from "./components/app-navigation/app-navigation";

export const UnauthedLayout = ({ children }: { children?: ReactNode }): ReactElement => {
  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </>
  );
};

export const AuthedLayout = ({ children }: { children?: ReactNode }): ReactElement => {
  const [credentials] = useState<ApiCredentials | undefined>(loadValidatedCredentials());

  if (credentials === undefined) return <Navigate to="/" />;

  return (
    <>
      <div id="main-content">
        <AppNavigation groupName={credentials?.groupName} />
        {children}
      </div>
    </>
  );
};
