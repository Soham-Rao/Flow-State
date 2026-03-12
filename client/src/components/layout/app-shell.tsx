import { Bell, Command, LayoutDashboard, ListTodo, LogOut, Timer } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Boards", icon: ListTodo },
  { to: "/", label: "Focus", icon: Timer }
];

export function AppShell({ children }: AppShellProps): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const status = useAuthStore((state) => state.status);

  const navigate = useNavigate();
  const isSubmitting = status === "loading";

  const onLogout = async (): Promise<void> => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-border/70 bg-card/70 px-4 py-4 backdrop-blur-md lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
        <div className="mb-6 flex items-center justify-between lg:mb-8">
          <Link to="/" className="text-xl font-bold tracking-tight text-primary">
            FlowState
          </Link>
          <Button variant="secondary" size="sm" className="gap-2">
            <Command className="h-4 w-4" />
            Cmd+K
          </Button>
        </div>

        <nav className="grid gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-secondary-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-lg lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Team Workspace</p>
              <h1 className="text-lg font-semibold">Welcome back, {user?.name ?? "Teammate"}</h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-right md:block">
                <p className="text-sm font-medium leading-tight">{user?.email}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{user?.role}</p>
              </div>

              <Button variant="ghost" size="sm" className="gap-2">
                <Bell className="h-4 w-4" />
                Alerts
              </Button>

              <Button variant="secondary" size="sm" className="gap-2" onClick={() => void onLogout()} disabled={isSubmitting}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <section className="flex-1 p-4 lg:p-6">{children}</section>
      </main>
    </div>
  );
}
