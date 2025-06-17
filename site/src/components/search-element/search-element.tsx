import type { ReactElement } from "react";

import "./search-element.css";

export const SearchElement = ({ className, placeholder }: { className: string; placeholder: string }): ReactElement => {
  return (
    <div className={className}>
      <input className="search-element__input" placeholder={`${placeholder}`} type="text" tabIndex={0} />
    </div>
  );
};
