import { Activity, CalendarDays, CheckCircle2, ListTodo } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

const dashboardCards = [
  {
    title: "My Tasks",
    icon: ListTodo,
    description: "Cards assigned to you across every board.",
    value: "0"
  },
  {
    title: "Completed Today",
    icon: CheckCircle2,
    description: "Cards moved to done lists.",
    value: "0"
  },
  {
    title: "Upcoming Deadlines",
    icon: CalendarDays,
    description: "Tasks due within the next 7 days.",
    value: "0"
  },
  {
    title: "Team Pulse",
    icon: Activity,
    description: "Recent team activity and momentum.",
    value: "No events yet"
  }
];

export function HomePage(): JSX.Element {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map(({ title, icon: Icon, description, value }) => (
          <Card key={title}>
            <CardHeader className="space-y-3 pb-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
