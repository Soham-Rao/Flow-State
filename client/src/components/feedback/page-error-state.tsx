import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PageErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function PageErrorState({
  title = "Something interrupted this page",
  message,
  onRetry
}: PageErrorStateProps): JSX.Element {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-destructive">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm opacity-90">{message}</p>
          {onRetry && (
            <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
