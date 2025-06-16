import { useState, type ReactElement, type ReactNode } from "react";
import { CanvasMap } from "./components/canvas-map/canvas-map";
import { Navigate } from "react-router-dom";
import { type ApiCredentials, loadValidatedCredentials } from "./data/api";
import { AppNavigation } from "./components/app-navigation/app-navigation";

export const UnauthedLayout = ({
  isMapPage = false,
  children,
}: {
  isMapPage?: boolean;
  children?: ReactNode;
}): ReactElement => {
  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <CanvasMap interactive={isMapPage} />
      </div>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </>
  );
};

export const AuthedLayout = ({
  isMapPage = false,
  children,
}: {
  isMapPage?: boolean;
  children?: ReactNode;
}): ReactElement => {
  const [credentials] = useState<ApiCredentials | undefined>(loadValidatedCredentials());

  if (credentials === undefined) return <Navigate to="/" />;

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <CanvasMap interactive={isMapPage} />
      </div>
      <div style={{ position: "absolute", inset: 0 }}>
        <AppNavigation groupName={credentials?.groupName} />
        {children}
      </div>
    </>
  );
};
