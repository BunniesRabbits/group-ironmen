import "./men-homepage.css";
import { MenLink } from "../men-link/men-link.tsx";
import { SocialLinks } from "../social-links/social-links.tsx";
import type { ReactElement } from "react";
import { loadValidatedCredentials } from "../../api/credentials.ts";

export const MenHomepage = (): ReactElement => {
  const credentials = loadValidatedCredentials();
  const hasLogin = !!credentials;

  const groupLink = <MenLink label="Go to group" href="/group" />;
  const loginLink = <MenLink label="Login" href="/login" />;

  return (
    <div id="men-homepage">
      <SocialLinks />
      <div id="men-homepage-container">
        <h1>GroupIron.men</h1>
        <div id="men-homepage-links">
          <MenLink label="Get started" href="/create-group" />
          {hasLogin ? groupLink : loginLink}
        </div>
      </div>
    </div>
  );
};
