import { Navigate } from "react-router-dom";
import { wipeCredentials } from "../../data/api";
import { useEffect, type ReactElement } from "react";

export const LogoutPage = ({ callback }: { callback?: () => void }): ReactElement => {
  useEffect(() => {
    callback?.();
    wipeCredentials();
  }, [callback]);

  return <Navigate to="/" />;
};
