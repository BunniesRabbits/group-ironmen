import { useRef, useState, type ReactElement } from "react";

import "./tooltip.css";
import { createPortal } from "react-dom";

export interface ItemTooltipProps {
  name: string;
  quantity: number;
  highalch: number;
}

export const useItemTooltip = (): {
  tooltipElement: ReactElement;
  hideTooltip: () => void;
  showTooltip: (item: ItemTooltipProps) => void;
} => {
  const [item, setTooltipItem] = useState<ItemTooltipProps>();
  const tooltipRef = useRef<HTMLDivElement>(document.body.querySelector<HTMLDivElement>("div#tooltip")!);

  const hideTooltip = (): void => {
    setTooltipItem(undefined);
    tooltipRef.current.style.visibility = "hidden";
  };
  const showTooltip = (item: ItemTooltipProps): void => {
    setTooltipItem(item);
    tooltipRef.current.style.visibility = "visible";
  };

  const tooltipElement = createPortal(
    item ? (
      <div>
        {item?.name ?? ""} x {item?.quantity}
        <br />
        HA: {item?.highalch}
      </div>
    ) : (
      <></>
    ),
    tooltipRef.current,
  );

  return { tooltipElement, hideTooltip, showTooltip };
};
