import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { PublicPageLayout } from "@/components/public/public-page-layout";
import { Button } from "@/components/ui/button";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
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

  const clearLocalErrors = (): void => {
    if (apiError || formError) {
      clearError();
      setFormError(null);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
      setFormError("Please complete all required fields.");
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

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (!acceptedLegalTerms) {
      setFormError("You must accept the Privacy Policy and Terms of Use.");
      return;
    }

    setFormError(null);

    try {
      await register({
        name: normalizedName,
        email: normalizedEmail,
        password,
        inviteToken: inviteToken && !inviteError ? inviteToken : undefined,
        acceptedLegalTerms: true
      });
      navigate("/workspaces");
    } catch {
      // Error state is handled by the auth store.
    }
  };

  return (
    <PublicPageLayout
      title="Create account"
      description="Register for FlowState with a valid email address, a secure password, and acceptance of the governing legal terms."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            clearLocalErrors();
          }}
          autoComplete="name"
          minLength={2}
          required
        />
        <Input
          type="email"
          placeholder="Work email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearLocalErrors();
          }}
          autoComplete="email"
          required
        />
        <div className="space-y-2">
          <PasswordInput
            placeholder="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearLocalErrors();
            }}
            autoComplete="new-password"
            minLength={8}
            required
            visibilityLabel="password"
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <PasswordInput
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            clearLocalErrors();
          }}
          autoComplete="new-password"
          minLength={8}
          required
          visibilityLabel="confirmed password"
        />

        {inviteToken && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            {inviteLoading
              ? "Checking invite..."
              : inviteError
                ? inviteError
                : inviteInfo
                  ? `Invite to ${inviteInfo.workspaceName}${inviteInfo.email ? ` for ${inviteInfo.email}` : ""}`
                  : "Invite link detected."}
          </div>
        )}

        <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 px-3 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acceptedLegalTerms}
            onChange={(event) => {
              setAcceptedLegalTerms(event.target.checked);
              clearLocalErrors();
            }}
            required
          />
          <span>
            I have read and accept the <Link className="font-medium text-primary hover:underline" to="/privacy">Privacy Policy</Link> and <Link className="font-medium text-primary hover:underline" to="/terms">Terms of Use</Link>.
          </span>
        </label>

        {(formError || apiError) && (
          <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError ?? apiError}
          </p>
        )}

        <p className="text-xs text-muted-foreground">The person who creates a workspace becomes its first administrator.</p>

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary hover:underline" to={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}>
          Sign in
        </Link>
      </p>
    </PublicPageLayout>
  );
}
