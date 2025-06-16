import { Navigate } from "react-router-dom";
import { wipeCredentials } from "../../data/api";
import { useEffect, type ReactElement } from "react";

export const LogoutPage = (): ReactElement => {
  useEffect(() => {
    wipeCredentials();
  }, []);

  return <Navigate to="/" />;
};
