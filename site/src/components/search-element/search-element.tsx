import type { ReactElement } from "react";

import "./search-element.css";

export const SearchElement = ({
  className,
  placeholder,
  onChange,
}: {
  className: string;
  placeholder: string;
  onChange: (value: string) => void;
}): ReactElement => {
  return (
    <div className={className}>
      <input
        className="search-element__input"
        placeholder={`${placeholder}`}
        type="text"
        tabIndex={0}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
