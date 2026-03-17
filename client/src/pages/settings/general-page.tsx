import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignRolesModal } from "./general-page.assign-roles-modal";
import { CreateRoleModal } from "./general-page.create-role-modal";
import { ManageRolesModal } from "./general-page.manage-roles-modal";
import { listInvites } from "@/lib/invites-api";
import { createRole, deleteRole, listRoleAssignments, listRoles, updateRole, updateUserRoles } from "@/lib/roles-api";
import { useAuthStore } from "@/stores/auth-store";
import type { InviteSummary } from "@/types/invite";
import { type RolePermission, type RoleSummary, type UserRoleAssignment } from "@/types/roles";
import {
  FONT_STORAGE_KEY,
  SPACING_STORAGE_KEY,
  THEME_STORAGE_KEY,
  fontOptions,
  spacingOptions,
  type FontOption,
  type RoleDraft,
  type SpacingOption,
  type ThemeOption
} from "./general-page.constants";
import {
  applyFont,
  applySpacing,
  applyTheme,
  normalizePermissions,
  normalizeRoleIds,
  normalizeStoredFont,
  normalizeStoredTheme,
  permissionsMatch,
  togglePermission
} from "./general-page.utils";

export function GeneralSettingsPage(): JSX.Element {
  const currentUser = useAuthStore((state) => state.user);
  const canManageRoles = currentUser?.role === "admin";
  const [selectedFont, setSelectedFont] = useState<FontOption>("grotesk");
  const [baselineFont, setBaselineFont] = useState<FontOption>("grotesk");
  const [selectedSpacing, setSelectedSpacing] = useState<SpacingOption>("default");
  const [baselineSpacing, setBaselineSpacing] = useState<SpacingOption>("default");
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("system");
  const [baselineTheme, setBaselineTheme] = useState<ThemeOption>("system");
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, string[]>>({});
  const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#64748b");
  const [newRolePermissions, setNewRolePermissions] = useState<RolePermission[]>(["view_boards"]);
  const [creatingRole, setCreatingRole] = useState(false);

  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [savingRoles, setSavingRoles] = useState<Set<string>>(new Set());
  const [deletingRoles, setDeletingRoles] = useState<Set<string>>(new Set());

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showManageRoles, setShowManageRoles] = useState(false);
  const [showAssignRoles, setShowAssignRoles] = useState(false);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const roleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    try {
      const storedFont = normalizeStoredFont(localStorage.getItem(FONT_STORAGE_KEY));
      const storedSpacing = (localStorage.getItem(SPACING_STORAGE_KEY) as SpacingOption | null) ?? "default";
      const storedTheme = normalizeStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
      setSelectedFont(storedFont);
      setBaselineFont(storedFont);
      setSelectedSpacing(storedSpacing);
      setBaselineSpacing(storedSpacing);
      setSelectedTheme(storedTheme);
      setBaselineTheme(storedTheme);
      applyFont(storedFont);
      applySpacing(storedSpacing);
      applyTheme(storedTheme);
    } catch {
      applyFont("grotesk");
      applySpacing("default");
      applyTheme("system");
    }
  }, []);

  useEffect(() => {
    if (!canManageRoles) {
      setRoles([]);
      setAssignments([]);
      setInvites([]);
      setRolesLoading(false);
      setRolesError(null);
      return;
    }
    let active = true;

    const loadRoles = async (): Promise<void> => {
      setRolesLoading(true);
      setRolesError(null);
      try {
        const [rolesData, assignmentData, inviteData] = await Promise.all([
          listRoles(),
          listRoleAssignments(),
          listInvites()
        ]);

        if (!active) return;

        setRoles(rolesData);
        setAssignments(assignmentData);
        setInvites(inviteData);
        setUserRoleDrafts(
          Object.fromEntries(assignmentData.map((user) => [user.id, normalizeRoleIds(user.roleIds)]))
        );
        setRoleDrafts(
          Object.fromEntries(
            rolesData.map((role) => [role.id, { name: role.name, color: role.color, permissions: role.permissions }])
          )
        );
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to load roles";
        setRolesError(message);
      } finally {
        if (active) setRolesLoading(false);
      }
    };

    void loadRoles();

    return () => {
      active = false;
    };
  }, [canManageRoles]);

  useEffect(() => {
    if (!showManageRoles || roles.length === 0) return;
    setActiveRoleId((current) => {
      if (current && roles.some((role) => role.id === current)) return current;
      return roles[0]?.id ?? null;
    });
  }, [showManageRoles, roles]);

  const hasUnsavedChanges =
    selectedFont !== baselineFont || selectedSpacing !== baselineSpacing || selectedTheme !== baselineTheme;

  const helperText = useMemo(() => {
    if (status === "saved" && !hasUnsavedChanges) {
      return "Settings saved.";
    }

    return "Some settings apply after saving. Collaboration controls will be wired up later.";
  }, [status, hasUnsavedChanges]);

  const assignmentById = useMemo(() => {
    return new Map(assignments.map((member) => [member.id, member]));
  }, [assignments]);

  const acceptedInvites = useMemo(
    () => invites.filter((invite) => invite.status === "accepted" && invite.acceptedBy),
    [invites]
  );

  const acceptedMembers = useMemo(() => {
    return acceptedInvites.flatMap((invite) => {
      const member = invite.acceptedBy ? assignmentById.get(invite.acceptedBy) : undefined;
      return member ? [{ invite, member }] : [];
    });
  }, [acceptedInvites, assignmentById]);

  const acceptedInviteIds = useMemo(() => {
    return new Set(acceptedInvites.map((invite) => invite.acceptedBy!).filter(Boolean));
  }, [acceptedInvites]);

  const currentMembers = useMemo(() => {
    return assignments.filter((member) => !acceptedInviteIds.has(member.id));
  }, [assignments, acceptedInviteIds]);

  const getRoleIdsForUser = (memberId: string): string[] => {
    return userRoleDrafts[memberId] ?? assignmentById.get(memberId)?.roleIds ?? [];
  };

  const activeRole = activeRoleId
    ? roles.find((role) => role.id === activeRoleId) ?? roles[0] ?? null
    : roles[0] ?? null;

  const activeRoleDraft = activeRole
    ? roleDrafts[activeRole.id] ?? { name: activeRole.name, color: activeRole.color, permissions: activeRole.permissions }
    : null;

  const activeRoleDirty = activeRole && activeRoleDraft
    ? activeRoleDraft.name !== activeRole.name ||
      activeRoleDraft.color !== activeRole.color ||
      !permissionsMatch(activeRoleDraft.permissions, activeRole.permissions)
    : false;

  const activeRoleSaving = activeRole ? savingRoles.has(activeRole.id) : false;
  const onSave = (): void => {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, selectedFont);
      localStorage.setItem(SPACING_STORAGE_KEY, selectedSpacing);
      localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    } catch {
      // ignore storage failures
    }
    applyFont(selectedFont);
    applySpacing(selectedSpacing);
    applyTheme(selectedTheme);
    setBaselineFont(selectedFont);
    setBaselineSpacing(selectedSpacing);
    setBaselineTheme(selectedTheme);
    setStatus("saved");
  };

  const onToggleNewRolePermission = (permission: RolePermission): void => {
    setNewRolePermissions((current) => togglePermission(current, permission));
  };

  const onCreateRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!newRoleName.trim()) {
      setRolesError("Role name is required");
      return;
    }
    if (newRolePermissions.length === 0) {
      setRolesError("Select at least one permission");
      return;
    }

    setCreatingRole(true);
    setRolesError(null);

    try {
      const created = await createRole({
        name: newRoleName.trim(),
        color: newRoleColor,
        permissions: newRolePermissions
      });

      setRoles((current) => [...current, created].sort((a, b) => b.priority - a.priority));
      setRoleDrafts((current) => ({
        ...current,
        [created.id]: { name: created.name, color: created.color, permissions: created.permissions }
      }));
      setNewRoleName("");
      setNewRoleColor("#64748b");
      setNewRolePermissions(["view_boards"]);
      setShowCreateRole(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create role";
      setRolesError(message);
    } finally {
      setCreatingRole(false);
    }
  };

  const onChangeUserRoles = (userId: string, value: string[]): void => {
    setUserRoleDrafts((current) => ({
      ...current,
      [userId]: normalizeRoleIds(value)
    }));
  };

  const onSaveUserRoles = async (userId: string): Promise<void> => {
    const nextRoles = userRoleDrafts[userId] ?? [];
    setSavingUsers((current) => new Set(current).add(userId));
    try {
      const updated = await updateUserRoles(userId, nextRoles);
      setAssignments((current) => current.map((user) => (user.id === userId ? updated : user)));
      setUserRoleDrafts((current) => ({ ...current, [userId]: normalizeRoleIds(updated.roleIds) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update roles";
      setRolesError(message);
    } finally {
      setSavingUsers((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  };

  const onChangeRoleDraft = (roleId: string, next: Partial<RoleDraft>): void => {
    setRoleDrafts((current) => {
      const existing = current[roleId] ?? { name: "", color: "#64748b", permissions: [] };
      return {
        ...current,
        [roleId]: { ...existing, ...next }
      };
    });
  };

  const onToggleRolePermission = (roleId: string, permission: RolePermission): void => {
    setRoleDrafts((current) => {
      const existing = current[roleId];
      if (!existing) return current;
      return {
        ...current,
        [roleId]: { ...existing, permissions: togglePermission(existing.permissions, permission) }
      };
    });
  };

  const onSaveRole = async (role: RoleSummary): Promise<void> => {
    const draft = roleDrafts[role.id];
    if (!draft) return;
    setSavingRoles((current) => new Set(current).add(role.id));
    setRolesError(null);

    try {
      const payload = role.isSystem
        ? { color: draft.color, permissions: draft.permissions }
        : { name: draft.name, color: draft.color, permissions: draft.permissions };
      const updated = await updateRole(role.id, payload);
      setRoles((current) => current.map((item) => (item.id === role.id ? updated : item)));
      setRoleDrafts((current) => ({
        ...current,
        [role.id]: { name: updated.name, color: updated.color, permissions: updated.permissions }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update role";
      setRolesError(message);
    } finally {
      setSavingRoles((current) => {
        const next = new Set(current);
        next.delete(role.id);
        return next;
      });
    }
  };

  const onDeleteRole = async (roleId: string): Promise<void> => {
    setDeletingRoles((current) => new Set(current).add(roleId));
    setRolesError(null);
    try {
      await deleteRole(roleId);
      setRoles((current) => current.filter((role) => role.id !== roleId));
      setRoleDrafts((current) => {
        const next = { ...current };
        delete next[roleId];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete role";
      setRolesError(message);
    } finally {
      setDeletingRoles((current) => {
        const next = new Set(current);
        next.delete(roleId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">General settings</h2>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Unsaved changes
            </span>
          )}
          <Button type="button" onClick={onSave} disabled={!hasUnsavedChanges}>
            {hasUnsavedChanges ? "Save changes" : "Up to date"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Access levels, permissions, and assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {canManageRoles ? (
              <>
                <Button type="button" className="w-full" onClick={() => setShowCreateRole(true)}>
                  Create role
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setShowManageRoles(true)}>
                  Manage roles
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setShowAssignRoles(true)}>
                  Assign roles
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Roles are managed by admins. Ask your admin if you need changes.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Pick a theme that fits your focus.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant={selectedTheme === "light" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("light");
                setStatus("idle");
              }}
            >
              Light
            </Button>
            <Button
              variant={selectedTheme === "dark" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("dark");
                setStatus("idle");
              }}
            >
              Dark
            </Button>
            <Button
              variant={selectedTheme === "system" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("system");
                setStatus("idle");
              }}
            >
              System
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Choose the reading style you prefer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Font</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={selectedFont}
              onChange={(event) => {
                setSelectedFont(event.target.value as FontOption);
                setStatus("idle");
              }}
            >
              {fontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Spacing</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={selectedSpacing}
              onChange={(event) => {
                setSelectedSpacing(event.target.value as SpacingOption);
                setStatus("idle");
              }}
            >
              {spacingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Adjust email and in-app alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Notification rules will sync here once messaging is enabled.</p>
            <Button variant="secondary" disabled>
              Coming soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">Typography updates apply after saving.</p>

      <CreateRoleModal
        open={showCreateRole}
        onClose={() => setShowCreateRole(false)}
        rolesError={rolesError}
        creatingRole={creatingRole}
        newRoleName={newRoleName}
        newRoleColor={newRoleColor}
        newRolePermissions={newRolePermissions}
        onNameChange={setNewRoleName}
        onColorChange={setNewRoleColor}
        onTogglePermission={onToggleNewRolePermission}
        onSubmit={onCreateRole}
      />

      <ManageRolesModal
        open={showManageRoles}
        onClose={() => setShowManageRoles(false)}
        rolesError={rolesError}
        rolesLoading={rolesLoading}
        roles={roles}
        activeRoleId={activeRoleId}
        activeRole={activeRole}
        activeRoleDraft={activeRoleDraft}
        activeRoleDirty={Boolean(activeRoleDirty)}
        activeRoleSaving={activeRoleSaving}
        deletingRoles={deletingRoles}
        onSelectRole={setActiveRoleId}
        onSaveRole={onSaveRole}
        onChangeRoleDraft={onChangeRoleDraft}
        onToggleRolePermission={onToggleRolePermission}
        onDeleteRole={onDeleteRole}
      />

      <AssignRolesModal
        open={showAssignRoles}
        onClose={() => setShowAssignRoles(false)}
        rolesError={rolesError}
        rolesLoading={rolesLoading}
        acceptedMembers={acceptedMembers}
        currentMembers={currentMembers}
        roles={roles}
        getRoleIdsForUser={getRoleIdsForUser}
        onChangeUserRoles={onChangeUserRoles}
        onSaveUserRoles={onSaveUserRoles}
        savingUsers={savingUsers}
      />

    </div>
  );
}
