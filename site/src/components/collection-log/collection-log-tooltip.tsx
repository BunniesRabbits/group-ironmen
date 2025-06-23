import { useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

export interface CollectionLogItemTooltipProps {
  name: string;
}

export const useCollectionLogItemTooltip = (): {
  tooltipElement: ReactElement;
  hideTooltip: () => void;
  showTooltip: (item: CollectionLogItemTooltipProps) => void;
} => {
  const [item, setTooltipItem] = useState<CollectionLogItemTooltipProps>();
  const tooltipRef = useRef<HTMLDivElement>(document.body.querySelector<HTMLDivElement>("div#tooltip")!);

  const hideTooltip = (): void => {
    setTooltipItem(undefined);
    tooltipRef.current.style.visibility = "hidden";
  };
  const showTooltip = (item: CollectionLogItemTooltipProps): void => {
    setTooltipItem(item);
    tooltipRef.current.style.visibility = "visible";
  };

  const content = <>{item?.name}</>;

  const tooltipElement = createPortal(content, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
