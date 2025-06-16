import "./men-homepage.css";
import { storage } from "../../data/storage.ts";
import { MenLink } from "../men-link/men-link.tsx";
import { SocialLinks } from "../social-links/social-links.tsx";
import type { ReactElement } from "react";

export const MenHomepage = (): ReactElement => {
  const group = storage.getGroup();
  const hasLogin = group?.groupName && group.groupToken && group.groupName !== "@EXAMPLE";

  const groupLink = <MenLink label="Go to group" href="/group" />;
  const loginLink = <MenLink label="Login" href="/login" />;

  return (
    <div className="men-homepage">
      <SocialLinks />
      <div className="men-homepage__container">
        <h1>GroupIron.men</h1>
        <div className="men-homepage__links">{hasLogin ? groupLink : loginLink}</div>
      </div>
    </div>
  );
};
