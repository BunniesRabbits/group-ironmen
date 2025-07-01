import { useCallback, useContext, useEffect, useState, type ReactElement } from "react";
import Api from "../../api/api";
import { APIContext } from "../../context/api-context";
import { loadValidatedCredentials } from "../../api/credentials";
import { useNavigate } from "react-router-dom";

import "./login-page.css";

export const LoginPage = (): ReactElement => {
  const { logIn: openApi } = useContext(APIContext);
  const [error, setError] = useState<string>();
  const [fetching, setFetching] = useState<boolean>();
  const navigate = useNavigate();

  useEffect(() => {
    const credentials = loadValidatedCredentials();
    if (credentials === undefined) return;

    console.info("Found valid credentials, redirecting...");
    void navigate("/group");
  }, [navigate]);

  const tryLogin = useCallback(
    async (formData: FormData): Promise<void> => {
      const groupName = formData.get("group-name")?.valueOf();
      const groupToken = formData.get("group-token")?.valueOf();
      if (typeof groupName !== "string" || typeof groupToken !== "string" || groupName === "" || groupToken === "") {
        setError("Invalid");
        return;
      }

      setFetching(true);
      setError(undefined);
      const tempApi = new Api({ name: groupName, token: groupToken });
      return tempApi
        .fetchAmILoggedIn()
        .then((response) => {
          if (response.ok) {
            localStorage.setItem("groupName", groupName);
            localStorage.setItem("groupToken", groupToken);
            openApi?.({ name: groupName, token: groupToken });
            void navigate("/group");
            return;
          }

          if (response.status === 401) {
            setError("Name or token is invalid.");
            return;
          }

          throw new Error(`Unexpected status code: ${response.status}`);
        })
        .catch((reason) => {
          setError("Unknown error.");
          console.error("login-page login failed:", reason);
        })
        .finally(() => {
          tempApi.close();
          setFetching(false);
        });
    },
    [setFetching, setError, navigate, openApi],
  );

  return (
    <div className="login-page">
      <form className="login-page-form rsborder rsbackground" action={tryLogin}>
        <label htmlFor="login-group-name">Group name</label>
        <input name="group-name" placeholder="Group name" maxLength={16} />
        <label htmlFor="login-group-token">Group Token</label>
        <input name="group-token" placeholder="Group token" maxLength={60} type="password" />
        <div className="validation-error">{error}</div>
        <button disabled={fetching} id="login-page-submit" className="men-button" type="submit">
          Login
        </button>
      </form>
    </div>
  );
};
