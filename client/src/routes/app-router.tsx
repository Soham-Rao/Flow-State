import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { BoardDetailPage } from "@/pages/boards/board-detail-page";
import { BoardsPage } from "@/pages/boards/boards-page";
import { FocusPage } from "@/pages/focus-page";
import { HomePage } from "@/pages/home-page";
import { ThreadsPage } from "@/pages/threads-page";
import { AdvancedSettingsPage } from "@/pages/settings/advanced-page";
import { GeneralSettingsPage } from "@/pages/settings/general-page";
import { ProfileSettingsPage } from "@/pages/settings/profile-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { AuthGate } from "@/routes/auth-gate";
import { GuestOnlyRoute, ProtectedRoute } from "@/routes/protected-route";

function WithShell({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export function AppRouter(): JSX.Element {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <WithShell>
                <HomePage />
              </WithShell>
            }
          />
          <Route
            path="/boards"
            element={
              <WithShell>
                <BoardsPage />
              </WithShell>
            }
          />
          <Route
            path="/boards/:boardId"
            element={
              <WithShell>
                <BoardDetailPage />
              </WithShell>
            }
          />

          <Route
            path="/focus"
            element={
              <WithShell>
                <FocusPage />
              </WithShell>
            }
          />

          <Route
            path="/threads"
            element={
              <WithShell>
                <ThreadsPage />
              </WithShell>
            }
          />

          <Route
            path="/settings/profile"
            element={
              <WithShell>
                <ProfileSettingsPage />
              </WithShell>
            }
          />
          <Route
            path="/settings/general"
            element={
              <WithShell>
                <GeneralSettingsPage />
              </WithShell>
            }
          />
          <Route
            path="/settings/advanced"
            element={
              <WithShell>
                <AdvancedSettingsPage />
              </WithShell>
            }
          />
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <LoginPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestOnlyRoute>
                <RegisterPage />
              </GuestOnlyRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  );
}
