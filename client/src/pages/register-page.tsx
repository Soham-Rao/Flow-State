import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { lookupInvite } from "@/lib/invites-api";
import { useAuthStore } from "@/stores/auth-store";
import type { InviteLookup } from "@/types/invite";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RegisterPage(): JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? undefined;
  const [inviteInfo, setInviteInfo] = useState<InviteLookup | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const status = useAuthStore((state) => state.status);
  const apiError = useAuthStore((state) => state.error);
  const register = useAuthStore((state) => state.register);
  const clearError = useAuthStore((state) => state.clearError);

  const navigate = useNavigate();
  const isSubmitting = status === "loading";

  useEffect(() => {
    if (!inviteToken) {
      setInviteInfo(null);
      setInviteError(null);
      return;
    }

    setInviteLoading(true);
    setInviteError(null);

    lookupInvite(inviteToken)
      .then((data) => {
        setInviteInfo(data);
        if (data.status !== "pending") {
          setInviteError("Invite is no longer valid.");
          return;
        }
        if (data.email && !email) {
          setEmail(data.email);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Invite is invalid";
        setInviteError(message);
      })
      .finally(() => {
        setInviteLoading(false);
      });
  }, [inviteToken]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      setFormError("Please complete all fields.");
      return;
    }

    if (normalizedName.length < 2) {
      setFormError("Name must be at least 2 characters.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setFormError(null);

    try {
      await register({
        name: normalizedName,
        email: normalizedEmail,
        password,
        inviteToken: inviteToken && !inviteError ? inviteToken : undefined
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
              minLength={2}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="email"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />

            {(formError || apiError) && (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError ?? apiError}
              </p>
            )}

            {inviteToken && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {inviteLoading
                  ? "Checking invite..."
                  : inviteError
                    ? inviteError
                    : inviteInfo?.email
                      ? `Invite for ${inviteInfo.email}`
                      : "Invite link detected."}
              </div>
            )}

            <p className="text-xs text-muted-foreground">Use a valid email and password with at least 8 characters.</p>

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
