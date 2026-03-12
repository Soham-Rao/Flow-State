import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

export function LoginPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const status = useAuthStore((state) => state.status);
  const apiError = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const clearError = useAuthStore((state) => state.clearError);

  const navigate = useNavigate();
  const isSubmitting = status === "loading";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!email || !password) {
      setFormError("Please enter email and password.");
      return;
    }

    setFormError(null);

    try {
      await login({
        email,
        password
      });
      navigate("/");
    } catch {
      // Error state is handled by the auth store.
    }
  };

  const onEmailChange = (value: string): void => {
    setEmail(value);
    if (apiError || formError) {
      clearError();
      setFormError(null);
    }
  };

  const onPasswordChange = (value: string): void => {
    setPassword(value);
    if (apiError || formError) {
      clearError();
      setFormError(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your FlowState account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
            />

            {(formError || apiError) && (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError ?? apiError}
              </p>
            )}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Continue"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            New here?{" "}
            <Link className="font-medium text-primary hover:underline" to="/register">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
