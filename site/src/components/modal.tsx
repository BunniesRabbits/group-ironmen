import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  const modalRef = useRef<HTMLDivElement>(null);

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

  const MODAL_Z_INDEX = 100;
  const modal = isOpen ? (
    <div
      id="modal"
      ref={modalRef}
      style={{
        zIndex: MODAL_Z_INDEX,
        position: "absolute",
        inset: "0",
        display: "flex",
        justifyContent: "space-around",
        background: "rgb(0 0 0 / 60%)",
        alignItems: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <Children onCloseModal={close} {...otherProps} />
    </div>
  ) : undefined;
  return { open, close, modal: createPortal(modal, document.body) };
};
