import { useEffect, useRef, type ReactElement } from "react";

import "./tooltip.css";
export const Tooltip = (): ReactElement => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerMove = ({ clientX: x, clientY: y }: PointerEvent): void => {
      if (!elementRef.current) return;

      elementRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener("pointermove", handlePointerMove);
    return (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <div id="tooltip-container" ref={elementRef}>
      <div id="tooltip" />
    </div>
  );
};
