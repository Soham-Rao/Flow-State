import { cloneElement, isValidElement, useEffect, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  glassCardClass,
  glassInputClass,
  glassStrongClass,
  glassSubtleClass
} from "@/pages/glassmorphism.styles";

type SettingsPageHeaderProps = {
  title: string;
  helper?: string;
  actions?: ReactNode;
  className?: string;
};

export function SettingsPageHeader({
  title,
  helper,
  actions,
  className
}: SettingsPageHeaderProps): JSX.Element {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 rounded-xl p-4", glassSubtleClass, className)}>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        {helper && <p className="text-sm text-muted-foreground">{helper}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type SettingsPanelProps = {
  title: string;
  description?: string;
  helper?: string;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
};

export function SettingsPanel({
  title,
  description,
  helper,
  actions,
  children,
  footer,
  className,
  headerClassName,
  contentClassName,
  footerClassName
}: SettingsPanelProps): JSX.Element {
  return (
    <Card className={cn(glassCardClass, "overflow-hidden", className)}>
      <CardHeader className={cn("flex flex-wrap items-start justify-between gap-3", headerClassName)}>
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
          {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      {children && <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>}
      {footer && (
        <div className={cn("border-t border-border/60 bg-card/60 px-6 py-3", footerClassName)}>
          {footer}
        </div>
      )}
    </Card>
  );
}

type FormFieldProps = {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  helperClassName?: string;
  id?: string;
};

export function FormField({
  label,
  helper,
  error,
  required,
  children,
  className,
  labelClassName,
  helperClassName,
  id
}: FormFieldProps): JSX.Element {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helper || error ? `${fieldId}-help` : undefined;
  const content = (() => {
    if (!children) return children;
    if (typeof children === "string" || typeof children === "number") return children;
    if (!isValidElement(children)) return children;
    const nextProps: Record<string, unknown> = {
      id: fieldId,
      "aria-describedby": helperId,
      "aria-invalid": error ? true : undefined
    };
    if (required !== undefined && (children as ReactElement).props?.required === undefined) {
      nextProps.required = required;
    }
    return cloneElement(children as ReactElement, nextProps);
  })();

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={fieldId}
        className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground", labelClassName)}
      >
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {content}
      {(helper || error) && (
        <p
          id={helperId}
          className={cn(
            "text-xs",
            error ? "text-rose-500" : "text-muted-foreground",
            helperClassName
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

type ListRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export function ListRow({
  title,
  subtitle,
  description,
  leading,
  actions,
  selected,
  disabled,
  onClick,
  className
}: ListRowProps): JSX.Element {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-left text-sm transition-none",
        selected ? "border-primary/40 bg-primary/10 text-primary" : "text-foreground/90 hover:bg-card",
        disabled ? "cursor-not-allowed opacity-70" : "",
        onClick ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading && <div className="mt-1">{leading}</div>}
        <div className="min-w-0 space-y-1">
          <div className="font-semibold text-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </Component>
  );
}

type StateNoticeTone = "neutral" | "loading" | "error";

type StateNoticeProps = {
  tone?: StateNoticeTone;
  title: string;
  description?: string;
  className?: string;
};

export function StateNotice({
  tone = "neutral",
  title,
  description,
  className
}: StateNoticeProps): JSX.Element {
  const toneClass =
    tone === "error"
      ? "border-rose-300/60 text-rose-600 dark:text-rose-300"
      : tone === "loading"
        ? "border-amber-300/60 text-amber-600 dark:text-amber-300"
        : "border-border/60 text-muted-foreground";
  return (
    <div className={cn("rounded-lg border border-dashed bg-card/50 p-3 text-sm", toneClass, className)}>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

type StandardModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode | null;
  headerActions?: ReactNode;
  bodyClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

export function StandardModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  headerActions,
  bodyClassName,
  size = "lg"
}: StandardModalProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === "sm"
      ? "max-w-sm"
      : size === "md"
        ? "max-w-lg"
        : size === "xl"
          ? "max-w-5xl"
          : "max-w-4xl";

  const resolvedFooter =
    footer === undefined ? (
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    ) : (
      footer
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/20 p-3 backdrop-blur-sm sm:items-center sm:p-4 dark:bg-black/55"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn("w-full rounded-3xl overflow-hidden max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]", glassStrongClass, "bg-white/60 border-white/70 backdrop-blur-2xl shadow-[0_24px_70px_rgba(15,23,42,0.12)] text-slate-900 [&_.text-muted-foreground]:text-slate-600 [&_.text-foreground]:text-slate-900 dark:bg-black/45 dark:border-white/20 dark:text-white dark:[&_.text-muted-foreground]:text-white/70 dark:[&_.text-foreground]:text-white dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] dark:backdrop-blur-2xl", sizeClass)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-6 py-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {headerActions && <div className="flex flex-wrap items-center gap-2">{headerActions}</div>}
        </div>
        <div className={cn("max-h-[calc(100dvh-9rem)] overflow-y-auto px-4 py-4 sm:px-6", bodyClassName)}>
          {children}
        </div>
        {resolvedFooter !== null && (
          <div className="border-t border-border/60 bg-card/50 px-6 py-3">{resolvedFooter}</div>
        )}
      </div>
    </div>
  );
}

export const templateInputClass = cn(
  "w-full rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  glassInputClass
);









