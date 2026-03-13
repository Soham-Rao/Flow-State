import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

interface ProfileFormState {
  name: string;
  username: string;
  displayName: string;
  bio: string;
  age: string;
  dateOfBirth: string;
}

const emptyForm: ProfileFormState = {
  name: "",
  username: "",
  displayName: "",
  bio: "",
  age: "",
  dateOfBirth: ""
};


function clampYearInDateInput(value: string): string {
  if (!value) {
    return value;
  }

  const [datePart, timePart] = value.split("T");
  const segments = datePart.split("-");
  if (segments.length < 3) {
    return value;
  }

  const [year, month, day] = segments;
  if (year.length <= 4) {
    return value;
  }

  const trimmedYear = year.slice(0, 4);
  const rebuiltDate = `${trimmedYear}-${month}-${day}`;
  return timePart ? `${rebuiltDate}T${timePart}` : rebuiltDate;
}

function formatDateInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function ProfileSettingsPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const baseline = useMemo<ProfileFormState>(() => ({
    name: user?.name ?? "",
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    bio: user?.bio ?? "",
    age: user?.age === null || user?.age === undefined ? "" : String(user.age),
    dateOfBirth: formatDateInput(user?.dateOfBirth ?? null)
  }), [user]);

  useEffect(() => {
    setForm(baseline);
  }, [baseline]);

  const isSaving = status === "saving";

  const normalizeText = (value: string) => value.trim();
  const normalizeAge = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? "" : String(Number(trimmed));
  };

  const hasUnsavedChanges = useMemo(() => {
    return (
      normalizeText(form.name) !== normalizeText(baseline.name) ||
      normalizeText(form.username) !== normalizeText(baseline.username) ||
      normalizeText(form.displayName) !== normalizeText(baseline.displayName) ||
      normalizeText(form.bio) !== normalizeText(baseline.bio) ||
      normalizeAge(form.age) !== normalizeAge(baseline.age) ||
      form.dateOfBirth !== baseline.dateOfBirth
    );
  }, [form, baseline]);


  const helperText = useMemo(() => {
    if (status === "saved") {
      return hasUnsavedChanges ? "Profile updated." : "All changes saved.";
    }
    if (status === "error") {
      return error ?? "Unable to update profile.";
    }
    return "Keep your details up to date for teammates.";
  }, [status, error]);

  const onChange = (key: keyof ProfileFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({
      ...prev,
      [key]: event.target.value
    }));
    setStatus("idle");
    setError(null);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    const ageValue = form.age.trim();
    const parsedAge = ageValue.length > 0 ? Number(ageValue) : null;

    try {
      await updateProfile({
        name: form.name.trim(),
        username: form.username.trim() === "" ? null : form.username.trim(),
        displayName: form.displayName.trim() === "" ? null : form.displayName.trim(),
        bio: form.bio.trim() === "" ? null : form.bio.trim(),
        age: Number.isNaN(parsedAge) ? null : parsedAge,
        dateOfBirth: form.dateOfBirth.trim() === "" ? null : form.dateOfBirth
      });
      setStatus("saved");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update profile";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Profile settings</h2>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
        {hasUnsavedChanges && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Unsaved changes
          </span>
        )}
      </header>

      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic details</CardTitle>
              <CardDescription>These appear across the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name</label>
                <Input value={form.name} onChange={onChange("name")} placeholder="Your name" required />
                <p className="text-xs text-muted-foreground">Stored as your real name (not shown in the UI yet).</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input value={form.username} onChange={onChange("username")} placeholder="Username" />
                <p className="text-xs text-muted-foreground">Unique handle for the workspace. Mentions use @username.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Display name</label>
                <Input value={form.displayName} onChange={onChange("displayName")} placeholder="Display name" />
                <p className="text-xs text-muted-foreground">Shown everywhere as your visible name. Can be shared with others.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About you</CardTitle>
              <CardDescription>Short bio and personal details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bio</label>
                <textarea
                  className="min-h-[120px] w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.bio}
                  onChange={onChange("bio")}
                  placeholder="A quick summary about you"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Age</label>
                  <Input
                    type="number"
                    min={0}
                    max={130}
                    value={form.age}
                    onChange={onChange("age")}
                    placeholder="Age"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date of birth</label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => {
                      const nextValue = clampYearInDateInput(event.target.value);
                      setForm((prev) => ({ ...prev, dateOfBirth: nextValue }));
                      setStatus("idle");
                      setError(null);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Changes are visible immediately after saving.
          </p>
          <Button type="submit" disabled={isSaving || !hasUnsavedChanges}>
            {isSaving ? "Saving..." : hasUnsavedChanges ? "Save profile" : "Up to date"}
          </Button>
        </div>
      </form>
    </div>
  );
}
