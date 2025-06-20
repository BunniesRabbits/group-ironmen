import { Fragment, useRef, useState, type ReactElement } from "react";

import "./tooltip.css";
import { createPortal } from "react-dom";

export interface ItemTooltipProps {
  name: string;
  quantity: number;
  highAlch: number;
  gePrice: number;
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

  const lines: { key: string; value: string }[] = [];
  if (item) {
    if (item.quantity > 1) {
      lines.push({ key: "name", value: `${item.name} x ${item.quantity.toLocaleString()}` });
    } else {
      lines.push({ key: "name", value: `${item.name}` });
    }

    if (item.highAlch > 0) {
      const unitPrice = item.highAlch.toLocaleString();
      const totalPrice = (item.highAlch * item.quantity).toLocaleString();
      if (item.quantity > 1) {
        lines.push({ key: "HA", value: `HA: ${totalPrice}gp (${unitPrice}gp each)` });
      } else {
        lines.push({ key: "HA", value: `HA: ${unitPrice}gp` });
      }
    }

    if (item.gePrice > 0) {
      const unitPrice = item.gePrice.toLocaleString();
      const totalPrice = (item.gePrice * item.quantity).toLocaleString();
      if (item.quantity > 1) {
        lines.push({ key: "GE", value: `GE: ${totalPrice}gp (${unitPrice}gp each)` });
      } else {
        lines.push({ key: "GE", value: `GE: ${unitPrice}gp` });
      }
    }
  }

  const elements = lines.flatMap(({ key, value }, index) => {
    if (index === 0) return [<Fragment key={key}>{value}</Fragment>];
    return [<br key={`br ${key}`} />, <Fragment key={key}>{value}</Fragment>];
  });

  const tooltipElement = createPortal(elements, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
