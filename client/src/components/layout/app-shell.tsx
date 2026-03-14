import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Command, LayoutDashboard, ListTodo, LogOut, MessageCircle, Settings, Sliders, Timer, User } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/boards", label: "Boards", icon: ListTodo },
  { to: "/focus", label: "Focus", icon: Timer }
];

const settingsItems = [
  { to: "/settings/profile", label: "Profile", icon: User },
  { to: "/settings/general", label: "General", icon: Settings },
  { to: "/settings/advanced", label: "Advanced", icon: Sliders }
];

export function AppShell({ children }: AppShellProps): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const status = useAuthStore((state) => state.status);

  const navigate = useNavigate();
  const isSubmitting = status === "loading";

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = useMemo(() => {
    return user?.displayName || user?.username || "Teammate";
  }, [user]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const onLogout = async (): Promise<void> => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-border/70 bg-card/70 px-4 py-4 backdrop-blur-md lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
        <div className="mb-6 flex items-center justify-between lg:mb-8">
          <NavLink to="/" className="text-xl font-bold tracking-tight text-primary">
            FlowState
          </NavLink>
          <Button variant="secondary" size="sm" className="gap-2">
            <Command className="h-4 w-4" />
            Cmd+K
          </Button>
        </div>

        <nav className="grid gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-foreground/80 hover:bg-secondary hover:text-secondary-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Threads
          </p>
          <nav className="grid gap-2">
            <NavLink
              to="/threads"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-foreground/80 hover:bg-secondary hover:text-secondary-foreground"
                }`
              }
            >
              <MessageCircle className="h-4 w-4" />
              Threads
            </NavLink>
          </nav>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Settings
          </p>
          <nav className="grid gap-2">
            {settingsItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground/80 hover:bg-secondary hover:text-secondary-foreground"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-lg lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Team Workspace</p>
              <h1 className="text-lg font-semibold">Welcome back, {displayName}</h1>
            </div>

            <div className="flex items-center gap-2">
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-right transition hover:bg-card"
                >
                  <div>
                    <p className="text-sm font-medium leading-tight">{displayName}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {user?.role ?? "member"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border/70 bg-card/95 p-2 shadow-lg backdrop-blur">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/settings/profile");
                      }}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/settings/general");
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
                      disabled
                    >
                      <Bell className="h-4 w-4" />
                      Help center
                    </button>
                    <div className="my-2 border-t border-border/70" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
                      onClick={() => void onLogout()}
                      disabled={isSubmitting}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" className="gap-2">
                <Bell className="h-4 w-4" />
                Alerts
              </Button>
            </div>
          </div>
        </header>

        <section className="flex-1 p-4 lg:p-6">{children}</section>
      </main>
    </div>
  );
}
