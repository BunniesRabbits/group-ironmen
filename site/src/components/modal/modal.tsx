import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

import "./modal.css";

/**
 * Children for a modal that receive a callback to close the parent modal.
 * @see useModal
 */
type ModalChildren<TOtherProps> = ({ onCloseModal }: { onCloseModal: () => void } & TOtherProps) => ReactNode;

/**
 * A modal that attaches itself to the body DOM node, which is "root" in this
 * app. Having multiple of these modals open at once will probably cause issues,
 * it is untested.
 *
 * @param Children - JSX compatible component to render as a child of the
 *    modal's DOM node. They will receive a callback as a property that they
 *    should call to close the modal.
 * @param otherProps - Properties that will be passed to the children with the
 *    spread operator.
 * @see ModalChildren
 */
export const useModal = <OtherPropsT,>({
  Children,
  otherProps,
}: {
  Children: ModalChildren<OtherPropsT>;
  otherProps: OtherPropsT;
}): { open: () => void; close: () => void; modal?: ReactElement } => {
  /*
   * Children and otherProps are passed separately to assist with
   * reconciliation. Children can be a stable, constant functional component.
   * otherProps can be spread, and all its members can be stable.
   *
   * If we tried to combine the two parameters, it would almost certainly lead to permanent
   * remounting, which I did encounter while prototyping this.
   */

  const [isOpen, setIsOpen] = useState<boolean>(false);

  // We toggle inert on the rest of the DOM so that only our modal can be interacted with.
  const close = useCallback(() => {
    setIsOpen(false);
    document.body.querySelectorAll<HTMLElement>(":not(#modal)").forEach((el) => el.removeAttribute("inert"));
  }, []);
  const open = useCallback(() => {
    document.body.querySelectorAll<HTMLElement>(":not(#modal)").forEach((el) => (el.inert = true));
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const closeOnEsc = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "Esc") {
        close();
      }
    };
    window.addEventListener("keydown", closeOnEsc);
    return (): void => window.removeEventListener("keydown", closeOnEsc);
  }, [close]);

  useEffect(() => {
    if (!isOpen) return;

    /*
     * I don't really know why, but even if we .blur() the activeElement, inert
     * elements in the background still get keyboard events. However, if we
     * .focus() then .blur() an interactive element from the new interactive
     * modal, the background stops getting keyboard events. So we do that, even
     * if it is kinda hacky. I don't know what else to do right now.
     *
     * I noticed the behavior on Chrome and Firefox.
     *
     * TODO: Figure out why focus + blur is needed for modal.
     */
    const focusableElements = document.querySelectorAll(
      '#modal button, #modal [href], #modal input, #modal select, #modal textarea, #modal [tabindex]:not([tabindex="-1"])',
    );
    if (focusableElements.length > 0) {
      const firstFocusable = focusableElements[0] as Partial<HTMLElement>;
      firstFocusable.focus?.();
      firstFocusable.blur?.();
    }
  }, [isOpen]);

  const modal = isOpen ? (
    <>
      <button id="modal-clickbox" onClick={close} aria-label="Exit Modal" />
      <div id="modal">
        <Children onCloseModal={close} {...otherProps} />
      </div>
    </>
  ) : undefined;
  return { open, close, modal: createPortal(modal, document.body) };
};
