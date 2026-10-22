import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog: focus moves in when it opens, stays inside while it's open, and goes back to
 * where it was when it closes. Escape closes it.
 */
export const Dialog = ({
  title,
  onClose,
  children,
  className = "",
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}) => {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    const first =
      dialog.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialog}
        className={`dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={onKeyDown}
      >
        <div className="dialog-header">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" className="button quiet" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
