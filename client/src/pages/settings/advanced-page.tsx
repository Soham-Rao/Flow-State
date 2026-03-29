import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { glassCardClass, glassSubtleClass } from "@/pages/glassmorphism.styles";

export function AdvancedSettingsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <header className={`rounded-xl p-4 ${glassSubtleClass}`}>
        <h2 className="text-2xl font-semibold">Advanced settings</h2>
        <p className="text-sm text-muted-foreground">
          Reserved for future integrations like SMTP and security controls.
        </p>
      </header>

      <Card className={glassCardClass}>
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
