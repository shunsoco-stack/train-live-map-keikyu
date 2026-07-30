"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";

const FOCUSABLE_SELECTOR = [
  "[data-sheet-initial-focus]",
  "[autofocus]",
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface AccessibleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  header?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
  id?: string;
  className?: string;
  surfaceClassName?: string;
  headerClassName?: string;
  headerContentClassName?: string;
  actionClassName?: string;
  bodyClassName?: string;
}

function joinClassNames(
  defaultClassName: string,
  className: string | undefined,
) {
  return className
    ? `${defaultClassName} ${className}`
    : defaultClassName;
}

/**
 * A controlled, native-dialog modal surface for mobile bottom sheets.
 *
 * The trigger remains outside this component. Pass its ref with
 * `returnFocusRef` when a sheet can be opened programmatically; otherwise the
 * element focused at open time is restored automatically.
 */
export function AccessibleSheet({
  open,
  onOpenChange,
  labelledBy,
  describedBy,
  header,
  action,
  children,
  initialFocusRef,
  returnFocusRef,
  dismissible = true,
  id,
  className,
  surfaceClassName,
  headerClassName,
  headerContentClassName,
  actionClassName,
  bodyClassName,
}: AccessibleSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const fallbackReturnFocusRef = useRef<HTMLElement | null>(null);
  const focusWasRestoredRef = useRef(true);

  const restoreFocus = useCallback(() => {
    if (focusWasRestoredRef.current) return;
    focusWasRestoredRef.current = true;

    const requestedTarget = returnFocusRef?.current;
    const target =
      requestedTarget?.isConnected === true
        ? requestedTarget
        : fallbackReturnFocusRef.current;
    fallbackReturnFocusRef.current = null;

    if (target?.isConnected) {
      target.focus({ preventScroll: true });
    }
  }, [returnFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!open) {
      if (!dialog.open) return;
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        dialog.close();
        return;
      }
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        if (dialog.open) dialog.close();
      }, 180);
      return () => {
        if (closeTimerRef.current !== null) {
          window.clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
      };
    }

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!dialog.open) {
      const activeElement = document.activeElement;
      fallbackReturnFocusRef.current =
        activeElement instanceof HTMLElement ? activeElement : null;
      focusWasRestoredRef.current = false;
      dialog.showModal();
    }

    const frame = window.requestAnimationFrame(() => {
      const requestedTarget =
        initialFocusRef?.current &&
        dialog.contains(initialFocusRef.current)
          ? initialFocusRef.current
          : null;
      const fallbackTarget =
        dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      const target = requestedTarget ?? fallbackTarget ?? dialog;

      target.focus({ preventScroll: true });
      if (
        document.activeElement !== target &&
        !dialog.contains(document.activeElement)
      ) {
        dialog.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialFocusRef, open]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      restoreFocus();
    },
    [restoreFocus],
  );

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={joinClassNames("accessible-sheet", className)}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      data-state={open ? "open" : "closing"}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onOpenChange(false);
      }}
      onClose={() => {
        if (open) onOpenChange(false);
        restoreFocus();
      }}
      onPointerDown={(event) => {
        if (!dismissible || event.target !== event.currentTarget) return;

        const bounds = event.currentTarget.getBoundingClientRect();
        const outsideSurface =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;

        if (outsideSurface) onOpenChange(false);
      }}
    >
      <div
        className={joinClassNames(
          "accessible-sheet__surface",
          surfaceClassName,
        )}
      >
        {(header || action) && (
          <div
            className={joinClassNames(
              "accessible-sheet__header",
              headerClassName,
            )}
          >
            {header && (
              <div
                className={joinClassNames(
                  "accessible-sheet__header-content",
                  headerContentClassName,
                )}
              >
                {header}
              </div>
            )}
            {action && (
              <div
                className={joinClassNames(
                  "accessible-sheet__action",
                  actionClassName,
                )}
              >
                {action}
              </div>
            )}
          </div>
        )}
        <div
          className={joinClassNames(
            "accessible-sheet__body",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
