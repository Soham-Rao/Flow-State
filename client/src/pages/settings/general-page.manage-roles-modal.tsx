import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RolePermission, RoleSummary } from "@/types/roles";

import { permissionGroups, type RoleDraft } from "./general-page.constants";
import { PermissionToggleRow, SettingsModal } from "./general-page.components";

type ManageRolesModalProps = {
  open: boolean;
  onClose: () => void;
  rolesError: string | null;
  rolesLoading: boolean;
  roles: RoleSummary[];
  activeRoleId: string | null;
  activeRole: RoleSummary | null;
  activeRoleDraft: RoleDraft | null;
  activeRoleDirty: boolean;
  activeRoleSaving: boolean;
  deletingRoles: Set<string>;
  onSelectRole: (roleId: string) => void;
  onSaveRole: (role: RoleSummary) => void;
  onChangeRoleDraft: (roleId: string, next: Partial<RoleDraft>) => void;
  onToggleRolePermission: (roleId: string, permission: RolePermission) => void;
  onDeleteRole: (roleId: string) => void;
};

export function ManageRolesModal({
  open,
  onClose,
  rolesError,
  rolesLoading,
  roles,
  activeRoleId,
  activeRole,
  activeRoleDraft,
  activeRoleDirty,
  activeRoleSaving,
  deletingRoles,
  onSelectRole,
  onSaveRole,
  onChangeRoleDraft,
  onToggleRolePermission,
  onDeleteRole
}: ManageRolesModalProps): JSX.Element {
  return (
    <SettingsModal
      open={open}
      title="Manage roles"
      description="Review existing roles, adjust permissions, and remove custom roles."
      onClose={onClose}
    >
      {rolesError && <p className="text-sm text-destructive">{rolesError}</p>}
      {rolesLoading ? (
        <p className="text-sm text-muted-foreground">Loading roles...</p>
      ) : (
        <div className="space-y-6">
          <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onSelectRole(role.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    activeRole?.id === role.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 text-foreground/80 hover:border-primary/30 hover:bg-secondary/70"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                  {role.name}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (activeRole) {
                  void onSaveRole(activeRole);
                }
              }}
              disabled={!activeRole || !activeRoleDirty || activeRoleSaving}
            >
              {activeRoleSaving ? "Saving..." : activeRoleDirty ? "Save role" : "Up to date"}
            </Button>
          </div>

          {activeRole && activeRoleDraft ? (
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle>Role details</CardTitle>
                <CardDescription>Update role identity and permissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Role name
                    </label>
                    <Input
                      value={activeRoleDraft.name}
                      onChange={(event) => onChangeRoleDraft(activeRole.id, { name: event.target.value })}
                      disabled={activeRole.isSystem}
                    />
                    {activeRole.isSystem && (
                      <p className="text-xs text-muted-foreground">System role names are locked.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Color
                    </label>
                    <Input
                      type="color"
                      value={activeRoleDraft.color}
                      onChange={(event) => onChangeRoleDraft(activeRole.id, { color: event.target.value })}
                      className="h-10 w-full sm:w-16"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {permissionGroups.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">{group.title}</h3>
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <PermissionToggleRow
                            key={item.permission}
                            item={item}
                            enabled={activeRoleDraft.permissions.includes(item.permission)}
                            onToggle={() => onToggleRolePermission(activeRole.id, item.permission)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {!activeRole.isSystem && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        void onDeleteRole(activeRole.id);
                      }}
                      disabled={deletingRoles.has(activeRole.id)}
                    >
                      {deletingRoles.has(activeRole.id) ? "Deleting..." : "Delete role"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Select a role to edit its permissions.</p>
          )}
        </div>
      )}
    </SettingsModal>
  );
}
