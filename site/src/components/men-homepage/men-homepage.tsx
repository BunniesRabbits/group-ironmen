import { MenLink } from "../men-link/men-link.tsx";
import { SocialLinks } from "../social-links/social-links.tsx";
import type { ReactElement } from "react";
import { loadValidatedCredentials } from "../../api/credentials.ts";

import "./men-homepage.css";

export const MenHomepage = (): ReactElement => {
  const credentials = loadValidatedCredentials();
  const hasLogin = !!credentials;

  const groupLink = <MenLink href="/group">Go to group</MenLink>;
  const loginLink = <MenLink href="/login">Login</MenLink>;

  return (
    <div id="men-homepage">
      <SocialLinks />
      <h1>GroupIron.men</h1>
      <div id="men-homepage-links">
        <MenLink href="/create-group">Get started</MenLink>
        {hasLogin ? groupLink : loginLink}
      </div>
    </div>
  );
};
