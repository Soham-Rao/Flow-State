import { useState, type FormEvent } from "react";
import { Building2, LogOut, Plus, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { joinWorkspace } from "@/lib/workspaces-api";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function WorkspacePickerPage(): JSX.Element {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const canCreateWorkspace = useWorkspaceStore((state) => state.canCreateWorkspace);
  const refresh = useWorkspaceStore((state) => state.refresh);
  const switchWorkspace = useWorkspaceStore((state) => state.switchWorkspace);
  const logout = useAuthStore((state) => state.logout);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitJoin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setJoining(true);
    setError(null);
    try {
      const workspace = await joinWorkspace({ name, joinCode });
      await refresh();
      switchWorkspace(workspace.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to join workspace");
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-teal-300">FlowState</p>
            <h1 className="mt-1 text-3xl font-semibold">Choose a workspace</h1>
            <p className="mt-2 text-sm text-slate-300">Your role and dashboard are determined by the workspace you choose.</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => switchWorkspace(workspace.id)}
              className="rounded-xl border border-white/15 bg-white/10 p-5 text-left transition hover:border-teal-300/60 hover:bg-white/15"
            >
              <Building2 className="mb-4 h-6 w-6 text-teal-300" />
              <div className="font-semibold">{workspace.name}</div>
              <div className="mt-1 text-sm capitalize text-slate-300">{workspace.role}</div>
            </button>
          ))}
        </div>

        {workspaces.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/20 p-6 text-sm text-slate-300">
            You are not in a workspace yet. Join one below using its name and private code.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Join a workspace</CardTitle>
            <CardDescription>Ask that workspace’s admin for the exact workspace name and join code.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void submitJoin(event)}>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Workspace name" required />
              <Input type="password" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Join code" required autoComplete="off" />
              <Button type="submit" disabled={joining}>{joining ? "Joining..." : "Join"}</Button>
            </form>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
          </CardContent>
        </Card>

        {canCreateWorkspace && (
          <Link to="/workspaces/new" className="inline-block pt-3">
            <Button><Plus className="mr-2 h-4 w-4" />Create a new workspace</Button>
          </Link>
        )}
      </div>
    </main>
  );
}
