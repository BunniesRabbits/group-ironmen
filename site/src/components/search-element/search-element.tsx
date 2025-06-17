import type { ReactElement } from "react";

import "./search-element.css";

export const SearchElement = ({
  id,
  placeholder,
  onChange,
}: {
  id: string;
  placeholder: string;
  onChange: (value: string) => void;
}): ReactElement => {
  return (
    <div id={id}>
      <input
        className="search-element-input"
        placeholder={`${placeholder}`}
        type="text"
        tabIndex={0}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
