import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

export function RegisterPage(): JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const status = useAuthStore((state) => state.status);
  const apiError = useAuthStore((state) => state.error);
  const register = useAuthStore((state) => state.register);
  const clearError = useAuthStore((state) => state.clearError);

  const navigate = useNavigate();
  const isSubmitting = status === "loading";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!name || !email || !password) {
      setFormError("Please complete all fields.");
      return;
    }

    setFormError(null);

    try {
      await register({
        name,
        email,
        password
      });
      navigate("/");
    } catch {
      // Error state is handled by the auth store.
    }
  };

  const onNameChange = (value: string): void => {
    setName(value);
    if (apiError || formError) {
      clearError();
      setFormError(null);
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
          <CardTitle>Create account</CardTitle>
          <CardDescription>First successful signup will be admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              autoComplete="name"
            />
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
              autoComplete="new-password"
            />

            {(formError || apiError) && (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError ?? apiError}
              </p>
            )}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-primary hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
