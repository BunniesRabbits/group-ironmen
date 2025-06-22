import { useState, type ReactElement } from "react";
import { MenLink } from "../men-link/men-link";
import "./setup-instructions.css";
import { loadValidatedCredentials } from "../../data/credentials";

export const SetupInstructions = (): ReactElement => {
  const [tokenVisible, setTokenVisible] = useState(false);
  const credentials = loadValidatedCredentials();
  return (
    <div id="setup-instructions-container">
      <div id="setup-instructions" className="rsbackground rsborder">
        <div className="setup-block">
          <h3>The group's login</h3>
          <p>Only share these with your group. You can't recover it so keep it safe!</p>
          <div className="setup-block">
            <h4>Group Name</h4>
            <div className="setup-credential rsborder-tiny rsbackground">{credentials?.name ?? "NULL"}</div>
          </div>

          <div className="setup-block">
            <h4>Group Token</h4>
            <div className="setup-credential rsborder-tiny rsbackground">
              {tokenVisible ? (
                (credentials?.token ?? "00000000-0000-0000-0000-000000000000")
              ) : (
                <>
                  <div
                    id="setup-credential-hide"
                    onClick={() => {
                      setTokenVisible(true);
                    }}
                  >
                    Click to show
                  </div>
                  {"00000000-0000-0000-0000-000000000000"}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="setup-block">
          <h3>Setup</h3>
          <p>
            This app requires each group member to install a runelite plugin from the Plugin Hub in order to track
            player information. Find it by searching "<span className="emphasize">Group Ironmen Tracker</span>" in the
            Runelite client.
          </p>
        </div>

        <div id="setup-config">
          <p>
            Use the provided credentials to fill in the <span className="emphasize">Group Config</span> section in the
            plugin's configuration.
          </p>
          <img alt="Group Ironmen Tracker Runelite Plugin Config Panel" src="/images/config_panel.png" />
        </div>

        <div id="setup-go-to-group">
          <MenLink label="Go to group" href="/group" />
        </div>
      </div>
    </div>
  );
};
