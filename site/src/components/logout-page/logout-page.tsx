import { Navigate } from "react-router-dom";
import { useContext, useEffect, type ReactElement } from "react";
import { wipeCredentials } from "../../api/credentials";
import { APIContext } from "../../context/api-context";

export const LogoutPage = (): ReactElement => {
  const { logOut } = useContext(APIContext);

  useEffect(() => {
    logOut?.();
    wipeCredentials();
  }, [logOut]);

  return <Navigate to="/" />;
};
