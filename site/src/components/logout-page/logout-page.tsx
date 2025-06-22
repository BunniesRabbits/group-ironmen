import { Navigate } from "react-router-dom";
import { useEffect, type ReactElement } from "react";
import { wipeCredentials } from "../../data/credentials";

export const LogoutPage = ({ callback }: { callback?: () => void }): ReactElement => {
  useEffect(() => {
    callback?.();
    wipeCredentials();
  }, [callback]);

  return <Navigate to="/" />;
};
