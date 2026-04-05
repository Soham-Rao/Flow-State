import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/routes/auth-gate";
import { GuestOnlyRoute, ProtectedRoute } from "@/routes/protected-route";

const HomePage = lazy(async () => ({ default: (await import("@/pages/home-page")).HomePage }));
const BoardsPage = lazy(async () => ({ default: (await import("@/pages/boards/boards-page")).BoardsPage }));
const BoardDetailPage = lazy(async () => ({ default: (await import("@/pages/boards/board-detail-page")).BoardDetailPage }));
const FocusPage = lazy(async () => ({ default: (await import("@/pages/focus-page")).FocusPage }));
const ThreadsPage = lazy(async () => ({ default: (await import("@/pages/threads-page")).ThreadsPage }));
const ProfileSettingsPage = lazy(async () => ({ default: (await import("@/pages/settings/profile-page")).ProfileSettingsPage }));
const GeneralSettingsPage = lazy(async () => ({ default: (await import("@/pages/settings/general-page")).GeneralSettingsPage }));
const AdvancedSettingsPage = lazy(async () => ({ default: (await import("@/pages/settings/advanced-page")).AdvancedSettingsPage }));
const LoginPage = lazy(async () => ({ default: (await import("@/pages/login-page")).LoginPage }));
const RegisterPage = lazy(async () => ({ default: (await import("@/pages/register-page")).RegisterPage }));
const PrivacyPage = lazy(async () => ({ default: (await import("@/pages/legal/privacy-page")).PrivacyPage }));
const TermsPage = lazy(async () => ({ default: (await import("@/pages/legal/terms-page")).TermsPage }));

function RouteFallback(): JSX.Element {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-3 text-sm text-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.28)] backdrop-blur-md">
        Loading FlowState...
      </div>
    </div>
  );
}

function WithShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ProtectedRoute>
      <AppShell>
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

function GuestRoute({ children }: { children: ReactNode }): JSX.Element {
  return (
    <GuestOnlyRoute>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </GuestOnlyRoute>
  );
}

function PublicRoute({ children }: { children: ReactNode }): JSX.Element {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export function AppRouter(): JSX.Element {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WithShell><HomePage /></WithShell>} />
          <Route path="/boards" element={<WithShell><BoardsPage /></WithShell>} />
          <Route path="/boards/:boardId" element={<WithShell><BoardDetailPage /></WithShell>} />
          <Route path="/focus" element={<WithShell><FocusPage /></WithShell>} />
          <Route path="/threads" element={<WithShell><ThreadsPage /></WithShell>} />
          <Route path="/settings/profile" element={<WithShell><ProfileSettingsPage /></WithShell>} />
          <Route path="/settings/general" element={<WithShell><GeneralSettingsPage /></WithShell>} />
          <Route path="/settings/advanced" element={<WithShell><AdvancedSettingsPage /></WithShell>} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/privacy" element={<PublicRoute><PrivacyPage /></PublicRoute>} />
          <Route path="/terms" element={<PublicRoute><TermsPage /></PublicRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  );
}
