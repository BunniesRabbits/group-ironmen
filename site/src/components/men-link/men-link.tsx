import type { ReactElement } from "react";
import "./men-link.css";
import { Link } from "react-router";

export interface MenLinkProps {
  label: string;
  href: string;
  selected: boolean;
}
export const MenLink = (props: MenLinkProps): ReactElement => {
  return (
    <Link className={`men-link men-button ${props.selected ? "active" : ""}`} to={props.href}>
      {props.label}
    </Link>
  );
};
