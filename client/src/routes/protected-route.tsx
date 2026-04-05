import { Navigate } from "react-router-dom";

import { hasUserPermission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import type { RolePermission } from "@/types/roles";

interface RouteGuardProps {
  children: JSX.Element;
}

interface PermissionRouteProps extends RouteGuardProps {
  permission: RolePermission;
  fallbackTo?: string;
}

export function ProtectedRoute({ children }: RouteGuardProps): JSX.Element {
  const status = useAuthStore((state) => state.status);

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function PermissionRoute({ children, permission, fallbackTo = "/" }: PermissionRouteProps): JSX.Element {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!hasUserPermission(user, permission)) {
    return <Navigate to={fallbackTo} replace />;
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
