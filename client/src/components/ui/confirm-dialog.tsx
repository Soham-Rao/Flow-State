import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  confirmVariant?: "default" | "secondary" | "ghost";
  showCancel?: boolean;
  showConfirm?: boolean;
  overlayClassName?: string;
  initialFocus?: "cancel" | "confirm";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmClassName,
  confirmVariant = "default",
  showCancel = true,
  showConfirm = true,
  overlayClassName = "z-50",
  initialFocus = "confirm",
  onConfirm,
  onCancel
}: ConfirmDialogProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTarget =
      initialFocus === "cancel"
        ? cancelRef.current ?? confirmRef.current
        : confirmRef.current ?? cancelRef.current;
    const timer = window.setTimeout(() => focusTarget?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open, initialFocus]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Tab") return;
    const container = dialogRef.current;
    if (!container) return;
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      )
    ).filter((el) => !el.hasAttribute("disabled"));

    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
  };

  return (
    <div
      className={`fixed inset-0 ${overlayClassName} flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:items-center sm:p-4`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-[min(100%,32rem)] max-h-[calc(100dvh-1.5rem)] overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
        onMouseDown={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <CardHeader>
          <CardTitle id={titleId}>{title}</CardTitle>
          <CardDescription id={descriptionId} className="break-words">{description}</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[calc(100dvh-9rem)] overflow-y-auto">
          <div className="flex flex-wrap justify-end gap-2">
            {showCancel && (
              <Button ref={cancelRef} type="button" variant="ghost" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
            {showConfirm && (
              <Button
                ref={confirmRef}
                type="button"
                variant={confirmVariant}
                className={confirmClassName}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




