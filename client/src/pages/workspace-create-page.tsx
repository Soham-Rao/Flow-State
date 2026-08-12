import { useState, type FormEvent } from "react";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createWorkspace } from "@/lib/workspaces-api";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function WorkspaceCreatePage(): JSX.Element {
  const canCreateWorkspace = useWorkspaceStore((state) => state.canCreateWorkspace);
  const switchWorkspace = useWorkspaceStore((state) => state.switchWorkspace);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreateWorkspace) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const workspace = await createWorkspace({ name, joinCode, password });
      setPassword("");
      switchWorkspace(workspace.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create workspace");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Link to="/workspaces" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to workspaces
      </Link>
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle>Create a new workspace</CardTitle>
          <CardDescription>
            Workspaces are completely separate. Creation requires the private workspace creation password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="workspace-join-code">Member join code</label>
              <Input
                id="workspace-join-code"
                type="password"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                minLength={8}
                maxLength={128}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Share this code only with people who should join this workspace.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="workspace-name">Workspace name</label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Marketing Workspace"
                minLength={2}
                maxLength={100}
                required
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="workspace-password">Creation password</label>
              <Input
                id="workspace-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            <Button type="submit" disabled={submitting || !name.trim() || joinCode.length < 8 || !password}>
              {submitting ? "Creating workspace..." : "Create workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
