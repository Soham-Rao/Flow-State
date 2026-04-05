import { Link } from "react-router-dom";

interface PublicPageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
}

function LegalFooterLinks(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <Link className="hover:text-foreground hover:underline" to="/privacy">
        Privacy Policy
      </Link>
      <Link className="hover:text-foreground hover:underline" to="/terms">
        Terms of Use
      </Link>
      <Link className="hover:text-foreground hover:underline" to="/login">
        Sign in
      </Link>
      <Link className="hover:text-foreground hover:underline" to="/register">
        Create account
      </Link>
    </div>
  );
}

export function PublicPageLayout({
  title,
  description,
  children,
  maxWidthClassName = "max-w-md"
}: PublicPageLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className={`w-full ${maxWidthClassName}`}>
        <div className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
          <div className="border-b border-border/70 px-6 py-5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="px-6 py-5">{children}</div>
          <div className="border-t border-border/70 px-6 py-4">
            <LegalFooterLinks />
          </div>
        </div>
      </div>
    </div>
  );
}
