import type { ReactElement } from "react";

export const SearchElement = ({ className, placeholder }: { className: string; placeholder: string }): ReactElement => {
  return (
    <div className={className}>
      <input className="search-element__input" placeholder={`${placeholder}`} type="text" tabIndex={0} />
    </div>
  );
};
