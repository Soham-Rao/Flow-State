import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdvancedSettingsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Advanced settings</h2>
        <p className="text-sm text-muted-foreground">
          Reserved for future integrations like SMTP and security controls.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Advanced controls</CardTitle>
          <CardDescription>Nothing to configure here yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          We will surface advanced settings once the integrations are ready.
        </CardContent>
      </Card>
    </div>
  );
}
