import type { ReactElement } from "react";
import { MenLink } from "../men-link/men-link";

import "./app-navigation.css";

export const AppNavigation = ({ groupName }: { groupName: string }): ReactElement => {
  return (
    <div id="app-navigation" className="rsborder-tiny rsbackground">
      <h4 className="app-navigation__group-name">{groupName}</h4>
      <nav className="app-navigation__nav">
        <MenLink label="Items" href="/group/items" />
        <MenLink label="Map" href="/group/map" />
        <MenLink label="Graphs" href="/group/graphs" />
        <MenLink label="Panels" href="/group/panels" />
        <MenLink label="Settings" href="/group/settings" />
        <MenLink label="Setup" href="/setup-instructions" />
        <MenLink label="Logout" href="/logout" />
        <MenLink label="Homepage" href="/" />
      </nav>
    </div>
  );
};
