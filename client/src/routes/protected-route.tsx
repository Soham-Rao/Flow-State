import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/stores/auth-store";

interface RouteGuardProps {
  children: JSX.Element;
}

export function ProtectedRoute({ children }: RouteGuardProps): JSX.Element {
  const status = useAuthStore((state) => state.status);

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function GuestOnlyRoute({ children }: RouteGuardProps): JSX.Element {
  const status = useAuthStore((state) => state.status);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return children;
}
