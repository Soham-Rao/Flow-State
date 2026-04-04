import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("AppErrorBoundary", error);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background px-6 py-16 text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <Card className="w-full border-white/60 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/90">
            <CardHeader>
              <CardTitle>FlowState hit an unexpected problem</CardTitle>
              <CardDescription>
                The page crashed safely. Your data on the server is still intact, and a refresh usually fixes this kind of deploy or runtime mismatch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                If this happened just after a deploy, your browser may still have an older JS chunk cached.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={this.handleReload}>Reload FlowState</Button>
                <Button variant="secondary" onClick={() => this.setState({ error: null })}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}
