import type { ReactElement } from "react";
import { MenLink } from "../men-link/men-link";

import "./app-navigation.css";
import { useLocation } from "react-router-dom";

export const AppNavigation = ({ groupName }: { groupName: string }): ReactElement => {
  const location = useLocation();

  const links = [
    { label: "Items", href: "/group/items" },
    { label: "Map", href: "/group/map" },
    { label: "Graphs", href: "/group/graphs" },
    { label: "Panels", href: "/group/panels" },
    { label: "Settings", href: "/group/settings" },
    { label: "Setup", href: "/setup-instructions" },
    { label: "Logout", href: "/logout" },
    { label: "Homepage", href: "/" },
  ].map(({ label, href }) => <MenLink key={label} label={label} href={href} selected={location.pathname === href} />);

  return (
    <div id="app-navigation" className="rsborder-tiny rsbackground">
      <h4 className="app-navigation__group-name">{groupName}</h4>
      <nav className="app-navigation__nav">{links}</nav>
    </div>
  );
};
