import { useCallback, useEffect, useState, type ReactElement } from "react";

import "./login-page.css";
import Api from "../../api/api";
import { useNavigate } from "react-router-dom";
import { loadValidatedCredentials } from "../../api/credentials";

export const LoginPage = (): ReactElement => {
  const [error, setError] = useState<string>();
  const [fetching, setFetching] = useState<boolean>();
  const navigate = useNavigate();

  useEffect(() => {
    const credentials = loadValidatedCredentials();
    if (credentials === undefined) return;

    console.info("Found valid credentials, redirecting...");
    void navigate("/group");
  }, [navigate]);

  const action = useCallback(
    async (formData: FormData): Promise<void> => {
      const groupName = formData.get("group-name")?.valueOf();
      const groupToken = formData.get("group-token")?.valueOf();
      if (typeof groupName !== "string" || typeof groupToken !== "string" || groupName === "" || groupToken === "") {
        setError("Invalid");
        return;
      }

      setFetching(true);
      setError(undefined);
      return new Api({ name: groupName, token: groupToken })
        .fetchAmILoggedIn()
        .then((response) => {
          if (response.ok) {
            localStorage.setItem("groupName", groupName);
            localStorage.setItem("groupToken", groupToken);
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
          setFetching(false);
        });
    },
    [setFetching, setError, navigate],
  );

  return (
    <div className="login-page">
      <form className="login-page-form rsborder rsbackground" action={action}>
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
