import { Fragment, useContext, type ReactElement } from "react";
import * as SiteSettings from "../../context/settings-context";

import "./settings.css";

/**
 * A component that contains fields for tweaking site settings such as sidebar position, and group settings like member names.
 */

const labels: Record<SiteSettings.SiteTheme | SiteSettings.SidebarPosition, string> = {
  light: "Light",
  dark: "Dark",
  left: "Dock panels to the left",
  right: "Dock panels to the right",
};

export const SettingsPage = (): ReactElement => {
  const { siteTheme, setSiteTheme, sidebarPosition, setSidebarPosition } = useContext(SiteSettings.Context);

  return (
    <div id="group-settings-container" className="rsborder rsbackground">
      <h3>Member settings</h3>
      <p>
        These <span className="emphasize">do</span> need to match the in-game names.
      </p>

      <h3>Appearance settings</h3>
      <fieldset
        className="group-settings__panels"
        onChange={(e) => {
          const selected = (e.target as Partial<HTMLInputElement>).value;
          const position = SiteSettings.SidebarPosition.find((position) => position === selected);
          if (!position) return;

          setSidebarPosition?.(position);
        }}
      >
        <legend>Player Panels</legend>
        {SiteSettings.SidebarPosition.map((position) => {
          return (
            <Fragment key={position}>
              <input
                id={`panel-dock-${position}`}
                value={position}
                type="radio"
                name="panel-dock-side"
                readOnly
                checked={sidebarPosition === position}
              />
              <label htmlFor={`panel-dock-${position}`}>{labels[position]}</label>
            </Fragment>
          );
        })}
      </fieldset>

      <fieldset
        className="group-settings__style"
        onChange={(e) => {
          const selected = (e.target as Partial<HTMLInputElement>).value;
          const theme = SiteSettings.SiteTheme.find((theme) => theme === selected);
          if (!theme) return;

          setSiteTheme?.(theme);
        }}
      >
        <legend>Style</legend>
        {SiteSettings.SiteTheme.map((theme) => {
          const id = `style-${theme}`;
          return (
            <Fragment key={theme}>
              <input
                id={id}
                readOnly
                value={theme}
                type="radio"
                name="appearance-style"
                checked={siteTheme === theme}
              />
              <label htmlFor={id}>{labels[theme]}</label>
            </Fragment>
          );
        })}
      </fieldset>
    </div>
  );
};
