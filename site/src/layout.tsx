import type { ReactElement, ReactNode } from "react";
import { CanvasMap } from "./components/canvas-map/canvas-map";
import { useNavigate } from "react-router-dom";
import { loadValidatedCredentials } from "./data/api";

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
  const navigate = useNavigate();
  const credentials = loadValidatedCredentials();

  if (credentials === undefined) {
    console.info("Invalid credentials, redirecting...");
    void navigate("/");
  }

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <CanvasMap interactive={isMapPage} />
      </div>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </>
  );
};
