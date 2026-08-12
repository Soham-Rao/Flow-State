import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<InputProps, "type"> {
  visibilityLabel?: string;
}

export function PasswordInput({ className, visibilityLabel = "password", ...props }: PasswordInputProps): JSX.Element {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type PasswordStrength = "Weak" | "Average" | "Strong";

function evaluatePasswordStrength(password: string): { label: PasswordStrength; level: number } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score >= 4) return { label: "Strong", level: 3 };
  if (score >= 2) return { label: "Average", level: 2 };
  return { label: "Weak", level: 1 };
}

const strengthColors: Record<PasswordStrength, string> = {
  Weak: "bg-rose-500",
  Average: "bg-amber-500",
  Strong: "bg-emerald-500"
};

export function PasswordStrengthMeter({ password }: { password: string }): JSX.Element | null {
  if (!password) return null;

  const strength = evaluatePasswordStrength(password);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              level <= strength.level ? strengthColors[strength.label] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{strength.label}</span>
      </p>
    </div>
  );
}
